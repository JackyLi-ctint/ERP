import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, updateUserIdentity, updateUserRole, User } from "../../lib/api";

interface EditState {
  team: string;
  title: string;
  role: string;
}

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditState>({ team: "", title: "", role: "" });
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: users = [], isLoading, isError } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, role }: { id: string; data: { team?: string; title?: string }; role: string }) => {
      const promises: Promise<unknown>[] = [];
      if (data.team !== undefined || data.title !== undefined) {
        promises.push(updateUserIdentity(id, data));
      }
      promises.push(updateUserRole(id, role));
      await Promise.all(promises);
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFeedback("User updated.");
      setTimeout(() => setFeedback(null), 4000);
    },
  });

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditValues({ team: user.team ?? "", title: user.title ?? "", role: user.role });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(id: string) {
    const payload: { team?: string; title?: string } = {};
    if (editValues.team.trim()) payload.team = editValues.team.trim();
    if (editValues.title.trim()) payload.title = editValues.title.trim();
    updateMutation.mutate({ id, data: payload, role: editValues.role });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">User Management</h1>

      {feedback && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {feedback}
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading…</p>}
      {isError && <p className="text-red-600">Failed to load users.</p>}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Email", "Role", "Team", "Title", "Actions"].map((h) => (
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
              {users.map((user) => {
                const isEditing = editingId === user.id;
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.role}
                          onChange={(e) => setEditValues((v) => ({ ...v, role: e.target.value }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="EMPLOYEE">EMPLOYEE</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="HR_ADMIN">HR_ADMIN</option>
                        </select>
                      ) : (
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.team}
                          maxLength={100}
                          onChange={(e) =>
                            setEditValues((v) => ({ ...v, team: e.target.value }))
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className="text-gray-700">{user.team ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editValues.title}
                          maxLength={100}
                          onChange={(e) =>
                            setEditValues((v) => ({ ...v, title: e.target.value }))
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <span className="text-gray-700">{user.title ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => saveEdit(user.id)}
                            disabled={updateMutation.isPending}
                            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {updateMutation.isPending ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={updateMutation.isPending}
                            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(user)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
