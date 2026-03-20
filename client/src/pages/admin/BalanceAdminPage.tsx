import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminBalances,
  initBalances,
  carryForwardBalances,
  patchAdminBalance,
  type BalanceRow,
} from "../../lib/api";

// Group flat balance rows by user
function groupByUser(balances: BalanceRow[]): Map<string, { userName: string; userEmail: string; rows: BalanceRow[] }> {
  const map = new Map<string, { userName: string; userEmail: string; rows: BalanceRow[] }>();
  for (const b of balances) {
    if (!map.has(b.userId)) {
      map.set(b.userId, { userName: b.userName, userEmail: b.userEmail, rows: [] });
    }
    map.get(b.userId)!.rows.push(b);
  }
  return map;
}

export function BalanceAdminPage() {
  const currentYear = new Date().getFullYear();
  const queryClient = useQueryClient();

  // Section 1 — Init Balances
  const [initYear, setInitYear] = useState(currentYear);
  const [initMessage, setInitMessage] = useState("");

  // Section 2 — Carry Forward
  const [fromYear, setFromYear] = useState(currentYear - 1);
  const [toYear, setToYear] = useState(currentYear);
  const [carryMessage, setCarryMessage] = useState("");

  // Section 3 — View Balances
  const [filterYear, setFilterYear] = useState(currentYear);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ["adminBalances", filterYear],
    queryFn: () => getAdminBalances({ year: filterYear }),
  });

  const initMutation = useMutation({
    mutationFn: (year: number) => initBalances(year),
    onSuccess: (data) => {
      setInitMessage(`Created ${data.created}, Skipped ${data.skipped}`);
      queryClient.invalidateQueries({ queryKey: ["adminBalances"] });
    },
    onError: (err: Error) => setInitMessage(`Error: ${err.message}`),
  });

  const carryMutation = useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) => carryForwardBalances(from, to),
    onSuccess: (data) => {
      setCarryMessage(`Carried ${data.carried}, Skipped ${data.skipped}`);
      queryClient.invalidateQueries({ queryKey: ["adminBalances"] });
    },
    onError: (err: Error) => setCarryMessage(`Error: ${err.message}`),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, totalDays }: { id: number; totalDays: number }) => patchAdminBalance(id, totalDays),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["adminBalances"] });
    },
  });

  function startEdit(b: BalanceRow) {
    setEditingId(b.id);
    setEditValue(String(b.totalDays));
  }

  function saveEdit(id: number) {
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val >= 0) patchMutation.mutate({ id, totalDays: val });
  }

  const grouped = groupByUser(balancesData?.balances ?? []);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Balance Administration</h1>

      {/* Section 1 — Init Balances */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Initialize Balances</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={initYear}
              onChange={(e) => setInitYear(parseInt(e.target.value, 10))}
              min={2000}
              max={2100}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <button
            onClick={() => { setInitMessage(""); initMutation.mutate(initYear); }}
            disabled={initMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {initMutation.isPending ? "Initializing…" : "Initialize Balances"}
          </button>
        </div>
        {initMessage && (
          <p className={`mt-3 text-sm ${initMessage.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {initMessage}
          </p>
        )}
      </section>

      {/* Section 2 — Carry Forward */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Carry Forward Balances</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Year</label>
            <input
              type="number"
              value={fromYear}
              onChange={(e) => setFromYear(parseInt(e.target.value, 10))}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Year</label>
            <input
              type="number"
              value={toYear}
              onChange={(e) => setToYear(parseInt(e.target.value, 10))}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <button
            onClick={() => { setCarryMessage(""); carryMutation.mutate({ from: fromYear, to: toYear }); }}
            disabled={carryMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {carryMutation.isPending ? "Processing…" : "Carry Forward"}
          </button>
        </div>
        {carryMessage && (
          <p className={`mt-3 text-sm ${carryMessage.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {carryMessage}
          </p>
        )}
      </section>

      {/* Section 3 — Balances by User */}
      <section className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Balances by User</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Year</label>
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value, 10))}
              min={2000}
              max={2100}
              className="block w-28 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {balancesLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : grouped.size === 0 ? (
          <p className="text-gray-500 text-sm">No balances found for {filterYear}.</p>
        ) : (
          <div className="space-y-4">
            {[...grouped.entries()].map(([userId, { userName, userEmail, rows }]) => (
              <div key={userId} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* User header */}
                <div className="bg-gray-50 px-4 py-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{userName}</p>
                    <p className="text-xs text-gray-500">{userEmail}</p>
                  </div>
                </div>

                {/* Balance rows */}
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-white">
                    <tr>
                      {["Leave Type", "Total Days", "Used", "Pending", "Available", ""].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {rows.map((b) => {
                      const available = b.totalDays - b.usedDays - b.pendingDays;
                      const isEditing = editingId === b.id;
                      return (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-700">{b.leaveTypeName}</td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editValue}
                                min={0}
                                max={365}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium text-gray-900">{b.totalDays}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{b.usedDays}</td>
                          <td className="px-4 py-2 text-yellow-600">{b.pendingDays}</td>
                          <td className="px-4 py-2 font-semibold text-green-700">{available}</td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            {isEditing ? (
                              <span className="inline-flex gap-2">
                                <button
                                  onClick={() => saveEdit(b.id)}
                                  disabled={patchMutation.isPending}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => startEdit(b)}
                                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                              >
                                Adjust
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
