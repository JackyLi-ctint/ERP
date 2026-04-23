import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPendingApprovals,
  approveLeaveRequest,
  rejectLeaveRequest,
  approveCancellation,
  rejectCancellation,
  bulkApproveLeaveRequests,
  bulkRejectLeaveRequests,
  PendingRequest,
} from "../../lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

interface RejectModalProps {
  title: string;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function RejectModal({ title, onConfirm, onCancel, isLoading }: RejectModalProps) {
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reason (required)
        </label>
        <textarea
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Enter rejection reason…"
        />
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(comment)}
            disabled={!comment.trim() || isLoading}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ModalState =
  | { type: "reject"; id: number }
  | { type: "rejectCancel"; id: number }
  | { type: "bulkReject"; ids: number[] }
  | null;

export function PendingApprovalsPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: requests = [], isLoading, isError } = useQuery<PendingRequest[]>({
    queryKey: ["pendingApprovals"],
    queryFn: getPendingApprovals,
  });

  // Clear selectedIds when requests change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [requests]);

  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  }

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      showFeedback("Request approved.");
    },
  });

  function handleApprove(id: number) {
    if (!window.confirm("Approve this request?")) return;
    approveMutation.mutate(id);
  }

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      rejectLeaveRequest(id, comment),
    onSuccess: () => {
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      showFeedback("Request rejected.");
    },
  });

  const approveCancelMutation = useMutation({
    mutationFn: (id: number) => approveCancellation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      showFeedback("Cancellation approved.");
    },
  });

  const rejectCancelMutation = useMutation({
    mutationFn: ({ id, comment }: { id: number; comment: string }) =>
      rejectCancellation(id, comment),
    onSuccess: () => {
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      showFeedback("Cancellation rejected.");
    },
  });

  function handleRejectConfirm(comment: string) {
    if (!modal) return;
    if (modal.type === "reject") {
      rejectMutation.mutate({ id: modal.id, comment });
    } else {
      rejectCancelMutation.mutate({ id: modal.id, comment });
    }
  }

  const isMutating =
    rejectMutation.isPending || rejectCancelMutation.isPending;

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: number[]) => bulkApproveLeaveRequests(ids),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      showFeedback(`${selectedIds.size} request(s) approved.`);
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: ({ ids, comment }: { ids: number[]; comment: string }) =>
      bulkRejectLeaveRequests(ids, comment),
    onSuccess: () => {
      setModal(null);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["pendingApprovals"] });
      showFeedback("Request(s) rejected.");
    },
  });

  function toggleSelectAll() {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkApprove() {
    if (!window.confirm(`Approve ${selectedIds.size} request(s)?`)) return;
    bulkApproveMutation.mutate(Array.from(selectedIds));
  }

  function handleBulkRejectConfirm(comment: string) {
    if (!modal || modal.type !== "bulkReject") return;
    bulkRejectMutation.mutate({ ids: modal.ids, comment });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Pending Approvals</h1>

      {feedback && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {feedback}
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading…</p>}
      {isError && (
        <p className="text-red-600">Failed to load pending requests.</p>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-gray-500">
          No pending requests at the moment.
        </div>
      )}

      {!isLoading && requests.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === requests.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                {[
                  "Employee",
                  "Leave Type",
                  "Start",
                  "End",
                  "Days",
                  "Submitted",
                  "Status",
                  "Reason",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(req.id)}
                      onChange={() => toggleSelect(req.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {req.employee.name}
                    <div className="text-xs text-gray-400">{req.employee.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{req.leaveType.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(req.startDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(req.endDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{req.totalDays}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        req.status === "CANCEL_REQUESTED"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {req.reason ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col space-y-1">
                      <Link
                        to={`/leave-requests/${req.id}/slip`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Slip
                      </Link>
                    {req.status === "PENDING" && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={approveMutation.isPending}
                          className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setModal({ type: "reject", id: req.id })}
                          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {req.status === "CANCEL_REQUESTED" && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => approveCancelMutation.mutate(req.id)}
                          disabled={approveCancelMutation.isPending}
                          className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve Cancel
                        </button>
                        <button
                          onClick={() =>
                            setModal({ type: "rejectCancel", id: req.id })
                          }
                          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Reject Cancel
                        </button>
                      </div>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 flex items-center justify-between">
          <span className="text-sm text-gray-600 font-medium">{selectedIds.size} selected</span>
          <div className="flex space-x-3">
            <button
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {bulkApproveMutation.isPending ? "Approving…" : "Approve Selected"}
            </button>
            <button
              onClick={() => setModal({ type: "bulkReject", ids: Array.from(selectedIds) })}
              disabled={bulkRejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkRejectMutation.isPending ? "Rejecting…" : "Reject Selected"}
            </button>
          </div>
        </div>
      )}

      {modal && (
        <RejectModal
          title={
            modal.type === "reject"
              ? "Reject Leave Request"
              : modal.type === "rejectCancel"
              ? "Reject Cancellation Request"
              : `Reject ${modal.ids.length} Request(s)`
          }
          onConfirm={(comment: string) => {
            if (modal.type === "bulkReject") {
              handleBulkRejectConfirm(comment);
            } else {
              handleRejectConfirm(comment);
            }
          }}
          onCancel={() => setModal(null)}
          isLoading={isMutating || bulkRejectMutation.isPending}
        />
      )}
    </div>
  );
}
