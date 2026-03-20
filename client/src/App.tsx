import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SessionExpiredModal } from "./components/SessionExpiredModal";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import { LoginPage } from "./pages/LoginPage";
import { AzureCallbackPage } from "./pages/AzureCallbackPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApplyLeavePage } from "./pages/employee/ApplyLeavePage";
import LeaveTypesPage from "./pages/admin/LeaveTypesPage";
import { UserManagementPage } from "./pages/admin/UserManagementPage";
import { HRRecordsPage } from "./pages/admin/HRRecordsPage";
import { BalanceAdminPage } from "./pages/admin/BalanceAdminPage";
import { AuditLogPage } from "./pages/admin/AuditLogPage";
import { PendingApprovalsPage } from "./pages/manager/PendingApprovalsPage";
import { LeaveCalendarPage } from "./pages/LeaveCalendarPage";
import { LeaveSlipPage } from "./pages/LeaveSlipPage";
import { useAuth } from "./contexts/AuthContext";

const queryClient = new QueryClient();

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { sessionExpired, clearSessionExpired, logout } = useAuth();

  const handleSessionExpiredConfirm = () => {
    clearSessionExpired();
    logout();
    navigate("/login");
  };

  return (
    <>
      <SessionExpiredModal
        open={sessionExpired}
        onConfirm={handleSessionExpiredConfirm}
      />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AzureCallbackPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <DashboardPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/apply-leave"
        element={
          <ProtectedRoute allowedRoles={["EMPLOYEE", "MANAGER"]}>
            <AuthenticatedLayout>
              <ApplyLeavePage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manager/pending-approvals"
        element={
          <ProtectedRoute allowedRoles={["MANAGER", "HR_ADMIN"]}>
            <AuthenticatedLayout>
              <PendingApprovalsPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/leave-types"
        element={
          <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
            <AuthenticatedLayout>
              <LeaveTypesPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
            <AuthenticatedLayout>
              <UserManagementPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <LeaveCalendarPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/leave-requests/:id/slip"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout>
              <LeaveSlipPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/leave-records"
        element={
          <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
            <AuthenticatedLayout>
              <HRRecordsPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/balances"
        element={
          <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
            <AuthenticatedLayout>
              <BalanceAdminPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute allowedRoles={["HR_ADMIN"]}>
            <AuthenticatedLayout>
              <AuditLogPage />
            </AuthenticatedLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

