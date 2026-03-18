## Phase 5-D Complete: Leave Calendar

Added a monthly leave calendar visible to all roles. The backend provides a role-scoped API endpoint and the frontend renders a CSS-grid calendar with colour-coded leave chips per day.

**Files created/changed:**
- `server/src/routes/leaveCalendar.ts` (new — GET /api/leave-calendar?year=&month= with EMPLOYEE/MANAGER/HR_ADMIN scope)
- `server/src/__tests__/leaveCalendar.route.test.ts` (new — 13 tests)
- `server/src/routes/index.ts` (updated — mounts leaveCalendarRouter at /leave-calendar)
- `client/src/pages/LeaveCalendarPage.tsx` (new — CSS-grid calendar with colour-coded chips)
- `client/src/lib/api.ts` (updated — CalendarEntry interface + getLeaveCalendar())
- `client/src/App.tsx` (updated — /calendar route, all authenticated roles)
- `client/src/components/Navbar.tsx` (updated — Calendar link for all roles)

**Functions created/changed:**
- `leaveCalendarRouter` — GET handler with role-scoped Prisma query, date range filtering, status exclusion (DRAFT/CANCELLED excluded)
- `getLeaveCalendar(year, month)` in api.ts
- `getEntriesForDay()` in LeaveCalendarPage — consistently UTC date comparison (fix for negative UTC offset edge case)
- `LeaveCalendarPage` — month navigation, 7-col CSS grid, chip colours: PENDING=amber, APPROVED=green, CANCEL_REQUESTED=orange, REJECTED=red

**Tests created/changed:**
- 13 new tests: auth guard, param validation (missing/out-of-range), EMPLOYEE scope, MANAGER team scope, HR_ADMIN global, status exclusion, date range exclusion, response shape

**Review Status:** APPROVED — 2 minor issues fixed (removed unused `team` select from response mapping; fixed mixed UTC/local date methods in `getEntriesForDay`)

**Git Commit Message:**
```
feat: leave calendar with role-scoped API and monthly grid UI

- GET /api/leave-calendar?year=&month= (all authenticated roles)
- EMPLOYEE: own requests; MANAGER: team requests; HR_ADMIN: all
- Excludes DRAFT and CANCELLED; date-range aware
- LeaveCalendarPage: CSS-grid with month navigation and colour chips
- Chip colours: PENDING=amber, APPROVED=green, CANCEL_REQUESTED=orange, REJECTED=red
- 13 new tests; 166/166 total passing
```
