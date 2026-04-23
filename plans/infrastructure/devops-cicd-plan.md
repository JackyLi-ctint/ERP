## Plan: DevOps — CI/CD Pipeline with GitHub Actions

> **Decisions locked:** OIDC / Workload Identity Federation for Azure authentication (no long-lived secrets). E2E tests (Phase 5) are a blocking staging gate. Single approver for production. See [Plan A: azure-deployment-plan.md](azure-deployment-plan.md) for infrastructure setup that this pipeline deploys to.

**Phases**

1. **Phase 1: Establish Branch Strategy**
   - **Objective:** Create a `develop` branch from `main`, establish the branch naming convention, and configure `.gitignore` / repo-level settings to enforce the workflow. No code changes — structural and convention only.
   - **Files/Functions to Modify/Create:**
     - New file: `.github/pull_request_template.md` — standard PR checklist (tests pass, migration notes, env var changes documented)
     - New file: `.github/CODEOWNERS` — assign default reviewers to `main` and `develop` PRs
   - **Tests to Write:**
     - N/A — structural phase; verification is confirming `develop` branch exists on remote and PR template appears when opening a GitHub PR
   - **Steps:**
     1. Create `develop` branch locally from `main`: `git checkout -b develop ; git push -u origin develop`
     2. Create `.github/pull_request_template.md` with checklist: tests passing, no destructive migrations, env vars updated in `.env.example`, CHANGELOG note if applicable
     3. Create `.github/CODEOWNERS` assigning `@JackyLi-ctint` as required reviewer for `main` branch merges
     4. Document branch conventions in a comment in the PR template: `feature/*` → `develop`, `hotfix/*` → `main` + `develop`, `develop` → `main` (weekly or release-gated)
     5. **Manual step (GitHub portal):** Configure branch protection on `main`: require PR, require status check `ci / test` to pass, no direct push, require 1 approver
     6. **Manual step (GitHub portal):** Configure branch protection on `develop`: require status check `ci / test` to pass
     7. Push both files, confirm PR template visible on GitHub

2. **Phase 2: CI Workflow — Test Every PR**
   - **Objective:** Create `.github/workflows/ci.yml` that runs on every pull request to `develop` or `main`, executing lint, server Jest tests, and client Vitest tests. Must complete in under 5 minutes.
   - **Files/Functions to Modify/Create:**
     - New file: `.github/workflows/ci.yml`
   - **Tests to Write:**
     - The workflow itself is the test harness — it runs `npm test` which covers the 282 Jest + Vitest suites
     - Verify workflow syntax: `actionlint` or GitHub's built-in YAML validation
     - After pushing, open a test PR to `develop` and confirm the check appears and passes
   - **Steps:**
     1. Write `.github/workflows/ci.yml`:
        - Trigger: `pull_request` targeting `develop` or `main`; `push` to `develop` or `main`
        - Job `test` (ubuntu-latest, Node 20):
          - Checkout
          - `npm ci` (monorepo root — installs all workspaces)
          - `npm run build --workspace=server` (catches TypeScript errors)
          - `npm test --workspace=server -- --ci --forceExit` (Jest, no watch, no coverage for speed)
          - `npm test --workspace=client` (Vitest)
        - Cache `~/.npm` and `node_modules` keyed on `package-lock.json` sha
        - Job name: `ci / test` (matches branch protection rule name exactly)
     2. Push to a test branch, open PR to `develop`, confirm the check runs and passes
     3. Confirm CI fails correctly on a deliberately broken test (revert immediately)

3. **Phase 3: Staging Deploy Workflow**
   - **Objective:** Create `.github/workflows/deploy-staging.yml` that triggers on merge to `develop`. Builds the server Docker image, pushes it to Azure Container Registry tagged with the git SHA, deploys to the staging Container App, runs `prisma migrate deploy` via Container Apps Job, then smoke-tests the `/health` endpoint.
   - **Files/Functions to Modify/Create:**
     - New file: `.github/workflows/deploy-staging.yml`
     - New file: `.github/workflows/_docker-build-push.yml` — reusable workflow for build+push (shared by staging and prod)
   - **Tests to Write:**
     - Workflow syntax validation
     - End-to-end: merge a trivial change to `develop` and confirm staging Container App URL returns `{"status":"ok"}` from `/health` within 3 minutes
   - **Steps:**
     1. Write `.github/workflows/_docker-build-push.yml` (reusable `workflow_call`): inputs are `image_name`, `dockerfile_path`, `acr_login_server`; outputs `image_tag` (git SHA). Steps: `az acr login`, `docker build`, `docker push`
     2. Write `.github/workflows/deploy-staging.yml`:
        - Trigger: `push` to `develop`
        - Needs: CI must pass (use `needs: [ci]` or rely on branch protection)
        - Secrets used: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (OIDC federated auth — no stored password), `ACR_LOGIN_SERVER`, `STAGING_CONTAINER_APP_NAME`, `STAGING_RESOURCE_GROUP`
        - Steps:
          1. Call reusable `_docker-build-push.yml` for the server image
          2. `az containerapp update --image <acr>/<server>:${{ github.sha }}`
          3. `az containerapp job start` — triggers the migration Container Apps Job against staging DB
          4. Wait for job completion (`az containerapp job execution show`)
          5. `curl --fail https://<staging-url>/health` — smoke test
     3. Configure **GitHub Environment** `staging` in the repo (no required reviewer, but has staging secrets)
     4. Use OIDC (Workload Identity Federation) for Azure auth — no stored `AZURE_CREDENTIALS` JSON secret; register a federated credential on the app registration for `repo:JackyLi-ctint/ERP:ref:refs/heads/develop`
     5. Test by merging a no-op commit to `develop`

4. **Phase 4: Production Deploy Workflow — Manual Gated**
   - **Objective:** Create `.github/workflows/deploy-prod.yml` — a `workflow_dispatch` trigger that takes a git SHA (image tag) as input, requires manual approval via a GitHub Environment `production` with a required reviewer, then promotes the exact same image from staging to production and runs migrations. Zero rebuild from source.
   - **Files/Functions to Modify/Create:**
     - New file: `.github/workflows/deploy-prod.yml`
   - **Tests to Write:**
     - Workflow syntax validation
     - Verify approval gate: trigger the workflow and confirm it pauses on the `production` environment waiting for reviewer approval before running any Azure commands
     - After approval: confirm production Container App URL `/health` returns 200
   - **Steps:**
     1. Write `.github/workflows/deploy-prod.yml`:
        - Trigger: `workflow_dispatch` with input `image_tag` (default: blank — user pastes the staging SHA)
        - Environment: `production` (required reviewer configured in GitHub portal)
        - Secrets used: separate `PROD_CONTAINER_APP_NAME`, `PROD_RESOURCE_GROUP`, `PROD_DATABASE_URL` — all in the `production` GitHub Environment
        - Steps (only run after approval):
          1. `az containerapp update --image <acr>/<server>:<image_tag>` (promote, no rebuild)
          2. Trigger production migration Container Apps Job
          3. Wait for job completion
          4. `curl --fail https://<prod-url>/health`
          5. On failure: output rollback command for operator to run manually
     2. **Manual step (GitHub portal):** Create GitHub Environment `production`, add `@JackyLi-ctint` as required reviewer, add production secrets
     3. Register OIDC federated credential for `production` environment: `repo:JackyLi-ctint/ERP:environment:production`
     4. Test: trigger workflow with a known-good staging SHA, approve, verify prod health

5. **Phase 5: E2E Tests in CI (Optional Staging Gate)**
   - **Objective:** Run the 22 Playwright E2E tests against the live staging environment after it deploys, as a post-deploy verification gate. If E2E fails, the workflow fails and auto-rollback instructions are emitted.
   - **Files/Functions to Modify/Create:**
     - [.github/workflows/deploy-staging.yml](../.github/workflows/deploy-staging.yml) — add E2E job after smoke test
     - [e2e/helpers.ts](../e2e/helpers.ts) — verify `BASE_URL` env var is read (not hardcoded to localhost)
     - [playwright.config.ts](../playwright.config.ts) — verify `baseURL` reads from `BASE_URL` env var
   - **Tests to Write:**
     - The Playwright tests themselves already exist (22 tests in `e2e/`) — this phase wires them to run against staging
     - Verify no hardcoded `localhost` URLs remain in E2E test helpers
   - **Steps:**
     1. Read [playwright.config.ts](../playwright.config.ts) and [e2e/helpers.ts](../e2e/helpers.ts) — confirm `baseURL` uses `process.env.BASE_URL ?? 'http://localhost:5173'`; if hardcoded update it
     2. Add E2E job to `deploy-staging.yml` after the smoke test step:
        - Install Playwright browsers: `npx playwright install --with-deps chromium`
        - `BASE_URL=https://<staging-url> npm run test:e2e`
        - On failure: emit rollback command as workflow summary
     3. Run locally first: `BASE_URL=https://<staging-url> npx playwright test` — confirm all 22 pass
     4. Push and verify E2E job appears in staging deploy workflow

**Decisions Made**
1. **Azure authentication:** OIDC / Workload Identity Federation — no stored `AZURE_CREDENTIALS` JSON secret, federated credentials scoped per GitHub Environment (`staging`, `production`).
2. **E2E gate:** Phase 5 Playwright tests run after staging deploy and are blocking — failure emits rollback instructions and stops production promotion.
3. **Production approver:** Single reviewer (`@JackyLi-ctint`) required before production deploy runs.
4. **PR preview environments:** Not in scope for initial pipeline — only `develop` merge triggers staging.
5. **Failure notification:** GitHub Actions workflow summary includes rollback command; email notification via GitHub native “notify on failure” — no Teams webhook in scope for initial pipeline.
