# Plan: Comprehensive App Improvements

Implement 11 improvements across 7 phases covering infrastructure, UX, bulk operations, email notifications, audit log UI, CSV import + Azure Entra ID scaffolding, and shared types + E2E.

**Decisions:**
- Email: env-vars-only, silently no-ops if SMTP not configured
- CSV import: random UUID temp password printed in import result
- AD: Option A — Azure Entra ID (OIDC) scaffold (backend routes + frontend button)
- E2E: dedicated test seed DB
- Shared types: local npm workspace package

**Already implemented (skip):** #1 balance on apply form, #6 carry-forward, #11 rate limiting

---

## Phase 1: Infrastructure Wins
- **Objective:** Prisma postinstall automation, React error boundary, session-expiry dialog
- **Files/Functions to Modify/Create:**
  - `server/package.json` — add `"postinstall": "prisma generate"`
  - `client/src/components/ErrorBoundary.tsx` (new)
  - `client/src/App.tsx` — wrap in ErrorBoundary
  - `client/src/contexts/AuthContext.tsx` — expose `sessionExpired` state
  - `client/src/components/SessionExpiredModal.tsx` (new)
- **Tests to Write:**
  - `ErrorBoundary.test.tsx` — renders fallback when child throws
  - `SessionExpiredModal.test.tsx` — modal visible when sessionExpired; login button triggers logout+redirect

## Phase 2: Leave History Filters + Cancellation Reason
- **Objective:** Filterable leave history, cancel-with-reason modal
- **Files/Functions to Modify/Create:**
  - `server/prisma/schema.prisma` — add `cancellationReason String?`
  - `server/src/routes/leaveRequests.ts` — read reason on DELETE
  - `server/src/services/leaveRequest.service.ts` — save cancellationReason
  - `client/src/lib/api.ts` — `cancelLeaveRequest(id, reason?)`
  - `client/src/pages/employee/ApplyLeavePage.tsx` — filter bar + cancel modal
- **Tests to Write:**
  - Delete with reason saves cancellationReason
  - Filter by status/year narrows results

## Phase 3: Bulk Approval
- **Objective:** Select multiple pending requests, approve/reject in one action
- **Files/Functions to Modify/Create:**
  - `server/src/routes/leaveApproval.ts` — `POST /bulk-approve`, `POST /bulk-reject`
  - `server/src/services/leaveApproval.service.ts` — `bulkApprove`, `bulkReject`
  - `client/src/lib/api.ts` — `bulkApproveLeaveRequests`, `bulkRejectLeaveRequests`
  - `client/src/pages/manager/PendingApprovalsPage.tsx` — checkboxes + action bar
- **Tests to Write:**
  - Bulk approve 2 requests; bulk reject with comment; empty array → 400

## Phase 4: Email Notifications
- **Objective:** Email on approval/rejection/new-submission via nodemailer
- **Files/Functions to Modify/Create:**
  - `server/package.json` — add nodemailer + @types/nodemailer
  - `server/src/services/email.service.ts` (new)
  - `server/src/services/leaveApproval.service.ts` — call email after DB commit
  - `server/src/services/leaveRequest.service.ts` — email managers on submission
  - `.env.example` — document SMTP vars
- **Tests to Write:**
  - Mock nodemailer; verify sendMail called with correct to/subject on approval/rejection

## Phase 5: Audit Log Viewer
- **Objective:** HR page to browse AuditLog with filters + pagination
- **Files/Functions to Modify/Create:**
  - `server/src/routes/adminAuditLogs.ts` (new)
  - `server/src/routes/index.ts` — mount router
  - `client/src/lib/api.ts` — `getAuditLogs(params)`, `AuditLog` interface
  - `client/src/pages/admin/AuditLogPage.tsx` (new)
  - `client/src/App.tsx` — route `/admin/audit-logs`
  - `client/src/components/Navbar.tsx` — link
- **Tests to Write:**
  - Returns paginated audit logs; date range filter works; non-admin gets 403

## Phase 6: CSV Import + Azure Entra ID Scaffold
- **Objective:** Bulk user import via CSV; Azure OIDC login scaffold
- **Files/Functions to Modify/Create:**
  - `server/package.json` — add csv-parse, multer
  - `server/src/middleware/upload.ts` (new) — multer in-memory
  - `server/src/routes/users.ts` — `POST /api/users/import`
  - `client/src/lib/api.ts` — `importUsersFromCSV(file)`
  - `client/src/pages/admin/UserManagementPage.tsx` — Import CSV button + modal
  - `server/package.json` — add @azure/msal-node
  - `server/src/routes/auth.ts` — `GET /api/auth/azure/initiate`, `GET /api/auth/azure/callback`
  - `server/src/services/azureAd.service.ts` (new) — MSAL ConfidentialClientApplication, token exchange, user upsert by msEntraOid
  - `client/src/pages/LoginPage.tsx` — "Sign in with Microsoft" button
  - `.env.example` — AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_REDIRECT_URI
- **Tests to Write:**
  - CSV import: valid CSV creates users; duplicate emails skipped; malformed CSV 400
  - Azure callback handler: mock MSAL, verify user upserted with msEntraOid

## Phase 7: Shared Types + Playwright E2E
- **Objective:** Shared Zod types package; browser-level smoke tests
- **Files/Functions to Modify/Create:**
  - `packages/shared-types/src/index.ts` (new workspace)
  - Root `package.json` — add `packages/*` workspace
  - `server/package.json`, `client/package.json` — add shared-types dep
  - `api.ts` + server imports — replace inline interfaces with shared-types
  - `e2e/playwright.config.ts` (new)
  - `e2e/tests/auth.spec.ts`, `leave-flow.spec.ts`, `bulk-approval.spec.ts`
- **Tests to Write:**
  - Login smoke test; full leave-submit → approve flow; bulk approval flow
