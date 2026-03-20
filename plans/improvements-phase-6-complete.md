## Phase 6 Complete: CSV Import + Azure Entra ID Scaffold

CSV bulk user import is fully implemented with security-hardened in-memory processing. Azure Entra ID (OIDC) scaffold is complete with CSRF protection via OAuth state, guarded against unconfigured environments, and tokens are purged from browser history immediately after extraction.

**Files created/changed:**
- `server/src/middleware/upload.ts` *(new)* — multer in-memory storage, 1 MB cap, CSV-only filter
- `server/src/routes/users.ts` — added `POST /api/users/import` (HR_ADMIN only, returns `{created, skipped, errors}`)
- `server/src/services/azureAd.service.ts` *(new)* — lazy MSAL singleton, `isAzureConfigured()`, `generateState()`, `consumeState()`, `getAuthCodeUrl(state)`, `acquireTokenByCode()`
- `server/src/routes/auth.ts` — added `GET /azure/initiate` (503 if unconfigured, generates + stores OAuth state) and `GET /azure/callback` (verifies state, upserts user by msEntraOid, redirects to frontend with JWT tokens)
- `client/src/pages/admin/UserManagementPage.tsx` — "Import CSV" button + modal with file picker, template hint, and result display (created/skipped/errors)
- `client/src/pages/LoginPage.tsx` — "Sign in with Microsoft" button linking to `/api/auth/azure/initiate`
- `client/src/pages/AzureCallbackPage.tsx` *(new)* — reads tokens from URL params, calls `history.replaceState` to purge them, redirects to dashboard
- `client/src/lib/api.ts` — added `importUsersFromCSV(file: File)`
- `client/src/App.tsx` — added public route `/auth/callback` → `<AzureCallbackPage />`
- `.env.example` — added `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `FRONTEND_URL`
- `server/src/__tests__/users.import.test.ts` *(new)* — 8 tests
- `server/src/__tests__/azureAd.route.test.ts` *(new)* — 7 tests

**Functions created/changed:**
- `upload` (middleware) — multer memory storage with file-type validation
- `POST /api/users/import` — parse CSV buffer, validate rows with `importSchema` (hoisted), skip duplicates, auto-generate temp passwords
- `getMsalClient()` — lazy singleton for MSAL `ConfidentialClientApplication`
- `isAzureConfigured()` — checks all 4 required env vars
- `generateState()` / `consumeState()` — CSRF-safe OAuth state with 10-minute TTL in-memory store
- `getAuthCodeUrl(state)` — passes state to MSAL for CSRF protection
- `acquireTokenByCode(code)` — exchanges OIDC code for `{oid, name, email}` claims
- `importUsersFromCSV(file)` — multipart/form-data POST to `/users/import`
- `AzureCallbackPage` — extracts tokens, purges URL params, redirects

**Tests created/changed:**
- `users.import.test.ts`: valid CSV (2 rows), duplicate skip, no file → 400, missing column → error, unauthenticated → 401, non-HR_ADMIN → 403, role validation, partial success
- `azureAd.route.test.ts`: /initiate unconfigured → 503, /initiate configured → 302 redirect, /callback no code → 400, /callback invalid state → 400 (CSRF), /callback valid code → user created + redirect, /callback existing user → linked + redirect, /callback bad code → 500

**Review Status:** APPROVED (all MAJOR security issues resolved + minor improvements applied)

**Security fixes applied from review:**
- Added `isAzureConfigured()` guard at start of `/azure/callback`
- Added OAuth `state` parameter with 10-minute in-memory TTL (`generateState` + `consumeState`)
- Added `window.history.replaceState` in `AzureCallbackPage` to purge tokens from browser address bar
- Hoisted `importSchema` out of the row-processing loop
- Tightened the invalid-code test to assert `500` instead of `[302, 400, 500]`

**Git Commit Message:**
```
feat: CSV user import + Azure Entra ID (OIDC) scaffold

- Add POST /api/users/import with multer in-memory CSV processing
- HR_ADMIN only; returns { created, skipped, errors } per row
- Add Import CSV button + modal in UserManagementPage
- Add azureAd.service with lazy MSAL singleton and OAuth state
  CSRF protection (generateState/consumeState, 10-min TTL)
- Add GET /azure/initiate and /azure/callback with state verification
  and isAzureConfigured() guards
- Add AzureCallbackPage with history.replaceState to purge tokens
- Add "Sign in with Microsoft" button to LoginPage
- 15 new tests covering import and Azure OIDC flows
```
