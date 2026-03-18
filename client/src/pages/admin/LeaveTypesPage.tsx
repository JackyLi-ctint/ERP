import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import apiClient from "../../lib/api";

interface LeaveType {
  id: number;
  name: string;
  defaultDays: number;
  isCarryForward: boolean;
  requiresDocument: boolean;
  isActive: boolean;
}

const leaveTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  defaultDays: z.number().positive("Must be greater than 0"),
  isCarryForward: z.boolean(),
  requiresDocument: z.boolean(),
});

type LeaveTypeFormValues = z.infer<typeof leaveTypeSchema>;

export default function LeaveTypesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ leaveTypes: LeaveType[] }>({
    queryKey: ["leaveTypes"],
    queryFn: () =>
      (apiClient as any).get("/leave-types").then((r: any) => r.data),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeaveTypeFormValues>({
    resolver: zodResolver(leaveTypeSchema),
  });

  const saveMutation = useMutation({
    mutationFn: (values: LeaveTypeFormValues) =>
      editingType
        ? (apiClient as any)
            .patch(`/leave-types/${editingType.id}`, values)
            .then((r: any) => r.data)
        : (apiClient as any)
            .post("/leave-types", values)
            .then((r: any) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
      closeDialog();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? "Something went wrong");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      (apiClient as any)
        .delete(`/leave-types/${id}`)
        .then((r: any) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveTypes"] });
    },
  });

  function openCreate() {
    setEditingType(null);
    reset({ name: "", defaultDays: 0, isCarryForward: false, requiresDocument: false });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(lt: LeaveType) {
    setEditingType(lt);
    reset({
      name: lt.name,
      defaultDays: lt.defaultDays,
      isCarryForward: lt.isCarryForward,
      requiresDocument: lt.requiresDocument,
    });
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingType(null);
    setError(null);
  }

  function onSubmit(values: LeaveTypeFormValues) {
    saveMutation.mutate(values);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Leave Types</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          + Create
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Default Days", "Carry Forward", "Requires Doc", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data?.leaveTypes.map((lt) => (
                <tr key={lt.id} className={lt.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-gray-900">{lt.name}</td>
                  <td className="px-4 py-3 text-gray-600">{lt.defaultDays}</td>
                  <td className="px-4 py-3 text-gray-600">{lt.isCarryForward ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-gray-600">{lt.requiresDocument ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        lt.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {lt.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      onClick={() => openEdit(lt)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Edit
                    </button>
                    {lt.isActive && (
                      <button
                        onClick={() => deactivateMutation.mutate(lt.id)}
                        className="text-red-500 hover:text-red-700 font-medium"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {editingType ? "Edit Leave Type" : "Create Leave Type"}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  {...register("name")}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Default Days</label>
                <input
                  type="number"
                  step="0.5"
                  {...register("defaultDays", { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.defaultDays && (
                  <p className="mt-1 text-xs text-red-600">{errors.defaultDays.message}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="isCarryForward"
                  type="checkbox"
                  {...register("isCarryForward")}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <label htmlFor="isCarryForward" className="text-sm text-gray-700">
                  Carry Forward
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="requiresDocument"
                  type="checkbox"
                  {...register("requiresDocument")}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
                <label htmlFor="requiresDocument" className="text-sm text-gray-700">
                  Requires Document
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
