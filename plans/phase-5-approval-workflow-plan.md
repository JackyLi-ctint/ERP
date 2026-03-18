## Plan: Manager Approval Workflow + Teams + Leave Calendar

Build team-based leave approval, HR user identity management (team/title), and a colour-coded leave calendar. Approval scope is determined by `User.team` — a MANAGER sees and acts on requests from their own team only; HR_ADMIN operates globally.

**Approval model decisions:**
- Team-based scope: MANAGER approves requests where `employee.team === manager.team`
- HR_ADMIN bypasses all team checks
- Self-approval blocked at service layer
- Cancel of APPROVED leave → `CANCEL_REQUESTED` → requires manager/HR approval
- `approverComment` optional on approve, **required** on reject and reject-cancellation
- No `approverId` self-ref on User — removed in favour of team routing

---

## Phase 5-A: Schema & Approval Service Layer

- **Objective:** Single atomic schema migration plus full approval service using team-based authorization.

- **Files/Functions to Modify/Create:**
  - `server/prisma/schema.prisma`
    - Add `CANCEL_REQUESTED` to `LeaveStatus` enum
    - Add `team String?`, `title String?` to `User`
    - Add `@@index([team])` to `User`
    - Remove `approverId String?`, `approver User? @relation("UserApprover", ...)`, `subordinates User[] @relation("UserApprover")` from `User`
    - Add `approvedById String?`, `approvedBy User? @relation("LeaveApprover", fields:[approvedById], references:[id])`, `approverComment String?` to `LeaveRequest`
    - Add `approvedRequests LeaveRequest[] @relation("LeaveApprover")` back-relation to `User`
  - `server/src/services/leaveRequest.service.ts`
    - Update `cancelLeaveRequest`: PENDING → CANCELLED (unchanged); add branch APPROVED → CANCEL_REQUESTED
  - `server/src/services/leaveApproval.service.ts` (new)
    - `approveLeaveRequest(id, actorId, actorRole, comment?, prisma)`: team-auth check; PENDING → APPROVED; `pendingDays−=`, `usedDays+=`; write AuditLog
    - `rejectLeaveRequest(id, actorId, actorRole, comment, prisma)`: comment required; team-auth; PENDING → REJECTED; `pendingDays−=`; AuditLog
    - `approveCancellation(id, actorId, actorRole, prisma)`: team-auth; CANCEL_REQUESTED → CANCELLED; `usedDays−=`; AuditLog
    - `rejectCancellation(id, actorId, actorRole, comment, prisma)`: comment required; CANCEL_REQUESTED → APPROVED; AuditLog
    - `getSubordinatePendingRequests(actorId, actorRole, prisma)`: MANAGER → same team, status IN (PENDING, CANCEL_REQUESTED), excludes self; HR_ADMIN → all

- **Tests to Write** (`server/src/__tests__/leaveApproval.test.ts`):
  - `approveLeaveRequest — PENDING → APPROVED, pendingDays−=, usedDays+=`
  - `approveLeaveRequest — records approvedById and optional comment`
  - `approveLeaveRequest — writes AuditLog entry`
  - `approveLeaveRequest — 404 if request not found`
  - `approveLeaveRequest — 403 if MANAGER is on a different team`
  - `approveLeaveRequest — MANAGER on same team can approve`
  - `approveLeaveRequest — HR_ADMIN can approve regardless of team`
  - `approveLeaveRequest — 422 if actor is approving own request`
  - `approveLeaveRequest — 422 if status is not PENDING`
  - `rejectLeaveRequest — PENDING → REJECTED, pendingDays−=`
  - `rejectLeaveRequest — 422 if comment is empty`
  - `rejectLeaveRequest — 403 if MANAGER on different team`
  - `approveCancellation — CANCEL_REQUESTED → CANCELLED, usedDays−=`
  - `approveCancellation — 422 if status not CANCEL_REQUESTED`
  - `rejectCancellation — CANCEL_REQUESTED → APPROVED`
  - `rejectCancellation — 422 if comment missing`
  - `cancelLeaveRequest — APPROVED → CANCEL_REQUESTED`
  - `cancelLeaveRequest — PENDING → CANCELLED still works`
  - `getSubordinatePendingRequests — MANAGER sees only same-team PENDING + CANCEL_REQUESTED`
  - `getSubordinatePendingRequests — MANAGER does not see own requests`
  - `getSubordinatePendingRequests — HR_ADMIN sees all PENDING + CANCEL_REQUESTED`
  - `getSubordinatePendingRequests — MANAGER on team with no pending returns empty array`

- **Steps:**
  1. Write all tests (expect all to fail)
  2. Run tests to confirm failure
  3. Apply schema changes; run `prisma db push --force-reset` against test DB
  4. Update `cancelLeaveRequest` in `leaveRequest.service.ts`
  5. Create `leaveApproval.service.ts` with all five functions
  6. Run tests to confirm all pass

---

## Phase 5-B: API Routes

- **Objective:** Expose approval actions, manager pending list, and HR user-identity management (team/title) via REST endpoints.

- **Files/Functions to Modify/Create:**
  - `server/src/routes/leaveApproval.ts` (new)
    - `POST /:id/approve` — `requireRole("MANAGER","HR_ADMIN")`
    - `POST /:id/reject` — `requireRole("MANAGER","HR_ADMIN")`
    - `POST /:id/approve-cancellation` — `requireRole("MANAGER","HR_ADMIN")`
    - `POST /:id/reject-cancellation` — `requireRole("MANAGER","HR_ADMIN")`
  - `server/src/routes/managerLeaveRequests.ts` (new)
    - `GET /` — `requireRole("MANAGER","HR_ADMIN")`; calls `getSubordinatePendingRequests`
  - `server/src/routes/users.ts` (new)
    - `GET /` — `requireRole("HR_ADMIN")`; list all users with team/title
    - `PATCH /:id/identity` — `requireRole("HR_ADMIN")`; update `team`, `title`
  - `server/src/routes/index.ts`
    - Mount `leaveApproval` at `/leave-requests`
    - Mount `managerLeaveRequests` at `/manager/leave-requests`
    - Mount `users` at `/users`

- **Tests to Write:**
  - `server/src/__tests__/leaveApproval.route.test.ts`
    - `POST /approve — 401 without auth`
    - `POST /approve — 403 for EMPLOYEE`
    - `POST /approve — 403 for MANAGER on different team`
    - `POST /approve — 200 for MANAGER on same team`
    - `POST /approve — 200 for HR_ADMIN on any team`
    - `POST /reject — 400 if comment missing`
    - `POST /reject — 200 with comment`
    - `POST /approve-cancellation — 200 for authorised manager`
    - `POST /approve-cancellation — 422 if not CANCEL_REQUESTED`
    - `POST /reject-cancellation — 400 if comment missing`
    - `POST /reject-cancellation — 200, reverts to APPROVED`
    - `GET /manager/leave-requests — 401 without auth`
    - `GET /manager/leave-requests — 403 for EMPLOYEE`
    - `GET /manager/leave-requests — 200 same-team only for MANAGER`
    - `GET /manager/leave-requests — 200 all for HR_ADMIN`
  - `server/src/__tests__/users.route.test.ts`
    - `PATCH /users/:id/identity — 401 without auth`
    - `PATCH /users/:id/identity — 403 for non-HR_ADMIN`
    - `PATCH /users/:id/identity — 200 updates team and title`
    - `PATCH /users/:id/identity — 404 for non-existent user`
    - `GET /users — 200 returns all users with team/title for HR_ADMIN`
    - `GET /users — 403 for MANAGER/EMPLOYEE`

- **Steps:**
  1. Write failing route tests
  2. Create `leaveApproval.ts`, `managerLeaveRequests.ts`, `users.ts`
  3. Update `index.ts`
  4. Run tests to confirm all pass

---

## Phase 5-C: Approval & User Management UI + Full Navigation Wiring

- **Objective:** First phase to make the app fully navigable end-to-end. Create Navbar with role-conditional links, wire all existing and new pages into App.tsx with role guards, build Pending Approvals page and HR User Management page. Token persistence also addressed.

- **Files/Functions to Modify/Create:**
  - `client/src/components/Navbar.tsx` (new)
    - Persistent top navigation bar
    - Links: Dashboard (all), Apply Leave (EMPLOYEE | MANAGER), Pending Approvals (MANAGER | HR_ADMIN), Leave Types (HR_ADMIN), User Management (HR_ADMIN), Calendar (all)
    - Shows user name, role badge, logout button
  - `client/src/components/ProtectedRoute.tsx` (new or promote from App.tsx)
    - Extended to support `allowedRoles` prop in addition to `isAuthenticated`
    - Redirects unauthorised roles to `/dashboard` with a toast/message
  - `client/src/App.tsx`
    - Wire all routes: `/dashboard`, `/apply-leave`, `/admin/leave-types`, `/admin/users`, `/manager/pending-approvals`, `/calendar`
    - Role guards: `/admin/*` = HR_ADMIN only; `/manager/*` = MANAGER | HR_ADMIN; others = any authenticated
  - `client/src/lib/api.ts`
    - Add all leave-type, leave-request, and balance functions (replace raw `apiClient` calls in pages with typed functions)
    - `getManagerPendingRequests()`, `approveLeaveRequest(id, comment?)`, `rejectLeaveRequest(id, comment)`, `approveCancellation(id)`, `rejectCancellation(id, comment)`
    - `getAllUsers()`, `updateUserIdentity(id, {team, title})`
  - `client/src/contexts/AuthContext.tsx`
    - Persist refresh token in `localStorage` so page refresh doesn't log user out
    - On app load, attempt token refresh if `localStorage` has a refresh token
  - `client/src/pages/manager/PendingApprovalsPage.tsx` (new)
    - Table of PENDING + CANCEL_REQUESTED requests from own team (or all for HR_ADMIN)
    - Approve button with optional inline comment
    - Reject button opens modal requiring comment
    - Separate section for CANCEL_REQUESTED with "Approve Cancellation" / "Reject Cancellation"
  - `client/src/pages/admin/UserManagementPage.tsx` (new)
    - Table of all users: name, email, role, team, title
    - Inline-editable team and title per row; save via `PATCH /api/users/:id/identity`

- **Tests to Write:** None (no client test setup); clean `tsc --noEmit` is the acceptance criterion.

- **Steps:**
  1. Persist refresh token in `AuthContext` (localStorage)
  2. Build `Navbar.tsx` with role-conditional links
  3. Extend `ProtectedRoute` with `allowedRoles`
  4. Wire all routes in `App.tsx`
  5. Extend `api.ts` with all typed functions
  6. Build `PendingApprovalsPage.tsx`
  7. Build `UserManagementPage.tsx`
  8. Run `tsc --noEmit` in client — must be clean

---

## Phase 5-D: Leave Calendar

- **Objective:** `/calendar` tab visible to all authenticated users. EMPLOYEE sees own leaves; MANAGER sees own team's leaves; HR_ADMIN sees all. Events colour-coded by status.

- **Files/Functions to Modify/Create:**
  - `server/src/routes/leaveCalendar.ts` (new)
    - `GET /api/leave-calendar?year=&month=`
    - Applies same team-scope logic as approval service
    - Returns `{ id, employeeName, team, leaveTypeName, startDate, endDate, status }`
  - `server/src/routes/index.ts` — mount at `/leave-calendar`
  - `client/src/lib/api.ts` — `getLeaveCalendar(year, month)`
  - `client/src/pages/LeaveCalendarPage.tsx` (new)
    - CSS-grid month calendar (no external calendar library)
    - Coloured chips per status: PENDING=amber, APPROVED=green, CANCEL_REQUESTED=orange, REJECTED=red, CANCELLED=grey
    - Month navigation (prev/next)
    - Click chip → tooltip/popover with leave details
  - `client/src/App.tsx` — `/calendar` route (all authenticated)
  - `client/src/components/Navbar.tsx` — Calendar link for all roles

- **Tests to Write** (`server/src/__tests__/leaveCalendar.route.test.ts`):
  - `GET /leave-calendar — 401 without auth`
  - `GET /leave-calendar — EMPLOYEE sees only own leaves`
  - `GET /leave-calendar — MANAGER sees only same-team leaves`
  - `GET /leave-calendar — HR_ADMIN sees all leaves`
  - `GET /leave-calendar — filters correctly by year and month`

- **Steps:**
  1. Write failing calendar route tests
  2. Create `leaveCalendar.ts` route + mount in `index.ts`
  3. Run route tests to confirm pass
  4. Build `LeaveCalendarPage.tsx`
  5. Wire route + nav
  6. Run client `tsc --noEmit`

---

## Summary

| Sub-phase | Scope | Est. new tests | Running total |
|---|---|---|---|
| 5-A | Schema migration + approval service | ~22 | ~125 |
| 5-B | 5 approval routes + user identity routes | ~21 | ~146 |
| 5-C | Approval UI + User Management UI | — | ~146 |
| 5-D | Calendar API + Calendar UI | ~5 | ~151 |
