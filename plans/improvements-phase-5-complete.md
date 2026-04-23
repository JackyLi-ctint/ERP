## Phase 5 Complete: DB Performance & Pagination

Fixed the N+1 query in `initBalances` by replacing the nested for-loop with a single batched `createMany({ skipDuplicates: true })` call. Added offset-based pagination to `GET /api/users` (returning `{ users, total, page, pageSize }`) and `GET /manager/leave-requests` (returning `{ leaveRequests, page, pageSize }`), with `pageSize` capped at `config.pagination.maxSize` (default 100).

**Files created/changed:**
- `server/src/services/leaveBalance.service.ts`
- `server/src/routes/users.ts`
- `server/src/services/leaveApproval.service.ts`
- `server/src/routes/managerLeaveRequests.ts`
- `server/src/__tests__/leaveBalance.init.test.ts`
- `server/src/__tests__/users.route.test.ts`
- `server/src/__tests__/leaveApproval.test.ts`

**Functions created/changed:**
- `initBalances` — replaced N+1 nested loops with `Promise.all` + single `createMany({ skipDuplicates: true })`
- `GET /api/users` route handler — added `paginationQuerySchema`, `skip/take`, parallel `[findMany, count]`, returns `{ users, total, page, pageSize }`
- `getSubordinatePendingRequests` — added optional `options?: { skip?: number; take?: number }` parameter passed through to both Prisma `findMany` calls
- `GET /manager/leave-requests` route handler — added `paginationQuerySchema`, `skip/take` capped at `config.pagination.maxSize`, passes to service

**Tests created/changed:**
- `leaveBalance.init.test.ts`: "should use a single batched createMany rather than N individual inserts" (spy on `prisma.leaveBalance.createMany`, expects exactly 1 call)
- `users.route.test.ts`: "should return paginated first page with total when pageSize specified"
- `users.route.test.ts`: "should return second page of users"
- `users.route.test.ts`: "should cap pageSize at config pagination max"
- `leaveApproval.test.ts`: "test 23: respects take option to limit results"

**Review Status:** APPROVED

**Git Commit Message:**
```
perf: fix N+1 in initBalances and add pagination to list endpoints

- Replace nested for-loop in initBalances with single createMany (skipDuplicates)
- Add ?page=&pageSize= to GET /api/users, returning { users, total, page, pageSize }
- Add pagination to GET /manager/leave-requests via getSubordinatePendingRequests skip/take
- Cap pageSize at config.pagination.maxSize (default 100)
- 277 tests passing (26 suites)
```
