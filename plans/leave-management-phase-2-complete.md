## Phase 2 Complete: HK Holiday Registry & Working Day Calculator

HK official public holidays for 2025–2027 are seeded and the core working-day calculation service is implemented. All leave duration logic (weekend exclusion, holiday exclusion, half-day support) is tested with 28 new tests bringing the total to 53/53.

**Files created/changed:**
- `server/prisma/schema.prisma` — added `PublicHoliday` model with `@@unique([date])` and `@@index([year])`
- `server/prisma/seed.ts` — 50 HK public holidays for 2025/2026/2027 including Mid-Autumn substitute days
- `server/src/seed/hkHolidays.ts` — holiday list (sourced by seed)
- `server/src/lib/prisma.ts` — shared Prisma singleton (new)
- `server/src/services/workingDays.service.ts` — `isWeekend`, `isPublicHoliday`, `countWorkingDays`, `getHolidaySet` (all UTC-safe)
- `server/src/routes/holidays.ts` — `GET /api/holidays?year=` with auth + year bounds validation
- `server/src/__tests__/workingDays.test.ts` — 19 unit tests (no DB)
- `server/src/__tests__/holidays.route.test.ts` — 9 integration tests incl. 4 validation boundary cases

**Functions created/changed:**
- `isWeekend(date: Date): boolean`
- `isPublicHoliday(date: Date, holidays: Set<string>): boolean`
- `countWorkingDays(start, end, holidays, halfDay?, period?): number`
- `getHolidaySet(year, prismaClient): Promise<Set<string>>`
- `GET /api/holidays?year=YYYY` route handler

**Tests created/changed:**
- Full week Mon–Fri = 5 days
- Weekends excluded
- HK public holiday excluded (0 days)
- Half-day AM/PM = 0.5 days
- Single non-holiday = 1 day
- Cross-month span (Oct 1 National Day excluded)
- Cross-year span (Jan 1 New Year excluded)
- start > end returns 0
- Saturday/Sunday alone returns 0
- Year validation: 1999, 2101, abc, no-param → 400
- Auth required (401 without token)
- Year filtering (only requested year returned)

**Review Status:** APPROVED

**Git Commit Message:**
```
feat: HK holiday registry and working-day calculator

- Add PublicHoliday model with unique date constraint and year index
- Seed 50 HK statutory holidays for 2025–2027 (incl. Mid-Autumn subs)
- Implement countWorkingDays service with UTC-safe date handling
- Add GET /api/holidays?year= endpoint with auth and year validation
- Create shared Prisma singleton at server/src/lib/prisma.ts
- 28 new tests (unit + integration); 53/53 total passing
```
