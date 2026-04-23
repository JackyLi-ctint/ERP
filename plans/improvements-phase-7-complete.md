## Phase 7 Complete: Shared Types + Playwright E2E

Added a `@erp/shared-types` npm workspace package with Zod schemas and inferred TypeScript types for all domain entities. Set up Playwright with 22 E2E tests across 3 spec files covering authentication, leave request flow, and bulk approval.

**Files created/changed:**
- `packages/shared-types/package.json` *(new)* — `@erp/shared-types` npm workspace
- `packages/shared-types/src/index.ts` *(new)* — 20 Zod schemas + inferred types
- `playwright.config.ts` *(new)* — Playwright config (port 5173, chromium, serial workers)
- `e2e/helpers.ts` *(new)* — `loginAs()`, `logout()`, `TEST_USERS` constants
- `e2e/auth.spec.ts` *(new)* — 9 authentication E2E tests
- `e2e/leave-flow.spec.ts` *(new)* — 6 leave request flow E2E tests
- `e2e/bulk-approval.spec.ts` *(new)* — 7 bulk approval E2E tests
- `package.json` — added `"packages/*"` to workspaces; added `"test:e2e": "playwright test"` script

**Functions created/changed:**
- `loginAs(page, user)` — fills login form and waits for dashboard
- `logout(page)` — clears localStorage refreshToken and navigates to /login
- All Zod schemas: `RoleSchema`, `LeaveStatusSchema`, `LoginRequestSchema`, `RegisterRequestSchema`, `AuthResponseSchema`, `LeaveTypeSchema`, `SubmitLeaveRequestSchema`, `CancelLeaveRequestSchema`, `LeaveRequestSchema`, `LeaveBalanceSchema`, `ApproveLeaveSchema`, `RejectLeaveSchema`, `BulkApproveSchema`, `BulkRejectSchema`, `UserSchema`, `CreateUserSchema`, `PendingRequestSchema`, `AuditLogSchema`, `AuditLogsResponseSchema`

**Tests created/changed:**
- `auth.spec.ts`: unauthenticated redirect, login page fields, Microsoft SSO button visible, invalid credentials error, employee/manager/HR admin login, protected route redirect, logout
- `leave-flow.spec.ts`: navigate to Apply Leave, form fields present, submit without leave type blocked, full submission flow, leave history, half-day AM/PM toggle
- `bulk-approval.spec.ts`: manager navigation, page content, employee blocked from route, HR admin access, select-all checkbox, Approve Selected button visibility, unchecking hides bar

**Review Status:** APPROVED (critical URL bug fixed, PendingRequestSchema added, selectors improved)

**Fixes from code review:**
- All 6 `/pending-approvals` URLs corrected to `/manager/pending-approvals`
- Nav click text changed from `"text=Approvals"` to `"text=Pending Approvals"` (exact match)
- Date inputs now use `getByLabel("Start Date *")` / `getByLabel("End Date *")` for resilience
- Added `PendingRequestSchema` + `PendingRequest` to shared-types

**Git Commit Message:**
```
feat: shared-types workspace + Playwright E2E scaffold

- Add packages/shared-types with 19 Zod schemas for all domain types
  (auth, leave, balance, approval, user, audit log)
- Install @playwright/test; add playwright.config.ts (port 5173, Chromium)
- Add 22 E2E tests: auth.spec, leave-flow.spec, bulk-approval.spec
- Add test:e2e script to root package.json
- Register packages/* in root npm workspaces
```
