import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, createUser, updateUser, importUsersFromCSV, User } from "../../lib/api";

interface FormState {
  name: string;
  email: string;
  password: string;
  role: string;
  team: string;
  title: string;
  department: string;
}

const emptyForm: FormState = {
  name: "", email: "", password: "", role: "EMPLOYEE",
  team: "", title: "", department: "",
};

function userToForm(u: User): FormState {
  return {
    name: u.name,
    email: u.email,
    password: "",
    role: u.role,
    team: u.team ?? "",
    title: u.title ?? "",
    department: u.department ?? "",
  };
}

const ROLES = ["EMPLOYEE", "MANAGER", "HR_ADMIN"];
const roleBadge: Record<string, string> = {
  EMPLOYEE: "bg-gray-100 text-gray-700",
  MANAGER: "bg-blue-100 text-blue-700",
  HR_ADMIN: "bg-indigo-100 text-indigo-700",
};

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: Array<{ row: number; message: string }> } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const { data: users = [], isLoading, isError, error } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(user: User) {
    setEditingId(user.id);
    setForm(userToForm(user));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function openImportCSV() {
    setImportFile(null);
    setImportResult(null);
    setShowImportModal(true);
  }

  function closeImportModal() {
    setShowImportModal(false);
    setImportFile(null);
    setImportResult(null);
  }

  function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (importFile) {
      importMutation.mutate(importFile);
    }
  }

  function downloadCSVTemplate() {
    const csvContent = `name,email,role,team,title,department
Alice Smith,alice@example.com,EMPLOYEE,Engineering,Software Engineer,Operations
Bob Jones,bob@example.com,MANAGER,Sales,Sales Manager,Commercial`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "users_template.csv");
    link.click();
  }

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (editingId) {
        const payload: Parameters<typeof updateUser>[1] = {
          role: f.role,
          team: f.team || undefined,
          title: f.title || undefined,
          department: f.department || undefined,
        };
        if (f.name.trim()) payload.name = f.name.trim();
        if (f.email.trim()) payload.email = f.email.trim();
        if (f.password) payload.password = f.password;
        return updateUser(editingId, payload);
      } else {
        return createUser({
          name: f.name.trim(),
          email: f.email.trim(),
          password: f.password,
          role: f.role,
          team: f.team || undefined,
          title: f.title || undefined,
          department: f.department || undefined,
        });
      }
    },
    onSuccess: () => {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setFeedback({ type: "success", msg: editingId ? "User updated." : "User created." });
      setTimeout(() => setFeedback(null), 4000);
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      setFeedback({
        type: "error",
        msg: err.response?.data?.message ?? err.message ?? "An error occurred.",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      return importUsersFromCSV(file);
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (result.created > 0 || result.errors.length === 0) {
        setFeedback({ type: "success", msg: `Imported ${result.created} user${result.created !== 1 ? "s" : ""}. Skipped: ${result.skipped}. Errors: ${result.errors.length}` });
      }
      setTimeout(() => setFeedback(null), 6000);
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      setFeedback({
        type: "error",
        msg: err.response?.data?.message ?? err.message ?? "Import failed.",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate(form);
  }

  const field = (label: string, key: keyof FormState, type = "text", required = false, hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
        <div className="flex gap-3">
          <button
            onClick={openImportCSV}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            📥 Import CSV
          </button>
          <button
            onClick={openAdd}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add User
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${feedback.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {feedback.msg}
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading…</p>}
      {isError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">Failed to load users.</p>
          <p className="mt-1 text-xs text-red-600">
            {(error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
              ?? (error as { message?: string })?.message ?? "Unknown error"}
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Email", "Role", "Department", "Team", "Title", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${roleBadge[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.department ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{user.team ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{user.title ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(user)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit User" : "Add User"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {field("Full Name", "name", "text", !editingId)}
                {field("Email", "email", "email", !editingId)}
              </div>
              <div>
                {field(
                  editingId ? "New Password (leave blank to keep)" : "Password",
                  "password",
                  "password",
                  !editingId,
                  "Minimum 8 characters"
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role<span className="text-red-500 ml-0.5">*</span></label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {field("Department", "department")}
                {field("Team", "team")}
                {field("Title / Job Title", "title")}
              </div>

              {saveMutation.isError && (
                <p className="text-sm text-red-600">
                  {(saveMutation.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
                    ?? (saveMutation.error as { message?: string })?.message ?? "An error occurred."}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving…" : editingId ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Import Users from CSV</h2>
              <button onClick={closeImportModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleImportSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File<span className="text-red-500 ml-0.5">*</span></label>
                <input
                  type="file"
                  accept=".csv"
                  required
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">Columns: name, email, role, team, title, department</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <button
                  type="button"
                  onClick={downloadCSVTemplate}
                  className="text-sm text-blue-600 font-medium hover:text-blue-700 underline"
                >
                  Download CSV Template
                </button>
              </div>

              {importResult && (
                <div className={`rounded-md p-3 text-sm ${importResult.errors.length > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
                  <p className={`font-medium ${importResult.errors.length > 0 ? "text-yellow-800" : "text-green-800"}`}>
                    Created: {importResult.created} | Skipped: {importResult.skipped}
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-yellow-700 max-h-32 overflow-y-auto">
                      <p className="font-medium text-xs mb-1">Errors:</p>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs">
                          Row {err.row}: {err.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importMutation.isPending}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {importMutation.isPending ? "Importing…" : "Import"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
