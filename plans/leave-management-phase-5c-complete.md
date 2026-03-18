## Phase 5-C Complete: Approval UI + User Management UI + Full Navigation

The React client is now fully navigable with role-gated routing, a persistent auth session, working approval and user management pages, and a typed API layer. All TypeScript checks are clean.

**Files created/changed:**
- `client/src/contexts/AuthContext.tsx` (updated — localStorage refresh token persistence, session restore on mount, `isInitializing` guard, `auth:expired` event listener)
- `client/src/lib/api.ts` (updated — 5 domain interfaces, 14 typed API functions, 401 auto-refresh interceptor with request queueing, dispatches `auth:expired` on refresh failure)
- `client/src/App.tsx` (updated — `QueryClientProvider`, `AuthenticatedLayout` with `Navbar`, all 5 protected routes with role guards)
- `client/src/components/ProtectedRoute.tsx` (updated — `allowedRoles` prop, loading spinner during init, wrong-role → /dashboard redirect)
- `client/src/pages/DashboardPage.tsx` (updated — removed inline nav, now uses global Navbar)
- `client/src/components/Navbar.tsx` (new — role-conditional NavLinks with active highlight, user name+role badge, logout button)
- `client/src/pages/manager/PendingApprovalsPage.tsx` (new — TanStack Query, approve/reject/approve-cancel/reject-cancel actions, rejection comment modal)
- `client/src/pages/admin/UserManagementPage.tsx` (new — user table, inline row editing for team+title, save/cancel per row)

**Functions created/changed:**
- `AuthContext` — added `isInitializing`, `auth:expired` event listener, localStorage persistence
- `apiClient` interceptor — 401 auto-refresh with subscriber queue; dispatches `auth:expired` on failure
- 14 typed API functions: `getLeaveRequests`, `submitLeaveRequest`, `cancelLeaveRequest`, `getLeaveTypes`, `createLeaveType`, `updateLeaveType`, `getLeaveBalances`, `getPendingApprovals`, `approveLeaveRequest`, `rejectLeaveRequest`, `approveCancellation`, `rejectCancellation`, `getUsers`, `updateUserIdentity`
- `PendingApprovalsPage` — full approval workflow UI
- `UserManagementPage` — inline HR user identity editing

**Tests created/changed:**
- None (front-end only phase; success criterion was `tsc --noEmit` clean)

**Review Status:** APPROVED — MAJOR issue fixed (401 interceptor now dispatches `auth:expired` event; AuthContext listens and calls logout, preventing broken authenticated shell after session expiry)

**Git Commit Message:**
```
feat: approval UI, user management UI, full navigation wiring

- Navbar with role-conditional links and active state highlight
- ProtectedRoute extended with allowedRoles prop
- PendingApprovalsPage: approve/reject/cancel flows with comment modal
- UserManagementPage: inline team+title editing for HR admins
- AuthContext: localStorage refresh token persistence, isInitializing guard
- api.ts: 14 typed functions + 401 interceptor with auth:expired event
- All 5 routes wired with role guards in App.tsx
```
