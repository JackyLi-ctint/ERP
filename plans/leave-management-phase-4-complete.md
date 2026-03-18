## Phase 4 Complete: Leave Application Submission

Leave request submission, listing, and cancellation are fully implemented with all business rules, atomic balance transactions, and a clean split-router architecture. TypeScript compiles cleanly and all 103 tests pass.

**Files created/changed:**
- `server/prisma/schema.prisma` — `LeaveStatus` enum + `LeaveRequest` model with FK relations and indexes
- `server/src/services/leaveRequest.service.ts` — `submitLeaveRequest`, `cancelLeaveRequest`, `getLeaveRequestsForUser`
- `server/src/routes/leaveRequests.ts` — split into `leaveRequestsRouter` (POST /, DELETE /:id) and `meLeaveRequestsRouter` (GET /)
- `server/src/routes/index.ts` — separate mounts: `/me/leave-requests` → `meLeaveRequestsRouter`, `/leave-requests` → `leaveRequestsRouter`
- `server/src/__tests__/leaveRequest.submit.test.ts` — 16 tests for submit business rules
- `server/src/__tests__/leaveRequest.cancel.test.ts` — 6 tests for cancel logic
- `client/src/pages/employee/ApplyLeavePage.tsx` — leave submission form
- `client/src/components/LeaveDurationPreview.tsx` — client-side working-day preview

**Functions created/changed:**
- `submitLeaveRequest(data, prisma)` — validates dates, balance, overlap; atomic create + pendingDays increment
- `cancelLeaveRequest(id, userId, prisma)` — validates ownership/status; atomic CANCELLED + pendingDays decrement
- `getLeaveRequestsForUser(userId, { status?, year? }, prisma)` — filtered listing with leaveType name
- `leaveRequestsRouter` — POST / and DELETE /:id handlers
- `meLeaveRequestsRouter` — GET / handler with isNaN year guard, Prisma-typed status validation

**Tests created/changed:**
- `POST /api/leave-requests` — 401, valid full-day, half-day AM/PM, insufficient balance, overlap PENDING/APPROVED, past date, 0 working days, missing balance, non-existent leave type, startDate > endDate, halfDay on multi-day (16 tests)
- `DELETE /api/leave-requests/:id` — 401, owner cancel PENDING, non-owner 403, cancel APPROVED 422, cancel CANCELLED 422, 404 (6 tests)

**Review Status:** APPROVED

**Git Commit Message:**
```
feat: leave application submission with business rules

- Add LeaveRequest model with LeaveStatus enum in Prisma schema
- submit/cancel service with atomic balance transactions
- POST /api/leave-requests, GET /api/me/leave-requests, DELETE /api/leave-requests/:id
- Split router architecture: meLeaveRequestsRouter + leaveRequestsRouter
- isNaN year guard, Prisma-typed VALID_STATUSES, typed req.user access
- ApplyLeavePage.tsx and LeaveDurationPreview.tsx
- 22 new tests; 103/103 total passing
```
