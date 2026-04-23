# Plan: Major ERP Project Improvements (v2)

The audit identified issues across RBAC consistency, configurability, error handling, validation, database performance, frontend security, observability, and audit trail completeness. This plan addresses all findings in priority order, each phase following TDD principles.

**Phases (8 total)**

1. **Phase 1: RBAC & Role Enum Consistency**
    - **Objective:** Eliminate all hardcoded `"HR_ADMIN"`, `"MANAGER"`, `"EMPLOYEE"` string literals. Replace with the Prisma `Role` enum and a single exported `SUPERUSER_ROLES` constant so superuser membership is configurable in one place.
    - **Files/Functions to Modify/Create:**
      - [server/src/middleware/requireRole.ts](../server/src/middleware/requireRole.ts) — export `SUPERUSER_ROLES: Role[]`; use `SUPERUSER_ROLES.includes(req.user.role)` instead of `=== "HR_ADMIN"`
      - [server/src/routes/leaveTypes.ts](../server/src/routes/leaveTypes.ts) — remove `as any` cast at L38; use `req.user!.role === Role.HR_ADMIN`
      - [server/src/routes/leaveRequestDetail.ts](../server/src/routes/leaveRequestDetail.ts) — replace inline `actorRole === "EMPLOYEE"` / `"MANAGER"` string comparisons with `Role` enum
      - [server/src/routes/leaveCalendar.ts](../server/src/routes/leaveCalendar.ts) — replace string literals with `Role` enum at L58–72
      - [server/src/services/leaveApproval.service.ts](../server/src/services/leaveApproval.service.ts) — use `Role.HR_ADMIN` at L25 and L389; fix `leaveType: any` return type
      - [server/src/services/leaveRequest.service.ts](../server/src/services/leaveRequest.service.ts) — use `Role.MANAGER`, `Role.HR_ADMIN` in `findMany` queries at L189, L197
      - [server/src/routes/users.ts](../server/src/routes/users.ts) — replace `const updateData: any = {}` (L179) with `Prisma.UserUpdateInput` typed accumulator
    - **Tests to Write:**
      - `SUPERUSER_ROLES includes HR_ADMIN and passes all role checks`
      - `adding a second role to SUPERUSER_ROLES grants it bypass access`
      - `non-superuser with correct role is permitted`
      - `non-superuser with wrong role is forbidden`
    - **Steps:**
        1. Write failing tests for `SUPERUSER_ROLES` behaviour in `requireRole.test.ts`
        2. Update `requireRole.ts`: export `SUPERUSER_ROLES`, replace hardcoded string
        3. Run tests to confirm they pass
        4. Replace all remaining `"HR_ADMIN"` / `"MANAGER"` / `"EMPLOYEE"` string literals with `Role` enum across routes and services
        5. Run full server test suite to confirm no regressions

2. **Phase 2: Central Config Module**
    - **Objective:** Create a validated `server/src/config.ts` that reads all magic numbers and environment values in one place. Consumers import from config rather than reading `process.env` ad-hoc or using inline literals.
    - **Files/Functions to Modify/Create:**
      - **Create** [server/src/config.ts](../server/src/config.ts) — export typed, defaulted config object with: `bcryptRounds`, `rateLimitAuth.max/windowMs`, `rateLimitApi.max/windowMs`, `uploadMaxBytes`, `bodyLimit`, `pagination.defaultSize/maxSize`, `corsOrigins: string[]` (split `CORS_ORIGIN` on commas), `azureStateTtlMs`
      - [server/src/app.ts](../server/src/app.ts) — consume `config.rateLimitAuth`, `config.rateLimitApi`, `config.bodyLimit`, `config.corsOrigins`
      - [server/src/middleware/upload.ts](../server/src/middleware/upload.ts) — consume `config.uploadMaxBytes`
      - [server/src/services/auth.service.ts](../server/src/services/auth.service.ts) — consume `config.bcryptRounds`
      - [server/src/routes/users.ts](../server/src/routes/users.ts) — consume `config.bcryptRounds` (3 call sites at L100, L151, L201)
      - [server/src/routes/adminLeaveRequests.ts](../server/src/routes/adminLeaveRequests.ts) — consume `config.pagination`
      - [server/src/routes/adminAuditLogs.ts](../server/src/routes/adminAuditLogs.ts) — consume `config.pagination`
      - [server/src/services/azureAd.service.ts](../server/src/services/azureAd.service.ts) — consume `config.azureStateTtlMs`
    - **Tests to Write:**
      - `config reads BCRYPT_ROUNDS from env when set`
      - `config falls back to default 12 when BCRYPT_ROUNDS is not set`
      - `config.corsOrigins splits CORS_ORIGIN on commas`
      - `config.uploadMaxBytes defaults to 1MB when env var not set`
      - `config.pagination.maxSize is respected as a hard cap`
    - **Steps:**
        1. Write failing config unit tests
        2. Create `config.ts` with all fields, env reads, and defaults
        3. Run config tests to confirm they pass
        4. Update each consumer (`app.ts`, `upload.ts`, `auth.service.ts`, `users.ts`, `adminLeaveRequests.ts`, `adminAuditLogs.ts`, `azureAd.service.ts`)
        5. Run full test suite to confirm no regressions

3. **Phase 3: Error Handling Consolidation**
    - **Objective:** Introduce a typed `AppError` class and a single `asyncHandler`. Remove the two duplicate `asyncHandler` implementations in `auth.ts` and `leaveBalance.ts`, and replace the global error handler's fragile string-matching with `instanceof AppError`.
    - **Files/Functions to Modify/Create:**
      - **Create** [server/src/lib/AppError.ts](../server/src/lib/AppError.ts) — `class AppError extends Error { statusCode: number; code: string }`
      - [server/src/lib/asyncHandler.ts](../server/src/lib/asyncHandler.ts) — update to pass `AppError` instances with their `statusCode`; pass `500` for everything else
      - [server/src/app.ts](../server/src/app.ts) — replace string-matching error handler with `if (err instanceof AppError)` check
      - [server/src/routes/auth.ts](../server/src/routes/auth.ts) — delete local `asyncHandler` (L14–28); import from `lib/asyncHandler.ts`; update service call sites to throw `AppError`
      - [server/src/routes/leaveBalance.ts](../server/src/routes/leaveBalance.ts) — delete local `asyncHandler` (L8–21); import shared one
      - [server/src/routes/holidays.ts](../server/src/routes/holidays.ts) — replace manual `try/catch` blocks with `asyncHandler`
      - [server/src/services/auth.service.ts](../server/src/services/auth.service.ts) — throw `new AppError("...", 401, "UNAUTHORIZED")` / `AppError(..., 403, "FORBIDDEN")` instead of `new Error("Unauthorized…")`
    - **Tests to Write:**
      - `AppError carries statusCode and code fields`
      - `asyncHandler forwards AppError.statusCode to response`
      - `asyncHandler returns 500 for unexpected errors`
      - `global error handler maps AppError.statusCode correctly`
      - `error whose message incidentally contains "Unauthorized" is not misclassified as 401`
    - **Steps:**
        1. Write failing tests for `AppError` and updated `asyncHandler`
        2. Create `AppError.ts`
        3. Update `asyncHandler.ts` and global error handler in `app.ts`
        4. Run tests to confirm they pass
        5. Delete duplicate `asyncHandler` copies from `auth.ts` and `leaveBalance.ts`
        6. Update services to throw `AppError`
        7. Run full test suite

4. **Phase 4: Validation Consistency**
    - **Objective:** All route boundaries validate input with Zod. Eliminate raw `parseInt`, `as string` casts, and manual presence checks at the route layer.
    - **Files/Functions to Modify/Create:**
      - [server/src/routes/auth.ts](../server/src/routes/auth.ts) — add `loginSchema` and `registerSchema` Zod parse at route boundary (before calling service)
      - [server/src/routes/holidays.ts](../server/src/routes/holidays.ts) — replace `parseInt(req.query.year as string)` with `z.coerce.number().int().min(2000).max(2100)`
      - [server/src/routes/leaveBalance.ts](../server/src/routes/leaveBalance.ts) — replace manual year parse with Zod coerce schema
      - [server/src/routes/leaveCalendar.ts](../server/src/routes/leaveCalendar.ts) — replace multi-branch `parseInt` + `isNaN` logic for `year`, `month` with a single Zod object schema
    - **Tests to Write:**
      - `POST /auth/login with missing email returns 400`
      - `POST /auth/register with password shorter than 8 chars returns 400`
      - `GET /holidays with non-numeric year returns 400`
      - `GET /holidays without year param returns 400`
      - `GET /leave-calendar with month out of range (0 or 13) returns 400`
    - **Steps:**
        1. Write failing route-level validation tests
        2. Add Zod schemas to `auth.ts` route boundary
        3. Update `holidays.ts`, `leaveBalance.ts`, `leaveCalendar.ts` to use Zod coerce
        4. Run tests to confirm they pass

5. **Phase 5: Database Performance & Pagination**
    - **Objective:** Fix the N+1 query in `initBalances`. Add offset-based pagination to the two unbounded list endpoints (`GET /api/users`, `GET /manager/leave-requests`).
    - **Files/Functions to Modify/Create:**
      - [server/src/services/leaveBalance.service.ts](../server/src/services/leaveBalance.service.ts) — replace nested `for` loop pattern with `prisma.leaveBalance.createMany({ data: [...], skipDuplicates: true })`
      - [server/src/routes/users.ts](../server/src/routes/users.ts) — add `?page=1&pageSize=50` query params; return `{ users, total, page, pageSize }`
      - [server/src/routes/managerLeaveRequests.ts](../server/src/routes/managerLeaveRequests.ts) — add `?page=1&pageSize=50`; propagate `skip`/`take` into `getSubordinatePendingRequests`
      - [server/src/services/leaveApproval.service.ts](../server/src/services/leaveApproval.service.ts) — add `skip`/`take` params to `getSubordinatePendingRequests`; apply `config.pagination.maxSize` cap
    - **Tests to Write:**
      - `initBalances issues a single createMany call rather than N individual inserts`
      - `GET /api/users?page=1&pageSize=2 returns first 2 users and correct total`
      - `GET /api/users?page=2&pageSize=2 returns the next page`
      - `GET /api/users pageSize above config max is capped`
      - `GET /manager/leave-requests respects pageSize from config`
    - **Steps:**
        1. Write failing tests for `initBalances` call count and for pagination responses
        2. Fix `initBalances` to use `createMany`
        3. Add pagination to `users.ts` and `managerLeaveRequests.ts`
        4. Run tests to confirm they pass

6. **Phase 6: Frontend Security — HttpOnly Refresh Token Cookie**
    - **Objective:** Move the refresh token from `localStorage` (accessible to JavaScript, XSS risk) to an `HttpOnly; Secure; SameSite=Strict` cookie. Add a proactive token refresh timer so the access token is renewed before it expires.
    - **Files/Functions to Modify/Create:**
      - [server/src/routes/auth.ts](../server/src/routes/auth.ts) — `POST /auth/login` and `POST /auth/refresh` set `refreshToken` via `res.cookie(…, { httpOnly: true, secure: true, sameSite: 'strict' })`; remove `refreshToken` from JSON body; `POST /auth/logout` clears the cookie
      - [server/src/routes/auth.ts](../server/src/routes/auth.ts) — `GET /auth/azure/callback` sets the cookie on redirect
      - [client/src/lib/api.ts](../client/src/lib/api.ts) — remove `localStorage.getItem("refreshToken")`; call refresh endpoint with `credentials: 'include'` so browser sends the cookie automatically
      - [client/src/contexts/AuthContext.tsx](../client/src/contexts/AuthContext.tsx) — remove all `localStorage.setItem/getItem/removeItem` calls for `refreshToken`; add proactive refresh timer (decode JWT `exp`, schedule refresh 60 seconds before expiry)
    - **Tests to Write:**
      - `POST /auth/login response sets Set-Cookie header with HttpOnly flag`
      - `POST /auth/refresh reads cookie and returns new access token`
      - `POST /auth/logout clears the refreshToken cookie`
      - `POST /auth/refresh without cookie returns 401`
    - **Steps:**
        1. Write failing server-side cookie tests
        2. Update `auth.ts` login/refresh/logout to use `res.cookie` / `res.clearCookie`
        3. Run server tests to confirm they pass
        4. Write client-side unit tests for `AuthContext` proactive refresh timer
        5. Update `AuthContext.tsx` and `api.ts`
        6. Run client tests and E2E auth flow to confirm

7. **Phase 7: Structured Logging (Audit & Diagnosis)**
    - **Objective:** Replace all ad-hoc `console.log` / `console.error` calls with a structured JSON logger (`pino`). Every request gets a correlation ID (`requestId`) threaded through logs. Security-relevant events (login, logout, token refresh, role-check failures, leave approvals/rejections) emit dedicated audit log entries. All logs include `timestamp`, `level`, `requestId`, `userId` (where available), `method`, `path`, and `durationMs`.
    - **Files/Functions to Modify/Create:**
      - **Create** `server/src/lib/logger.ts` — singleton `pino` logger; `LOG_LEVEL` env var (default `info`); pretty-print in development, JSON in production (detected via `NODE_ENV`)
      - **Create** `server/src/middleware/requestLogger.ts` — Express middleware that generates a `requestId` (UUID v4), attaches it to `req`, starts a timer, and logs `request.start` and `request.end` (with `statusCode`, `durationMs`) for every request
      - [server/src/app.ts](../server/src/app.ts) — register `requestLogger` middleware early in the chain (before routes); update global error handler to call `logger.error` instead of `console.error`, including `requestId` and `err.stack`
      - [server/src/lib/AppError.ts](../server/src/lib/AppError.ts) *(Phase 3 dependency)* — no change needed; `AppError` already carries `statusCode` and `code` used by the logger
      - [server/src/routes/auth.ts](../server/src/routes/auth.ts) — emit audit events: `auth.login.success`, `auth.login.failure`, `auth.logout`, `auth.refresh.success`, `auth.refresh.failure` with `userId`, `email`, `ip`
      - [server/src/services/leaveApproval.service.ts](../server/src/services/leaveApproval.service.ts) — emit `leave.approved`, `leave.rejected`, `leave.cancelApproved`, `leave.cancelRejected` with `requestId`, `actorId`, `actorRole`, `leaveRequestId`, `employeeId`
      - [server/src/services/leaveRequest.service.ts](../server/src/services/leaveRequest.service.ts) — emit `leave.submitted`, `leave.cancelled` with `employeeId`, `leaveTypeId`, `startDate`, `endDate`
      - [server/src/middleware/requireRole.ts](../server/src/middleware/requireRole.ts) — emit `rbac.forbidden` log entry (level `warn`) when a role check fails, including `userId`, `userRole`, `requiredRoles`
      - [server/src/middleware/requireAuth.ts](../server/src/middleware/requireAuth.ts) — emit `auth.unauthorized` log entry (level `warn`) on JWT verification failure, including `ip`, `path`, `reason`
      - Replace all remaining `console.error` / `console.log` / `console.warn` calls across the codebase with `logger.error` / `logger.info` / `logger.warn`
    - **Tests to Write:**
      - `requestLogger middleware attaches requestId to req`
      - `requestLogger logs request.end with statusCode and durationMs`
      - `logger emits JSON with timestamp, level, requestId fields`
      - `auth.login.success event logged with userId and email on successful login`
      - `auth.login.failure event logged with email and ip on bad credentials`
      - `rbac.forbidden logged with userId and requiredRoles when role check fails`
      - `leave.approved event logged with actorId and leaveRequestId`
    - **Steps:**
        1. Install `pino` and `pino-pretty` as dependencies (`pino-pretty` as dev dep only)
        2. Write failing tests for `requestLogger` middleware and `logger` output shape
        3. Create `server/src/lib/logger.ts` and `server/src/middleware/requestLogger.ts`
        4. Register `requestLogger` in `app.ts`; run tests to confirm they pass
        5. Add audit log calls to `auth.ts` routes (login/logout/refresh)
        6. Add audit log calls to `leaveApproval.service.ts` and `leaveRequest.service.ts`
        7. Add `rbac.forbidden` and `auth.unauthorized` warn logs to `requireRole.ts` and `requireAuth.ts`
        8. Replace all `console.*` calls throughout the server codebase
        9. Run full test suite to confirm no regressions

8. **Phase 8: AuditLog Schema Extension & Employee Leave History**
    - **Objective:** Extend the `AuditLog` table to support unauthenticated events (nullable `actorId`, new `attemptedEmail` field) so failed logins can be persisted to the database. Add a scoped `GET /api/leave-requests/:id/history` endpoint so employees can see who approved or rejected their own requests, with a corresponding frontend history panel.
    - **Files/Functions to Modify/Create:**
      - [server/prisma/schema.prisma](../server/prisma/schema.prisma) — make `actorId String?` and `actor User?` (nullable relation); add `attemptedEmail String?` field; add `@@index([attemptedEmail])` for failed-login queries
      - **New migration** — `prisma migrate dev --name make-auditlog-actorid-nullable`
      - [server/src/routes/auth.ts](../server/src/routes/auth.ts) — on `LOGIN_FAILURE`: write `AuditLog` row with `actorId: null`, `attemptedEmail`, `action: "LOGIN_FAILURE"`, `entityType: "Auth"`, `entityId: attemptedEmail`, `after: { ip, reason }`; on `LOGIN_SUCCESS`: write row with `actorId: userId`, `action: "LOGIN_SUCCESS"`
      - [server/src/routes/adminAuditLogs.ts](../server/src/routes/adminAuditLogs.ts) — update `include: { actor: ... }` to handle `actor: null` gracefully; add `attemptedEmail` filter to `querySchema`
      - **Create** `server/src/routes/leaveHistory.ts` — `GET /api/leave-requests/:id/history`: authenticated, employee can only fetch history for their own request (enforce `request.employeeId === req.user.id`); MANAGER and HR_ADMIN can fetch any; returns filtered `AuditLog` rows where `entityType = "LeaveRequest"` and `entityId = id`, ordered by `timestamp asc`
      - [server/src/routes/index.ts](../server/src/routes/index.ts) — register `leaveHistoryRouter`
      - [client/src/lib/api.ts](../client/src/lib/api.ts) — add `getLeaveRequestHistory(id: number)` API function
      - [client/src/pages/employee/LeaveSlipPage.tsx](../client/src/pages/employee/LeaveSlipPage.tsx) (or equivalent detail page) — add collapsible history timeline showing `action`, `actor.name` (or `"Unknown"` when null), `timestamp`, `before`/`after` status
      - [client/src/pages/admin/AuditLogPage.tsx](../client/src/pages/admin/AuditLogPage.tsx) — display `attemptedEmail` column for `LOGIN_FAILURE` rows where `actor` is null
    - **Tests to Write:**
      - `POST /auth/login with wrong password writes LOGIN_FAILURE AuditLog row with attemptedEmail`
      - `POST /auth/login success writes LOGIN_SUCCESS AuditLog row with actorId`
      - `GET /api/leave-requests/:id/history returns history for own request (employee)`
      - `GET /api/leave-requests/:id/history returns 403 when employee requests another user's history`
      - `GET /api/leave-requests/:id/history returns full history for HR_ADMIN`
      - `GET /admin/audit-logs includes LOGIN_FAILURE rows with null actor and attemptedEmail`
    - **Steps:**
        1. Write failing tests for the schema changes and the new history endpoint
        2. Update `schema.prisma` — make `actorId` nullable, add `attemptedEmail`
        3. Run `prisma migrate dev` to generate and apply migration
        4. Update `auth.ts` to write login audit rows
        5. Create `leaveHistory.ts` route with ownership enforcement
        6. Register route in `index.ts`
        7. Run server tests to confirm they pass
        8. Update `adminAuditLogs.ts` to handle null actor
        9. Add `getLeaveRequestHistory` to `client/src/lib/api.ts`
        10. Add history timeline UI to the leave detail page
        11. Run full test suite and verify no regressions

---

**Decisions**

1. **Phase 6 cookie SameSite flag:** ~~Strict / Lax / None?~~ **Decided: `SameSite=Lax`** — works across same-domain and subdomain deployments without breaking token refresh.
2. **Phase 5 pagination style:** ~~Offset vs cursor?~~ **Decided: offset-based** (`?page&pageSize`) — consistent with existing `adminLeaveRequests` and `adminAuditLogs` endpoints; sufficient for current dataset scale.
3. **Phase 3 AppError hierarchy:** ~~Single class vs named subclasses?~~ **Decided: single `AppError` class** with `statusCode` and `code: string` — minimal boilerplate, type-safe, sufficient for client discrimination.
4. **Phase 1 SUPERUSER_ROLES:** ~~Code constant vs env-var?~~ **Decided: code constant only** — `Role` enum is schema-bound so a deploy is required regardless; keeps superuser membership version-controlled and type-safe.
5. **Phase 7 audit log sink:** ~~stdout only or also Prisma AuditLog table?~~ **Decided: persist login events to AuditLog table (Phase 8); other events (RBAC denials, request lifecycle) go to pino stdout only.**
6. **Phase 7 PII in logs:** ~~Should attempted login emails be logged or hashed?~~ **Decided: log the email as-is.**
