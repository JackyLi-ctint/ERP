## Phase 5-B Complete: Approval Workflow & User Identity API Routes

Added all API routes for the team-based approval workflow and HR user identity management. Extracted shared `asyncHandler` utility and fixed type safety issues identified in code review.

**Files created/changed:**
- `server/src/lib/asyncHandler.ts` (new — shared error→HTTP mapping utility)
- `server/src/routes/leaveApproval.ts` (new — approval action endpoints)
- `server/src/routes/managerLeaveRequests.ts` (new — manager's pending-requests view)
- `server/src/routes/users.ts` (new — user identity management for HR)
- `server/src/routes/index.ts` (updated — mounts 3 new routers)
- `server/src/routes/leaveRequests.ts` (updated — imports shared asyncHandler)
- `server/src/__tests__/leaveApproval.route.test.ts` (new — 17 tests)
- `server/src/__tests__/users.route.test.ts` (new — 10 tests)

**Functions created/changed:**
- `asyncHandler` (lib/asyncHandler.ts) — unified error→HTTP mapper shared by all route files
- `leaveApprovalRouter` — POST /:id/approve, POST /:id/reject, POST /:id/approve-cancellation, POST /:id/reject-cancellation
- `managerLeaveRequestsRouter` — GET / (team-scoped PENDING + CANCEL_REQUESTED list)
- `usersRouter` — GET / (all users, safe fields), PATCH /:id/identity (team + title)

**Tests created/changed:**
- leaveApproval.route.test.ts: approve/reject with valid roles, self-approval guard, team scope, cancellation approval/rejection
- users.route.test.ts: list users (HR_ADMIN only), update identity (validation, 404, partial update)

**Review Status:** APPROVED (3 minor issues addressed — asyncHandler extracted, `as any` → `as Role`, `.strict()` added to identitySchema)

**Git Commit:** `ee08ba3`
