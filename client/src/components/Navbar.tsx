import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-700 text-white"
        : "text-indigo-100 hover:bg-indigo-600 hover:text-white"
    }`;

  const role = user?.role ?? "";

  return (
    <nav className="bg-indigo-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: nav links */}
          <div className="flex items-center space-x-1">
            <NavLink to="/dashboard" className={linkClass}>
              Dashboard
            </NavLink>

            <NavLink to="/calendar" className={linkClass}>
              Calendar
            </NavLink>

            {(role === "EMPLOYEE" || role === "MANAGER") && (
              <NavLink to="/apply-leave" className={linkClass}>
                Apply Leave
              </NavLink>
            )}

            {(role === "MANAGER" || role === "HR_ADMIN") && (
              <NavLink to="/manager/pending-approvals" className={linkClass}>
                Pending Approvals
              </NavLink>
            )}

            {role === "HR_ADMIN" && (
              <NavLink to="/admin/leave-types" className={linkClass}>
                Leave Types
              </NavLink>
            )}

            {role === "HR_ADMIN" && (
              <NavLink to="/admin/users" className={linkClass}>
                Users
              </NavLink>
            )}
          </div>

          {/* Right: user info + logout */}
          <div className="flex items-center space-x-3">
            <span className="text-indigo-200 text-sm">
              {user?.name}{" "}
              <span className="ml-1 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">
                {role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
