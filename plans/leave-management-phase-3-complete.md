## Phase 3 Complete: Leave Type Configuration & Balance Ledger

HR Admin can now create, update, and deactivate leave types via a CRUD API and a polished UI. Annual leave balances are initialized per-employee per-type using an idempotent service. Employees query their own balances; HR Admin can query any user. 28 new tests bring total to 81/81.

**Files created/changed:**
- `server/prisma/schema.prisma` — `LeaveType` and `LeaveBalance` models added; `onDelete: Restrict` on `LeaveType.createdBy`
- `server/src/routes/leaveTypes.ts` — full CRUD (HR_ADMIN guards); `GET /` shows all types for HR_ADMIN, active-only for others
- `server/src/services/leaveBalance.service.ts` — `initBalances`, `getBalancesForUser`, `getBalanceForType`
- `server/src/routes/leaveBalance.ts` — `GET /api/me/balances`, `GET /api/users/:id/balances`
- `client/src/pages/admin/LeaveTypesPage.tsx` — table + create/edit dialog + deactivate (NEW)
- `client/src/contexts/AuthContext.tsx` — fixed unused import/variable TS errors
- `client/src/pages/DashboardPage.tsx` — removed unused React import
- `server/src/__tests__/leaveTypes.test.ts` — 12 tests (NEW); afterAll cleanup added
- `server/src/__tests__/leaveBalance.init.test.ts` — 4 tests (NEW); afterAll cleanup added
- `server/src/__tests__/leaveBalance.query.test.ts` — 8 tests (NEW); afterAll cleanup added; removed unused `employee2Token`

**Functions created/changed:**
- `initBalances(year, prisma): Promise<{ created, skipped }>`
- `getBalancesForUser(userId, year, prisma): Promise<LeaveBalance[]>`
- `getBalanceForType(userId, leaveTypeId, year, prisma): Promise<LeaveBalance | null>`
- `GET /api/leave-types` (role-aware active filter)
- `POST /api/leave-types` (HR_ADMIN, 409/422 guards)
- `PATCH /api/leave-types/:id` (HR_ADMIN)
- `DELETE /api/leave-types/:id` (soft-delete, HR_ADMIN)
- `GET /api/me/balances?year=`
- `GET /api/users/:id/balances?year=` (HR_ADMIN only)

**Tests created/changed:**
- CRUD auth guards: employee/manager blocked from create/edit/delete
- HR Admin can create, update, deactivate
- Duplicate name → 409, defaultDays ≤ 0 → 422
- Deactivated type not returned to non-admins
- Balance init: all users × active types created
- Balance init idempotent (skip existing rows)
- Inactive leave types excluded from init
- Employee sees own balances only; HR Admin sees any user

**Review Status:** APPROVED

**Git Commit Message:**
```
feat: leave type CRUD and balance ledger

- Add LeaveType and LeaveBalance Prisma models
- CRUD routes for leave types with HR_ADMIN guards
- GET /leave-types returns all types for HR_ADMIN, active-only otherwise
- initBalances service: idempotent per user×type×year
- Balance query routes: self and HR Admin cross-user access
- LeaveTypesPage.tsx with table, create/edit dialog, deactivate
- Fix client TypeScript errors (unused imports, z.boolean resolver)
- 28 new tests; 81/81 total passing
```
