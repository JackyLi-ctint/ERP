## Phase 7 Complete: Dashboard Polish & Hardening

Completed final polish and hardening across server and client. This phase tightened validation and error safety, improved dashboard and workflow UX, and resolved all review findings. All tests and type checks pass.

**Files created/changed:**
- `server/src/app.ts`
- `server/src/lib/asyncHandler.ts`
- `server/src/routes/leaveRequests.ts`
- `server/src/routes/users.ts`
- `server/src/routes/leaveApproval.ts`
- `server/src/routes/leaveTypes.ts`
- `server/src/__tests__/leaveRequest.submit.test.ts`
- `server/src/__tests__/users.route.test.ts`
- `client/src/lib/api.ts`
- `client/src/pages/DashboardPage.tsx`
- `client/src/pages/ApplyLeavePage.tsx`
- `client/src/pages/manager/PendingApprovalsPage.tsx`
- `client/src/pages/admin/UserManagementPage.tsx`
- `client/src/pages/admin/LeaveTypesPage.tsx`

**Functions created/changed:**
- `asyncHandler` shared mapper now handles leave-type conflict/validation patterns and sanitizes unknown 500s
- `PATCH /api/users/:id` role update route (HR_ADMIN only)
- `LeaveTypesPage` now uses typed API functions (`getLeaveTypes`, `createLeaveType`, `updateLeaveType`, `reactivateLeaveType`) without `as any`
- Dashboard quick actions, pending approvals count, recent requests section, and balance warning colors
- ApplyLeavePage balance-aware leave type labels, date min constraints, conditional attachment URL field, and slip links
- PendingApprovalsPage submitted date column, slip links, approve confirmation, comment max length

**Tests created/changed:**
- Added reason length test in `leaveRequest.submit.test.ts` (reason > 500 returns 400)
- Added identity length test in `users.route.test.ts` (team > 100 returns 400)
- Added role-update route tests in `users.route.test.ts`:
  - 401 without auth
  - 403 for MANAGER
  - 404 for missing user
  - 400 invalid role
  - 200 successful role update

**Review Status:** APPROVED

**Validation:**
- Server tests: `209 passed, 209 total`
- Server typecheck: clean (`npx tsc --noEmit`)
- Client typecheck: clean (`npx tsc --noEmit`)

**Git Commit Message:**
```
feat: dashboard polish and app hardening

- Add JSON body limit and global API rate limit safeguards
- Enforce max-length validation on reason/team/title/comment/name
- Sanitize unknown 500 responses via shared asyncHandler
- Add PATCH /api/users/:id role update with enum validation
- Polish Dashboard with quick actions, pending count, and recent requests
- Improve ApplyLeave and PendingApprovals UX with slip links and constraints
- Refactor LeaveTypesPage to typed API calls + deactivate confirm/reactivate
- Add hardening tests and role-update route tests; 209/209 passing
```
