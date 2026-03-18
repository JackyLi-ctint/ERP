import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import apiClient from "../../lib/api";
import { LeaveDurationPreview } from "../../components/LeaveDurationPreview";

interface LeaveType {
  id: number;
  name: string;
  defaultDays: number;
  isCarryForward: boolean;
  requiresDocument: boolean;
  isActive: boolean;
}

interface LeaveRequest {
  id: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  halfDay: boolean;
  period?: string;
  reason?: string;
  status: string;
  leaveType: {
    id: number;
    name: string;
  };
  createdAt: string;
}

const submitLeaveSchema = z.object({
  leaveTypeId: z.number().int("Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  halfDay: z.boolean(),
  period: z.enum(["AM", "PM"]).optional(),
  reason: z.string().optional(),
});

type SubmitLeaveFormData = z.infer<typeof submitLeaveSchema>;

export function ApplyLeavePage() {
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const queryClient = useQueryClient();

  const form = useForm<SubmitLeaveFormData>({
    resolver: zodResolver(submitLeaveSchema),
    defaultValues: {
      leaveTypeId: 0,
      startDate: "",
      endDate: "",
      halfDay: false,
      period: undefined,
      reason: "",
    },
  });

  // Fetch leave types
  const { data: leaveTypesData, isLoading: isLoadingTypes } = useQuery({
    queryKey: ["leaveTypes"],
    queryFn: async () => {
      const response = await apiClient.get("/leave-types");
      return response.data as { leaveTypes: LeaveType[] };
    },
  });

  const leaveTypes = (leaveTypesData?.leaveTypes || []) as LeaveType[];

  // Fetch current user's leave requests
  const { data: requestsData, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["myLeaveRequests"],
    queryFn: async () => {
      const response = await apiClient.get("/me/leave-requests");
      return response.data as { leaveRequests: LeaveRequest[] };
    },
  });

  const requests = (requestsData?.leaveRequests || []) as LeaveRequest[];

  // Submit leave request mutation
  const submitMutation = useMutation({
    mutationFn: async (data: SubmitLeaveFormData) => {
      const payload = {
        leaveTypeId: data.leaveTypeId,
        startDate: data.startDate,
        endDate: data.endDate,
        halfDay: data.halfDay || false,
        period: data.halfDay ? data.period : undefined,
        reason: data.reason,
      };
      const response = await apiClient.post("/leave-requests", payload);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage("Leave request submitted successfully!");
      setErrorMessage("");
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["myLeaveRequests"] });
      setTimeout(() => setSuccessMessage(""), 5000);
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message ||
        "Failed to submit leave request. Please try again.";
      setErrorMessage(message);
      setSuccessMessage("");
    },
  });

  // Cancel leave request mutation
  const cancelMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await apiClient.delete(`/leave-requests/${requestId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myLeaveRequests"] });
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message || "Failed to cancel request";
      setErrorMessage(message);
    },
  });

  const watchStartDate = form.watch("startDate");
  const watchEndDate = form.watch("endDate");
  const watchHalfDay = form.watch("halfDay");
  const watchPeriod = form.watch("period");

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Apply for Leave</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <form
                onSubmit={form.handleSubmit((data) => {
                  submitMutation.mutate(data);
                })}
                className="space-y-6"
              >
                {/* Success Message */}
                {successMessage && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                    {successMessage}
                  </div>
                )}

                {/* Error Message */}
                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    {errorMessage}
                  </div>
                )}

                {/* Leave Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type *
                  </label>
                  <select
                    {...form.register("leaveTypeId", {
                      setValueAs: (v) => (v ? parseInt(v) : undefined),
                    })}
                    disabled={isLoadingTypes}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Select a leave type</option>
                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.defaultDays} days)
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.leaveTypeId && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.leaveTypeId.message}
                    </p>
                  )}
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    {...form.register("startDate")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {form.formState.errors.startDate && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.startDate.message}
                    </p>
                  )}
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    {...form.register("endDate")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {form.formState.errors.endDate && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.endDate.message}
                    </p>
                  )}
                </div>

                {/* Duration Preview */}
                {watchStartDate && watchEndDate && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      Duration Preview:
                    </p>
                    <LeaveDurationPreview
                      startDate={watchStartDate}
                      endDate={watchEndDate}
                      halfDay={watchHalfDay}
                      period={watchPeriod as "AM" | "PM" | undefined}
                    />
                  </div>
                )}

                {/* Half Day Toggle */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...form.register("halfDay")}
                    id="halfDay"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="halfDay"
                    className="text-sm font-medium text-gray-700"
                  >
                    Half Day Leave
                  </label>
                </div>

                {/* Period Selection (AM/PM) */}
                {watchHalfDay && (
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-gray-700 block">
                      Period *
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          {...form.register("period")}
                          value="AM"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Morning (AM)</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          {...form.register("period")}
                          value="PM"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          Afternoon (PM)
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason (Optional)
                  </label>
                  <textarea
                    {...form.register("reason")}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your reason for leave..."
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitMutation.isPending || isLoadingTypes}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {submitMutation.isPending
                    ? "Submitting..."
                    : "Submit Leave Request"}
                </button>
              </form>
            </div>
          </div>

          {/* Recent Requests Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Your Requests
              </h2>

              {isLoadingRequests ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <p className="text-gray-500 text-sm">No leave requests yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {requests.slice(0, 10).map((req) => (
                    <div
                      key={req.id}
                      className="p-3 border border-gray-200 rounded-lg text-sm"
                    >
                      <div className="font-medium text-gray-900">
                        {req.leaveType.name}
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(req.startDate).toLocaleDateString()} -{" "}
                        {new Date(req.endDate).toLocaleDateString()}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            req.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : req.status === "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : req.status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {req.status}
                        </span>
                        {req.status === "PENDING" && (
                          <button
                            onClick={() => cancelMutation.mutate(req.id)}
                            disabled={cancelMutation.isPending}
                            className="text-xs text-red-600 hover:text-red-700 disabled:text-gray-400"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
