import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Leave Management System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user?.name}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 bg-white shadow rounded-lg">
          <h2 className="text-lg font-medium text-gray-900">Welcome!</h2>
          <p className="mt-2 text-sm text-gray-600">
            You are logged in as <strong>{user?.email}</strong> with role{" "}
            <strong>{user?.role}</strong>.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            This is the dashboard. More features will be added in future phases.
          </p>
        </div>
      </div>
    </div>
  );
}
