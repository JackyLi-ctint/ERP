import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getLeaveRequest } from "../lib/api";

export function LeaveSlipPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = parseInt(id ?? "", 10);

  const { data: leaveRequest, isLoading, isError } = useQuery({
    queryKey: ["leaveRequest", requestId],
    queryFn: () => getLeaveRequest(requestId),
    enabled: !isNaN(requestId),
  });

  if (isNaN(requestId)) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <p className="text-red-600">Invalid leave request ID.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (isError || !leaveRequest) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <p className="text-red-600">Leave request not found or you do not have permission to view it.</p>
      </div>
    );
  }

  const statusColour: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
    CANCEL_REQUESTED: "bg-orange-100 text-orange-800",
    DRAFT: "bg-blue-100 text-blue-800",
  };

  return (
    <>
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white shadow-md rounded-lg p-8 print:shadow-none print:rounded-none">
          <div className="flex items-center justify-between mb-6 print:mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Leave Request Slip</h1>
            <button
              onClick={() => window.print()}
              className="no-print rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Print
            </button>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Employee</dt>
              <dd className="mt-1 text-sm text-gray-900">{leaveRequest.employeeName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Leave Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{leaveRequest.leaveTypeName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Start Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(leaveRequest.startDate).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">End Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(leaveRequest.endDate).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Days</dt>
              <dd className="mt-1 text-sm text-gray-900">{leaveRequest.totalDays}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Half Day</dt>
              <dd className="mt-1 text-sm text-gray-900">{leaveRequest.halfDay ? "Yes" : "No"}</dd>
            </div>
            {leaveRequest.halfDay && leaveRequest.period && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Period</dt>
                <dd className="mt-1 text-sm text-gray-900">{leaveRequest.period}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    statusColour[leaveRequest.status] ?? "bg-gray-100 text-gray-800"
                  }`}
                >
                  {leaveRequest.status}
                </span>
              </dd>
            </div>
            {leaveRequest.reason && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Reason</dt>
                <dd className="mt-1 text-sm text-gray-900">{leaveRequest.reason}</dd>
              </div>
            )}
            {leaveRequest.approverComment && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Approver Comment</dt>
                <dd className="mt-1 text-sm text-gray-900">{leaveRequest.approverComment}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Submitted</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(leaveRequest.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  );
}
