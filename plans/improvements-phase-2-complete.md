## Phase 2 Complete: Central Config Module

`server/src/config.ts` already existed but had three incorrect default values. The 12 config unit tests exposed the discrepancies; fixing the defaults in `config.ts` brought all tests to green. All of `app.ts`, `upload.ts`, `auth.service.ts`, `users.ts`, `adminLeaveRequests.ts`, `adminAuditLogs.ts`, and `azureAd.service.ts` were confirmed to already import from `config` — no consumer changes were needed.

**Files created/changed:**
- `server/src/config.ts` — corrected 3 default values: `rateLimitAuth.max` 20→10, `rateLimitApi.windowMs` 900000→60000, `bodyLimit` '16kb'→'10mb'

**Functions created/changed:**
- `config` object defaults (3 fields updated)

**Tests created/changed:**
- `server/src/__tests__/config.test.ts` — pre-existing; all 12 tests now pass

**Review Status:** APPROVED

**Git Commit Message:**
```
fix: correct default values in central config module

- rateLimitAuth.max: 20 → 10 (stricter auth rate limit by default)
- rateLimitApi.windowMs: 900000 → 60000 (1-minute API window)
- bodyLimit: '16kb' → '10mb' (matches plan spec and test expectation)
```
