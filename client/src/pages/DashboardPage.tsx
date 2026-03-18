import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { getLeaveBalances, type LeaveBalance } from "../lib/api";

export function DashboardPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["leaveBalances", currentYear],
    queryFn: getLeaveBalances,
  });

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

      {/* My Leave Balances */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          My Leave Balances ({currentYear})
        </h3>
        {balancesLoading ? (
          <p className="text-gray-500 text-sm">Loading balances…</p>
        ) : !balances || balances.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No balances for this year. Contact HR to initialize.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b: LeaveBalance) => {
              const available = b.totalDays - b.usedDays - b.pendingDays;
              return (
                <div key={b.leaveTypeId} className="bg-white shadow rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    {b.leaveType.name}
                  </h4>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-gray-500">Total</dt>
                    <dd className="text-gray-900 font-medium">{b.totalDays}</dd>
                    <dt className="text-gray-500">Used</dt>
                    <dd className="text-gray-900 font-medium">{b.usedDays}</dd>
                    <dt className="text-gray-500">Pending</dt>
                    <dd className="text-gray-900 font-medium">{b.pendingDays}</dd>
                    <dt className="text-gray-500">Available</dt>
                    <dd className="text-green-700 font-semibold">{available}</dd>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

