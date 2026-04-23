## Plan A: Azure Deployment — Container Apps + Static Web Apps

> **Decisions locked:** SWA for client (free CDN, no container overhead), OIDC for Azure auth (no long-lived secrets), `minReplicas: 1` on the server Container App (avoids in-memory OAuth state race condition — see known limitation in Phase 4). For multi-replica + email queue extraction, see [Plan B: azure-resilience-plan.md](azure-resilience-plan.md).

Deploy the ERP Leave Management system to Azure using Container Apps for the Express API, Static Web Apps for the React frontend, and Azure Database for PostgreSQL Flexible Server — using the existing server Dockerfile hardened for production.

**Phases**

1. **Phase 1: Harden Server Dockerfile for Production**
   - **Objective:** Convert `server/Dockerfile` from a single-stage dev image to a production-grade multi-stage build with a non-root user. The current image copies all source, installs all deps including devDependencies, and runs `npm run start` directly — not suitable for prod.
   - **Files/Functions to Modify/Create:**
     - [server/Dockerfile](../server/Dockerfile) — rewrite as multi-stage (builder + runtime)
     - [server/package.json](../server/package.json) — verify `prisma generate` runs in build (already in `postinstall`)
   - **Tests to Write:**
     - `docker build -t erp-server-test -f server/Dockerfile .` — must exit 0
     - `docker run --rm -e DATABASE_URL=invalid -e JWT_ACCESS_SECRET=x32charslongsecretfortest1234 -e JWT_REFRESH_SECRET=x32charslongsecretfortest5678 -p 3001:3000 erp-server-test` — container starts (startup validation error expected for bad DB url is fine)
     - `docker images erp-server-test --format "{{.Size}}"` — confirm final image is smaller than single-stage
   - **Steps:**
     1. Write the new multi-stage Dockerfile: `builder` stage installs all deps + compiles TypeScript + runs `prisma generate`; `runtime` stage uses `node:20-alpine`, copies `dist/`, `node_modules` (prod-only), and `prisma/schema.prisma`
     2. Add `USER node` (non-root) in the runtime stage
     3. Set `NODE_ENV=production` in the runtime stage
     4. Verify `CMD ["node", "dist/server.js"]` — migrations are NOT run at container start (done via separate Container Apps Job)
     5. Build and run the image locally to confirm it starts without errors

2. **Phase 2: Configure Azure Static Web Apps for the Client**
   - **Objective:** Prepare the React/Vite frontend for Azure Static Web Apps deployment. SWA serves the build artefact from its CDN — no Docker image needed for the client. The `client/Dockerfile` is kept for local docker-compose use but not used in Azure. Requires a `staticwebapp.config.json` for SPA routing fallback and a `VITE_API_URL` build variable pointing at the Container Apps server URL.
   - **Files/Functions to Modify/Create:**
     - New file: `client/staticwebapp.config.json` — SPA routing fallback (`/*` → `/index.html`, HTTP 200)
     - [client/vite.config.ts](../client/vite.config.ts) — confirm `VITE_API_URL` env var is used (no hardcoded URL)
     - [client/src/lib/api.ts](../client/src/lib/api.ts) — confirm `baseURL` uses `import.meta.env.VITE_API_URL ?? '/api'`
   - **Tests to Write:**
     - Vitest: import `api.ts` with `VITE_API_URL=https://test.azurecontainerapps.io` set — confirm axios `baseURL` resolves to that value
     - `npm run build --workspace=client` — must exit 0 (catches env var substitution errors at build time)
   - **Steps:**
     1. Write `client/staticwebapp.config.json`: route `/*` → `/index.html` with `statusCode: 200` (required for client-side React Router — without this, direct URL access returns 404)
     2. Read [client/src/lib/api.ts](../client/src/lib/api.ts) — confirm `baseURL: import.meta.env.VITE_API_URL ?? '/api'`; if hardcoded to localhost, update it
     3. Add `VITE_API_URL=` to `.env.example` with comment: `# Set to Container App HTTPS URL in Azure, leave blank for local dev (proxied by Vite)`
     4. Run `npm run build --workspace=client` locally to confirm build with and without `VITE_API_URL` succeeds
     5. Confirm Vitest tests still pass

3. **Phase 3: Create Azure Infrastructure Scripts**
   - **Objective:** Write a reproducible Azure CLI provisioning script and a `Container Apps Job` definition for running Prisma migrations. This replaces manual portal clicks and can be re-run safely (idempotent).
   - **Files/Functions to Modify/Create:**
     - New file: `infra/provision.sh` — Azure CLI script to create all required Azure resources
     - New file: `infra/migrate-job.sh` — Azure CLI script to create + trigger the one-off migration Container Apps Job
     - New file: `infra/README.md` — variable reference and first-run instructions
   - **Tests to Write:**
     - `az bicep build` or `bash -n infra/provision.sh` — script syntax valid, no errors
     - `az deployment group what-if` against a test resource group — dry-run shows expected resources
   - **Steps:**
     1. Write `infra/provision.sh` creating (idempotently, using `|| true` / `--if-not-exists`):
        - Resource group: `erp-rg`
        - Azure Container Registry: `erpacr` (Basic SKU)
        - Azure Database for PostgreSQL Flexible Server (Burstable B1ms, pg 16, East Asia)
        - PostgreSQL database: `leave_management`
        - Container Apps Environment (with Log Analytics workspace auto-created)
        - Container App: `leave-server` (port 3000, **`minReplicas: 1, maxReplicas: 1`** — see Phase 4 known limitation, managed identity assigned)
        - Static Web App: `erp-client` (linked to GitHub repo, auto-deploy on `main`)
        - Key Vault: `erp-kv`, with secrets: `JWT-ACCESS-SECRET`, `JWT-REFRESH-SECRET`, `DB-PASSWORD`
        - Assign `Key Vault Secrets User` role to `leave-server` managed identity on `erp-kv`
        - **No `leave-client` Container App** — SWA replaces it
     2. Write `infra/migrate-job.sh`: creates a Container Apps Job that runs `npx prisma migrate deploy` against the prod DB on demand
     3. Document required pre-filled variables at top of each script: `SUBSCRIPTION_ID`, `LOCATION`, `GITHUB_REPO` (for SWA linking)
     4. Dry-run both scripts with `bash -n` syntax check and `az deployment group what-if` against a scratch resource group

4. **Phase 4: Configure Environment Variables, CORS, and Known Limitations**
   - **Objective:** Update server config so CORS, `FRONTEND_URL`, and Azure AD SSO resolve correctly in Azure. Document the `minReplicas: 1` constraint and its root cause (in-memory OAuth state) so it is not silently changed by a future operator.
   - **Known limitation:** `azureAd.service.ts` stores OAuth state in a process-local `Map` with TTL. If the Container App were scaled to 2+ replicas, the Azure AD callback could land on a different instance, causing authentication failures. Setting `minReplicas: 1` prevents this. The fix (persisting OAuth state to the database) is delivered in [Plan B: azure-resilience-plan.md](azure-resilience-plan.md) Phase 1.
   - **Files/Functions to Modify/Create:**
     - [server/src/app.ts](../server/src/app.ts) — verify `corsOrigins` splits `CORS_ORIGINS` env var on comma (multi-origin support for SWA URL + custom domain)
     - [server/src/lib/config.ts](../server/src/lib/config.ts) — verify no hardcoded localhost, add `AZURE_REDIRECT_URI` to validated config
     - New file: `infra/README.md` — env var reference table: what goes in Key Vault vs. Container App plain env
   - **Tests to Write:**
     - Jest test: `GET /health` with `Origin: https://erp.example.com` header → `Access-Control-Allow-Origin` header present when `CORS_ORIGINS=https://erp.example.com`
     - Jest test: `GET /health` with `Origin: https://other.com` → no `Access-Control-Allow-Origin` header (origin not in allowlist)
   - **Steps:**
     1. Read [server/src/app.ts](../server/src/app.ts) — confirm `CORS_ORIGINS` is split on comma; if single-origin only, update to `origins.split(',').map(s => s.trim())`
     2. Write `infra/README.md` env var table:
        - **Key Vault secrets:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`
        - **Container App plain env:** `NODE_ENV=production`, `PORT=3000`, `CORS_ORIGINS=https://<swa-url>`, `FRONTEND_URL=https://<swa-url>`, `SSO_ENABLED`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_REDIRECT_URI`
        - **Known limitation note:** `minReplicas` must remain `1` until Plan B Phase 1 is complete
     3. Add CORS tests to the server test suite
     4. Run all server tests to confirm still passing

5. **Phase 5: First-Deployment Runbook**
   - **Objective:** Write a step-by-step first-deployment guide that runs the infra scripts, pushes the first Docker images, runs migrations, and verifies the system is live. This is operational documentation, not code.
   - **Files/Functions to Modify/Create:**
     - New file: `infra/DEPLOY.md` — ordered runbook for first-time Azure deployment
   - **Tests to Write:**
     - `curl https://<container-app-url>/health` → `{"status":"ok"}`
     - `curl https://<swa-url>` → HTTP 200
   - **Steps:**
     1. Document pre-requisites: Azure CLI logged in, Docker Desktop running, ACR credentials available
     2. Step 1 — Run `infra/provision.sh` (creates all Azure resources)
     3. Step 2 — Build and push images: `docker build → docker tag → docker push` to ACR for both `server` and `client`
     4. Step 3 — Populate Key Vault secrets (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, DB password)
     5. Step 4 — Update Container App to use the pushed image tag
     6. Step 5 — Run `infra/migrate-job.sh` to execute `prisma migrate deploy` against Azure DB
     7. Step 6 — Run `npx prisma db seed` via Container Apps Job (optional, for initial demo data)
     8. Step 7 — Smoke test: `/health` endpoint, login page loads, demo login works

**Decisions Made**
1. **Client hosting:** Azure Static Web Apps (free CDN, zero Docker overhead, auto-deploys from GitHub). `client/Dockerfile` kept for local docker-compose only.
2. **Azure region:** East Asia (single region — multi-region is out of scope for initial deployment).
3. **Seed script:** Manually triggered via Container Apps Job after first deploy — not automatic.
4. **Secret management:** Key Vault with managed identity (OIDC-aligned, no stored credentials).
5. **Scale:** `minReplicas: 1` on server Container App — in-memory OAuth state constraint. See [Plan B](azure-resilience-plan.md) for the fix.
6. **Azure authentication (CI/CD):** OIDC / Workload Identity Federation — no long-lived `clientSecret` stored in GitHub Secrets.
