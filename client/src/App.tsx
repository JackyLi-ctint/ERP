import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApplyLeavePage } from "./pages/employee/ApplyLeavePage";
import LeaveTypesPage from "./pages/admin/LeaveTypesPage";
import { UserManagementPage } from "./pages/admin/UserManagementPage";
import { PendingApprovalsPage } from "./pages/manager/PendingApprovalsPage";
import { LeaveCalendarPage } from "./pages/LeaveCalendarPage";

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
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

