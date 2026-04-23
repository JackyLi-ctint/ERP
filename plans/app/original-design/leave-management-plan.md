# Plan: Employee Leave Management Web Application

A modern, web-deployable leave management module built as a TypeScript monorepo (React + Vite frontend, Node.js/Express backend, PostgreSQL + Prisma). Key features include HK official holiday-aware working-day calculation, half-day leave support, one-level manager approval, auto-generated PDF leave slips with optional email delivery, and a Microsoft Azure AD SSO-ready authentication layer.

---

## Answered Decisions

| Question | Decision |
|---|---|
| Stack | React 18 + Vite + TypeScript / Node.js + Express + TypeScript / PostgreSQL + Prisma |
| Deployment | Containerized (Docker Compose), cloud-agnostic, web-deployable |
| Leave slip delivery | PDF always; email delivery optional and configurable |
| Leave counting | Working days only — weekends + HK Official Public Holidays excluded |
| Half-day support | Yes — `halfDay: boolean`, `period: AM \| PM`, counts 0.5 days |
| Auth | JWT now; MSAL abstraction layer pre-wired for Azure AD SSO future plug-in |
| Demo data | Seed users for Employee, Manager, HR Admin roles |

---

## Data Model

### Core Entities

| Entity | Key Fields |
|---|---|
| `User` | id, name, email, passwordHash, role (`employee`/`manager`/`hr_admin`), managerId (self-ref FK), department, msEntraOid (nullable, for SSO) |
| `PublicHoliday` | id, date, name, year — seeded from HK Labour Dept calendar |
| `LeaveType` | id, name, defaultDays, isCarryForward, requiresDocument, isActive, createdBy |
| `LeaveBalance` | id, userId, leaveTypeId, year, totalDays, usedDays, pendingDays |
| `LeaveRequest` | id, employeeId, leaveTypeId, startDate, endDate, halfDay, period (AM/PM), totalDays, reason, attachmentUrl, status |
| `LeaveApproval` | id, leaveRequestId, approverId, action (approved/rejected), comment, actionedAt |
| `LeaveSlip` | id, leaveRequestId, pdfPath, generatedAt |
| `AuditLog` | id, actorId, action, entityType, entityId, before (JSON), after (JSON), timestamp |

### Workflow State Machine
```
DRAFT → PENDING → APPROVED → (balance deducted + slip generated)
                ↘ REJECTED
         ↘ CANCELLED (employee, before approval)
```

---

## Phases

### Phase 1: Project Scaffold, Auth & Azure AD SSO Foundation
- **Objective:** Bootstrap the monorepo structure, configure tooling, define the DB schema, and implement JWT authentication with an MSAL-compatible abstraction layer ready for Azure AD SSO plug-in.
- **Files/Functions to Create:**
  - `package.json` (workspaces monorepo root)
  - `client/` — Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui
  - `server/` — Node.js + Express + TypeScript + Prisma
  - `server/prisma/schema.prisma` — `User`, `AuditLog` models
  - `server/src/auth/jwt.service.ts` — sign/verify JWT
  - `server/src/auth/msal.stub.ts` — MSAL interface stub for future Azure AD
  - `server/src/middleware/requireRole.ts` — role-based guard
  - `server/src/routes/auth.ts` — `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`
  - `server/src/seed/users.ts` — demo users (Employee, Manager, HR Admin)
  - `docker-compose.yml` — app + postgres services
  - `.env.example`
- **Tests to Write:**
  - `auth.register.test.ts` — duplicate email, weak password, success
  - `auth.login.test.ts` — wrong password, unknown user, success + JWT returned
  - `auth.refresh.test.ts` — expired token, valid refresh, rotation
  - `requireRole.test.ts` — employee blocked from manager route, HR admin passes
  - `msal.stub.test.ts` — stub satisfies the MSAL interface contract
- **Steps:**
  1. Write failing tests for all auth flows and role middleware.
  2. Scaffold monorepo, install dependencies, configure Prisma.
  3. Implement JWT service, auth routes, and role middleware to pass all tests.
  4. Implement MSAL stub satisfying the auth interface (no real Azure calls yet).
  5. Add seed script with demo users; verify Docker Compose starts successfully.
  6. Re-run all tests and confirm pass.

---

### Phase 2: HK Holiday Registry & Working Day Calculator
- **Objective:** Seed the HK Official Public Holiday table and build the working-day calculation service that powers all leave duration logic (excludes weekends and HK public holidays, supports half-day).
- **Files/Functions to Create:**
  - `server/prisma/schema.prisma` — add `PublicHoliday` model
  - `server/src/seed/hkHolidays.ts` — HK official holidays (seeded for multiple years)
  - `server/src/services/workingDays.service.ts` — `countWorkingDays(start, end, halfDay?, period?)`, `isWorkingDay(date)`
  - `server/src/routes/holidays.ts` — `GET /holidays?year=` (HR Admin / read-only)
- **Tests to Write:**
  - `workingDays.test.ts`:
    - full week Mon–Fri = 5 days
    - weekend boundaries excluded
    - HK holiday (e.g., 1 Jan, Ching Ming) excluded
    - half-day AM/PM = 0.5 days
    - single-day HK holiday = 0 days
    - cross-month spans
    - cross-year spans including New Year
- **Steps:**
  1. Write all failing working-day tests, including HK holiday edge cases.
  2. Add `PublicHoliday` model and run Prisma migration.
  3. Seed known HK public holidays from Labour Department official list (current year + next 2).
  4. Implement `workingDays.service.ts` to pass all tests.
  5. Add holidays read endpoint; verify seeded data via integration test.
  6. Re-run all tests and confirm pass.

---

### Phase 3: Leave Type Configuration & Balance Ledger
- **Objective:** HR Admin can configure leave types (create/update/deactivate). The system initializes annual leave balances per employee per type and exposes balance queries.
- **Files/Functions to Create:**
  - `server/prisma/schema.prisma` — add `LeaveType`, `LeaveBalance` models
  - `server/src/routes/leaveTypes.ts` — full CRUD (HR Admin only) + `GET /leave-types` (all roles)
  - `server/src/services/leaveBalance.service.ts` — `initBalances(year)`, `getBalance(userId, leaveTypeId, year)`
  - `server/src/routes/leaveBalance.ts` — `GET /me/balances`, `GET /users/:id/balances` (HR Admin)
  - `client/src/pages/admin/LeaveTypesPage.tsx` — table + create/edit dialog
- **Tests to Write:**
  - `leaveTypes.test.ts` — employee cannot create/edit, HR Admin can, deactivated type not visible for new applications
  - `leaveBalance.init.test.ts` — balance created for each user × leave type on year init; idempotent if run twice
  - `leaveBalance.query.test.ts` — employee sees own only, HR sees any
- **Steps:**
  1. Write failing tests for leave type CRUD auth and balance initialization logic.
  2. Add Prisma models and migrate.
  3. Implement leave type routes and balance service.
  4. Build minimal HR Admin UI page for leave type management.
  5. Re-run all tests and confirm pass.

---

### Phase 4: Leave Application Submission (Full-Day & Half-Day)
- **Objective:** Employees can submit leave requests (full-day or half-day). Business rules enforced: sufficient balance, no overlapping active requests, future dates only, weekend/holiday exclusion auto-applied. Balance enters `pendingDays` on submission.
- **Files/Functions to Create:**
  - `server/prisma/schema.prisma` — add `LeaveRequest` model
  - `server/src/routes/leaveRequests.ts` — `POST /leave-requests`, `GET /me/leave-requests`, `DELETE /leave-requests/:id` (cancel)
  - `server/src/services/leaveRequest.service.ts` — `submit()`, `cancel()`, business-rule validators, `reservePending()`
  - `client/src/pages/employee/ApplyLeavePage.tsx` — form with date picker, half-day toggle, leave type selector, real-time duration preview
  - `client/src/components/LeaveDurationPreview.tsx` — working-day counter widget
- **Tests to Write:**
  - `leaveRequest.submit.test.ts`:
    - insufficient balance → 422
    - overlapping PENDING/APPROVED request → 409
    - past start date → 422
    - weekend-only range → 422 (0 working days)
    - valid full-day → 201, pendingDays incremented
    - valid half-day AM/PM → 201, 0.5 deducted from pending
  - `leaveRequest.cancel.test.ts` — cancelled before approval releases pendingDays; cannot cancel APPROVED
- **Steps:**
  1. Write all failing submission and cancellation tests.
  2. Add `LeaveRequest` Prisma model and migrate.
  3. Implement `leaveRequest.service.ts` with full validation chain.
  4. Implement submission routes; tie to working-day calculator.
  5. Build employee apply-leave form with live duration preview.
  6. Re-run all tests and confirm pass.

---

### Phase 5: One-Level Manager Approval Workflow
- **Objective:** The designated approver (resolved from `User.approverId`) can view their queue of pending requests, approve or reject with a comment. On `APPROVED`, balance deduction is atomic (transaction). Audit log records every transition. Idempotent (double-submit safe). **Exception:** HR Admin users are not blocked from self-approving their own leave in v1.
- **Files/Functions to Create:**
  - `server/prisma/schema.prisma` — add `LeaveApproval`, `AuditLog` models
  - `server/src/routes/approvals.ts` — `GET /manager/pending`, `POST /leave-requests/:id/approve`, `POST /leave-requests/:id/reject`
  - `server/src/services/approval.service.ts` — `approve()`, `reject()`, atomic deduction transaction, `logAudit()`
  - `client/src/pages/manager/ApprovalQueuePage.tsx` — list with approve/reject action + comment modal
- **Tests to Write:**
  - `approval.auth.test.ts` — employee cannot approve own/others' requests; manager can only approve own team's requests; HR Admin may self-approve (not blocked)
  - `approval.approve.test.ts` — balance atomically deducted, pendingDays cleared, status → APPROVED
  - `approval.reject.test.ts` — pendingDays returned, status → REJECTED, comment stored
  - `approval.idempotent.test.ts` — double-approve returns 409, no double deduction
  - `auditLog.test.ts` — transition logged with before/after, actor, timestamp
- **Steps:**
  1. Write all failing approval, rejection, and audit tests.
  2. Add `LeaveApproval`, `AuditLog` Prisma models and migrate.
  3. Implement `approval.service.ts` with Prisma `$transaction` for atomic deduction.
  4. Implement manager approval routes and queue UI.
  5. Re-run all tests and confirm pass.

---

### Phase 6: Leave Slip Generation & HR Records
- **Objective:** On approval, automatically generate a PDF leave slip. HR Admin can view all records and download slips. Optional email delivery of slip to employee (toggle via env/config).
- **Files/Functions to Create:**
  - `server/prisma/schema.prisma` — add `LeaveSlip` model
  - `server/src/services/leaveSlip.service.ts` — `generateSlip(leaveRequestId)` using `@react-pdf/renderer` or `pdfkit`
  - `server/src/services/email.service.ts` — `sendSlipEmail(userId, slipPath)` (Nodemailer; skipped if `EMAIL_ENABLED=false`)
  - `server/src/routes/slips.ts` — `GET /leave-requests/:id/slip` (employee + HR Admin)
  - `client/src/pages/hr/HRRecordsPage.tsx` — filterable table of all requests, status, download slip
  - `client/src/pages/employee/MyLeavesPage.tsx` — history with slip download link when available
- **Tests to Write:**
  - `leaveSlip.generate.test.ts` — slip created on approval event, PDF buffer non-empty, linked to request
  - `leaveSlip.download.test.ts` — employee can download own slip, cannot access others; HR Admin can access any
  - `email.service.test.ts` — email sent when `EMAIL_ENABLED=true`, skipped when false, mock SMTP used in tests
  - `hrRecords.test.ts` — HR sees all requests; employee sees own only
- **Steps:**
  1. Write failing slip generation, download, and email tests.
  2. Add `LeaveSlip` Prisma model and migrate.
  3. Implement `leaveSlip.service.ts`; hook into approval service post-commit.
  4. Implement `email.service.ts` with environment feature flag.
  5. Build HR Records page and My Leaves history page with slip download.
  6. Re-run all tests and confirm pass.

---

### Phase 7: Dashboard UI Polish, Security Hardening & Release Readiness
- **Objective:** Complete the corporate-grade dashboard experience for all three roles, add security hardening, finalize Docker configuration, and prepare Azure AD SSO wiring.
- **Files/Functions to Create:**
  - `client/src/pages/dashboard/EmployeeDashboard.tsx` — balance cards, recent requests, quick-apply CTA
  - `client/src/pages/dashboard/ManagerDashboard.tsx` — pending queue widget, team calendar view
  - `client/src/pages/dashboard/HRDashboard.tsx` — org-wide usage stats, leave type summary, audit log viewer
  - `client/src/components/LeaveCalendar.tsx` — team leave calendar with color-coded statuses
  - `server/src/auth/msal.provider.ts` — real MSAL/Entra ID token validation (replaces stub; activated by `SSO_ENABLED=true`)
  - `server/src/middleware/securityHeaders.ts` — Helmet.js config
  - `docker-compose.prod.yml` — production-optimized compose
  - `.env.example` — all env vars documented
- **Tests to Write:**
  - `dashboard.ui.test.ts` — each role sees correct widgets and is denied wrong-role screens
  - `security.test.ts` — rate limiting, JWT replay prevention, CSRF token on mutation endpoints
  - `sso.msal.test.ts` — MSAL token validation mock, OID maps to existing user, first-time SSO creates user record
  - `e2e.workflow.test.ts` — full cycle: apply → manager approves → slip downloaded
- **Steps:**
  1. Write failing dashboard role-visibility tests, SSO mapping tests, and E2E tests.
  2. Complete all three dashboard pages with Tailwind + shadcn/ui design system.
  3. Implement real MSAL provider behind feature flag; test SSO first-login user creation.
  4. Add rate limiting, Helmet headers, and CSRF protection.
  5. Finalize Docker Compose for production; document all env vars.
  6. Re-run full test suite and confirm 100% pass.

---

## Non-Functional Requirements

| Concern | Implementation |
|---|---|
| Access Control | Role guards on every endpoint; approver sees only their assigned approvals; HR Admin self-approval permitted in v1 |
| Passwords | bcrypt (cost 12); JWT secrets from env only (never hardcoded) |
| SQL Injection | Prisma parameterized queries throughout |
| Audit Trail | Every state transition logged in `AuditLog` with actor + diff |
| Balance Integrity | Prisma `$transaction` on approval; idempotency checks |
| HK Holidays | Seeded from HK Labour Department official list; updatable via HR Admin |
| Half-Day | 0.5 working-day unit; AM/PM period stored for payroll reference |
| Azure AD SSO | `msEntraOid` column on User; MSAL interface abstracted; activated by env var |
| Email | Nodemailer; disabled by default; configured via `EMAIL_ENABLED` + SMTP env vars |
| Containerisation | Docker Compose (dev + prod variants); no vendor lock-in |

---

## Open Questions (Resolved)

All five pre-implementation questions answered — no blockers.
