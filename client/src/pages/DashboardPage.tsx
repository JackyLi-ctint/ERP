import { useAuth } from "../contexts/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="px-4 py-6 bg-white shadow rounded-lg">
        <h2 className="text-lg font-medium text-gray-900">Welcome, {user?.name}!</h2>
        <p className="mt-2 text-sm text-gray-600">
          You are logged in as <strong>{user?.email}</strong> with role{" "}
          <strong>{user?.role}</strong>.
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Use the navigation bar above to access features.
        </p>
      </div>
    </div>
  );
}

