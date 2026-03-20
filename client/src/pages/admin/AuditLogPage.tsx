import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "../../lib/api";

export function AuditLogPage() {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    entityType: "All",
    actorId: "",
    page: 1,
    pageSize: 20,
  });

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["auditLogs", filters],
    queryFn: () =>
      getAuditLogs({
        from: filters.from || undefined,
        to: filters.to || undefined,
        entityType: filters.entityType !== "All" ? filters.entityType : undefined,
        actorId: filters.actorId || undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      }),
  });

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePreviousPage = () => {
    if (filters.page > 1) {
      setFilters((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const handleNextPage = () => {
    if (data && filters.page < data.totalPages) {
      setFilters((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const toggleRowDetails = (logId: string) => {
    setExpandedRowId(expandedRowId === logId ? null : logId);
  };

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="rounded-md bg-red-50 p-4">
          <h3 className="text-sm font-medium text-red-800">Error loading audit logs</h3>
          <p className="mt-1 text-sm text-red-700">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>

      {/* Filter Row */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange("from", e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange("to", e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
            <select
              value={filters.entityType}
              onChange={(e) => handleFilterChange("entityType", e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="All">All</option>
              <option value="LeaveRequest">Leave Request</option>
              <option value="LeaveBalance">Leave Balance</option>
              <option value="LeaveType">Leave Type</option>
              <option value="User">User</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actor ID (Optional)</label>
            <input
              type="text"
              placeholder="Search by user ID"
              value={filters.actorId}
              onChange={(e) => handleFilterChange("actorId", e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rows per Page</label>
            <select
              value={filters.pageSize}
              onChange={(e) => handleFilterChange("pageSize", parseInt(e.target.value, 10))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-gray-500">Loading audit logs...</div>
        ) : data && data.logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div>
                            <p className="font-medium text-gray-900">{log.actor.name}</p>
                            <p className="text-gray-500 text-xs">{log.actor.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.action}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.entityType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.entityId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => toggleRowDetails(log.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {expandedRowId === log.id ? "Hide" : "Show"}
                          </button>
                        </td>
                      </tr>
                      {expandedRowId === log.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">Before</h4>
                                <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto max-h-48 text-gray-700">
                                  {log.before ? JSON.stringify(log.before, null, 2) : "null"}
                                </pre>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">After</h4>
                                <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto max-h-48 text-gray-700">
                                  {log.after ? JSON.stringify(log.after, null, 2) : "null"}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {data.page} of {data.totalPages} (Total: {data.total} logs)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={data.page <= 1}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={data.page >= data.totalPages}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-center text-sm text-gray-500">No audit logs found.</div>
        )}
      </div>
    </div>
  );
}
