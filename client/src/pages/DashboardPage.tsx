import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getLeaveBalances, getLeaveRequests, getPendingApprovals, type LeaveBalance, type LeaveRequest } from "../lib/api";

const STATUS_COLOURS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  CANCEL_REQUESTED: "bg-yellow-100 text-yellow-800",
};

export function DashboardPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const isManager = user?.role === "MANAGER" || user?.role === "HR_ADMIN";
  const isEmployee = user?.role === "EMPLOYEE" || user?.role === "MANAGER";

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["leaveBalances", currentYear],
    queryFn: getLeaveBalances,
  });

  const { data: recentRequests } = useQuery<LeaveRequest[]>({
    queryKey: ["myLeaveRequests"],
    queryFn: getLeaveRequests,
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ["pendingApprovals"],
    queryFn: getPendingApprovals,
    enabled: isManager,
    select: (data) => data.length,
  });

  const last5 = recentRequests ? [...recentRequests].slice(0, 5) : [];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="px-4 py-6 bg-white shadow rounded-lg">
        <h2 className="text-lg font-medium text-gray-900">Welcome, {user?.name}!</h2>
        <p className="mt-2 text-sm text-gray-600">
          You are logged in as <strong>{user?.email}</strong> with role{" "}
          <strong>{user?.role}</strong>.
        </p>
      </div>

      {/* Quick-action cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isEmployee && (
          <Link
            to="/apply-leave"
            className="flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 p-5 shadow-sm hover:bg-indigo-100 transition-colors"
          >
            <span className="text-sm font-semibold text-indigo-700">Apply Leave</span>
          </Link>
        )}
        <Link
          to="/calendar"
          className="flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm hover:bg-blue-100 transition-colors"
        >
          <span className="text-sm font-semibold text-blue-700">View Calendar</span>
        </Link>
        {isManager && (
          <Link
            to="/manager/pending-approvals"
            className="flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm hover:bg-amber-100 transition-colors"
          >
            <span className="text-sm font-semibold text-amber-700">
              Pending Approvals
              {pendingApprovals != null && pendingApprovals > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingApprovals}
                </span>
              )}
            </span>
          </Link>
        )}
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
              const cardClass =
                available <= 0
                  ? "bg-red-50 border border-red-200"
                  : available <= 2
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-white shadow";
              return (
                <div key={b.leaveTypeId} className={`rounded-lg p-4 ${cardClass}`}>
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
                    <dd className={available <= 0 ? "text-red-700 font-semibold" : available <= 2 ? "text-amber-700 font-semibold" : "text-green-700 font-semibold"}>
                      {available <= 0 ? "None remaining" : available}
                    </dd>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Requests */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Recent Requests</h3>
        {last5.length === 0 ? (
          <p className="text-gray-500 text-sm">No leave requests yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Leave Type", "Start", "End", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {last5.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-3 text-gray-700">{req.leaveType.name}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(req.startDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(req.endDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOURS[req.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/leave-requests/${req.id}/slip`} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                        View Slip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

