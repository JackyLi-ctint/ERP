## Plan B: Azure Resilience — Multi-Replica + Email Queue Extraction

> **Prerequisite:** [Plan A (azure-deployment-plan.md)](azure-deployment-plan.md) must be fully deployed and stable before starting this plan. Plan B builds on the running Azure infrastructure — it does not replace it.

This plan removes the two known limitations from Plan A: (1) the in-memory OAuth state that forces `minReplicas: 1`, and (2) the inline email sending that adds SMTP latency to leave approval responses. After this plan, the server Container App can scale to 2+ replicas and email delivery is fully decoupled from the API response path.

**Phases**

1. **Phase 1: Persist OAuth State to Database (Unlock Multi-Replica)**
   - **Objective:** Replace the in-memory `Map`-based OAuth state store in `azureAd.service.ts` with a PostgreSQL-backed `OAuthState` table. This makes the server stateless — any replica can handle the Azure AD callback regardless of which instance initiated the OAuth flow. Once deployed, `minReplicas` can be raised to 2.
   - **Files/Functions to Modify/Create:**
     - [server/prisma/schema.prisma](../server/prisma/schema.prisma) — add `OAuthState` model
     - New migration: `prisma/migrations/..._add_oauth_state_table`
     - [server/src/auth/azureAd.service.ts](../server/src/auth/azureAd.service.ts) — replace in-memory `Map` with Prisma `OAuthState` read/write
     - [infra/provision.sh](../infra/provision.sh) — update `minReplicas` from 1 to 2
   - **Tests to Write:**
     - Jest: `generateState()` persists a record to `OAuthState` table, returns the state string
     - Jest: `validateAndConsumeState(validState)` → returns `true`, record deleted (one-time use)
     - Jest: `validateAndConsumeState(unknownState)` → returns `false`, no DB error
     - Jest: `validateAndConsumeState(expiredState)` → returns `false` (state older than 10 minutes)
     - Jest: calling `validateAndConsumeState` twice with same state → second call returns `false` (consumed)
   - **Steps:**
     1. Add `OAuthState` model to `schema.prisma`: fields `id` (cuid), `state` (String, unique), `createdAt` (DateTime default now), index on `createdAt` for TTL cleanup
     2. Run `npx prisma migrate dev --name add_oauth_state_table` — generates and applies migration
     3. Write the 5 Jest tests listed above against the new DB-backed functions (they will fail — red phase)
     4. Rewrite `azureAd.service.ts` state management:
        - `generateState()`: `prisma.oAuthState.create({ data: { state: crypto.randomUUID() } })` → return state
        - `validateAndConsumeState(state)`: find record, check `createdAt > now - 10min`, delete it atomically in a transaction, return boolean
        - Remove the in-memory `Map` and TTL purge interval entirely
     5. Run the 5 tests — confirm they pass (green phase)
     6. Update `infra/provision.sh`: change `--min-replicas 1` to `--min-replicas 2` for `leave-server`
     7. Add a scheduled cleanup Container Apps Job (daily): `DELETE FROM "OAuthState" WHERE "createdAt" < NOW() - INTERVAL '1 hour'` — prevents unbounded table growth from abandoned OAuth flows

2. **Phase 2: Extract Email Sending to Azure Service Bus Queue**
   - **Objective:** Move email dispatch out of the synchronous API path. Currently `sendLeaveApprovedEmail()` etc. are awaited inline inside approval responses — adding SMTP latency (~200–500ms) to every approval action. Replace with: approval service publishes an event message to an Azure Service Bus queue; a separate Container Apps `email-worker` Job polls the queue and sends the email. The HTTP response returns immediately without waiting for SMTP.
   - **Files/Functions to Modify/Create:**
     - [server/src/services/email.service.ts](../server/src/services/email.service.ts) — replace `sendEmail()` implementation with Service Bus message publish
     - New file: `server/src/services/emailQueue.service.ts` — thin wrapper around `@azure/service-bus` SDK, publishes `LeaveEmailEvent` messages
     - New file: `server/src/workers/emailWorker.ts` — standalone script that polls the Service Bus queue and calls nodemailer; run as a Container Apps Job
     - [server/package.json](../server/package.json) — add `@azure/service-bus` dependency
     - [infra/provision.sh](../infra/provision.sh) — add Service Bus namespace + queue provisioning
     - [infra/migrate-job.sh](../infra/migrate-job.sh) — add `email-worker` Container Apps Job definition
   - **Tests to Write:**
     - Jest (unit, mocked Service Bus): `publishLeaveApprovedEmail({ employeeName, leaveType, dates })` → `ServiceBusClient.sendMessages` called with correct body, `contentType: 'application/json'`
     - Jest (unit, mocked Service Bus): publish failure → error logged, function rejects (don't silently swallow)
     - Jest (unit, mocked nodemailer): `emailWorker.processMessage(mockMessage)` → `nodemailer.sendMail` called with correct `to`, `subject`, `html`
     - Jest (unit): `emailWorker.processMessage` with malformed message body → error logged, message dead-lettered (not retried infinitely)
     - Integration (manual): trigger a leave approval in staging → Service Bus queue shows 1 message enqueued → email-worker job processes it → email received
   - **Steps:**
     1. Add `@azure/service-bus` to `server/package.json`
     2. Write `emailQueue.service.ts`: `ServiceBusClient` singleton (connection string from env `SERVICE_BUS_CONNECTION_STRING`), function `publishEmailEvent(event: LeaveEmailEvent)` that sends a JSON message to the `leave-emails` queue
     3. Write the 4 Jest unit tests (red phase)
     4. Update `email.service.ts`: replace `nodemailer.sendMail()` calls with `publishEmailEvent()` calls — same function signatures, same call sites in `leaveApproval.service.ts` need no changes
     5. Write `emailWorker.ts`: poll `leave-emails` queue, deserialize `LeaveEmailEvent`, call nodemailer, complete/dead-letter message. Designed to run to completion (not a long-running process) — suitable for Container Apps Job
     6. Run Jest tests — confirm pass (green phase)
     7. Add `SERVICE_BUS_CONNECTION_STRING` to `.env.example` and `infra/README.md` env var table
     8. Update `infra/provision.sh`: add `az servicebus namespace create` + `az servicebus queue create --name leave-emails --max-delivery-count 5 --lock-duration PT5M`
     9. Add `email-worker` Container Apps Job to `infra/migrate-job.sh`: trigger type `Event` (Service Bus queue trigger), runs `emailWorker.ts`, max execution time 5 minutes

3. **Phase 3: Update Container App Scale Rules**
   - **Objective:** Now that both statelessness blockers are removed (OAuth state in DB, email in queue), configure the server Container App with proper autoscaling rules: scale up on HTTP concurrency, scale down to 1 replica during off-hours (not 0 — avoids cold-start latency on first morning login). Update the CI/CD pipeline to deploy the `email-worker` Container Apps Job alongside the server image.
   - **Files/Functions to Modify/Create:**
     - [infra/provision.sh](../infra/provision.sh) — update Container App scale rules: `minReplicas: 1`, `maxReplicas: 5`, HTTP concurrency scale rule (10 concurrent requests per replica)
     - [.github/workflows/deploy-staging.yml](../.github/workflows/deploy-staging.yml) — add step to update `email-worker` Job image on deploy
     - [.github/workflows/deploy-prod.yml](../.github/workflows/deploy-prod.yml) — same
   - **Tests to Write:**
     - Load test (k6 or `autocannon`, run manually): send 50 concurrent POST `/api/leave-requests/bulk-approve` requests to staging → Container App scales above 1 replica within 60 seconds → all 50 requests return 2xx
     - Verify: after load stops, replica count returns to 1 within 5 minutes (scale-down)
   - **Steps:**
     1. Update `infra/provision.sh` scale rule: `--scale-rule-name http-rule --scale-rule-type http --scale-rule-http-concurrency 10 --min-replicas 1 --max-replicas 5`
     2. Add `email-worker` image update to both deploy workflows: after server image is updated, update the Container Apps Job image with the same git SHA tag
     3. Run the load test manually against staging to confirm autoscaling triggers
     4. Confirm email delivery still works under load (Service Bus queue absorbs burst, worker processes sequentially)

4. **Phase 4: Update Runbook and Documentation**
   - **Objective:** Update `infra/DEPLOY.md` and `infra/README.md` to reflect the new components (Service Bus, DB OAuth state, multi-replica), document the `email-worker` deployment step, and remove the `minReplicas: 1` known limitation note from Plan A docs.
   - **Files/Functions to Modify/Create:**
     - [infra/DEPLOY.md](../infra/DEPLOY.md) — add Service Bus provisioning step, email-worker deploy step
     - [infra/README.md](../infra/README.md) — add `SERVICE_BUS_CONNECTION_STRING` to env var table, remove known limitation note
     - [plans/azure-deployment-plan.md](azure-deployment-plan.md) — update known limitation note to point to this plan as resolved
   - **Tests to Write:**
     - N/A — documentation phase; verification is end-to-end manual test: approve a leave request in production staging → confirm email received within 2 minutes
   - **Steps:**
     1. Update `infra/DEPLOY.md` first-deployment steps: add provisioning Service Bus namespace + queue between PostgreSQL and Container App steps
     2. Add `email-worker` Container Apps Job deploy step after server Container App deploy
     3. Update `infra/README.md` Service Bus section: `SERVICE_BUS_CONNECTION_STRING` goes in Key Vault (contains credentials)
     4. Update [azure-deployment-plan.md](azure-deployment-plan.md) Phase 4 known limitation note: "Resolved in Plan B Phase 1"

**Decisions Made**
1. **OAuth state storage:** PostgreSQL `OAuthState` table with atomic consume (delete-on-read). Redis Cache considered and rejected — adds another managed resource for a small amount of state.
2. **Email queue:** Azure Service Bus Standard tier (`leave-emails` queue, max 5 delivery attempts, then dead-letter). Storage Queue considered — Service Bus chosen for dead-letter visibility and per-message lock TTL.
3. **Email worker execution model:** Container Apps Job (event-triggered, runs to completion) rather than a long-running Container App — matches the burst-then-idle email pattern, no idle billing.
4. **Minimum replicas after Plan B:** `minReplicas: 1` (not 0) to avoid cold-start latency for first morning login. `maxReplicas: 5`.
5. **Plan B prerequisite:** Plan A must be stable in production before starting Plan B Phase 1 to ensure `OAuthState` migration can be validated end-to-end before scaling up replicas.
