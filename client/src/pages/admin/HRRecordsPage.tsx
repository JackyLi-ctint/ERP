import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAdminLeaveRequests, getUsers, type AdminLeaveRequest } from "../../lib/api";

const LEAVE_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED", "CANCEL_REQUESTED"];

export function HRRecordsPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filter state applied on "Search"
  const [appliedFilters, setAppliedFilters] = useState<{
    employeeId: string;
    status: string;
    from: string;
    to: string;
    page: number;
  }>({ employeeId: "", status: "", from: "", to: "", page: 1 });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["adminLeaveRequests", appliedFilters],
    queryFn: () =>
      getAdminLeaveRequests({
        employeeId: appliedFilters.employeeId || undefined,
        status: appliedFilters.status || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
        page: appliedFilters.page,
        pageSize,
      }),
  });

  const handleSearch = () => {
    setAppliedFilters({ employeeId, status, from, to, page: 1 });
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setAppliedFilters((prev) => ({ ...prev, page: newPage }));
  };

  const statusBadge = (s: string) => {
    const colours: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      CANCELLED: "bg-gray-100 text-gray-800",
      CANCEL_REQUESTED: "bg-orange-100 text-orange-800",
      DRAFT: "bg-blue-100 text-blue-800",
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${colours[s] ?? "bg-gray-100 text-gray-800"}`}>
        {s}
      </span>
    );
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">HR Leave Records</h1>

      {/* Filter bar */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All employees</option>
              {usersData?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All statuses</option>
              {LEAVE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSearch}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600">Failed to load records.</div>
        ) : !data || data.leaveRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No records found.</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Employee", "Leave Type", "Start", "End", "Days", "Status", "Submitted", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.leaveRequests.map((r: AdminLeaveRequest) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{r.employeeName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.leaveTypeName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(r.startDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(r.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.totalDays}</td>
                    <td className="px-4 py-3 text-sm">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to={`/leave-requests/${r.id}/slip`}
                        className="text-indigo-600 hover:text-indigo-900 font-medium"
                      >
                        View Slip
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-700">
                Showing {(appliedFilters.page - 1) * pageSize + 1}–
                {Math.min(appliedFilters.page * pageSize, data.total)} of {data.total} results
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
