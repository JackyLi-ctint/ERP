import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getAdminBalances,
  getUsers,
  initBalances,
  carryForwardBalances,
  type BalanceRow,
} from "../../lib/api";

export function BalanceAdminPage() {
  const currentYear = new Date().getFullYear();

  // Section 1 — Init Balances
  const [initYear, setInitYear] = useState(currentYear);
  const [initMessage, setInitMessage] = useState("");

  // Section 2 — Carry Forward
  const [fromYear, setFromYear] = useState(currentYear - 1);
  const [toYear, setToYear] = useState(currentYear);
  const [carryMessage, setCarryMessage] = useState("");

  // Section 3 — View Balances
  const [filterYear, setFilterYear] = useState<number | "">(currentYear);
  const [filterUserId, setFilterUserId] = useState("");
  const [applied, setApplied] = useState<{ year?: number; userId?: string }>({
    year: currentYear,
  });

  const { data: usersData } = useQuery({ queryKey: ["users"], queryFn: getUsers });

  const { data: balancesData, isLoading: balancesLoading, refetch: refetchBalances } = useQuery({
    queryKey: ["adminBalances", applied],
    queryFn: () => getAdminBalances({ year: applied.year, userId: applied.userId }),
  });

  const initMutation = useMutation({
    mutationFn: (year: number) => initBalances(year),
    onSuccess: (data) => {
      setInitMessage(`Created ${data.created}, Skipped ${data.skipped}`);
    },
    onError: (err: Error) => {
      setInitMessage(`Error: ${err.message}`);
    },
  });

  const carryMutation = useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) => carryForwardBalances(from, to),
    onSuccess: (data) => {
      setCarryMessage(`Carried ${data.carried}, Skipped ${data.skipped}`);
    },
    onError: (err: Error) => {
      setCarryMessage(`Error: ${err.message}`);
    },
  });

  const handleLoad = () => {
    const year = typeof filterYear === "number" ? filterYear : undefined;
    setApplied({ year, userId: filterUserId || undefined });
  };

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
            onClick={() => {
              setInitMessage("");
              initMutation.mutate(initYear);
            }}
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
            onClick={() => {
              setCarryMessage("");
              carryMutation.mutate({ from: fromYear, to: toYear });
            }}
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

      {/* Section 3 — View Balances */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">View Balances</h2>
        <div className="flex items-end gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value, 10) : "")}
              className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All users</option>
              {usersData?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              handleLoad();
              refetchBalances();
            }}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Load
          </button>
        </div>

        {balancesLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : !balancesData || balancesData.balances.length === 0 ? (
          <p className="text-gray-500 text-sm">No balances found for the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["User", "Email", "Leave Type", "Year", "Total", "Used", "Pending", "Available"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {balancesData.balances.map((b: BalanceRow) => {
                  const available = b.totalDays - b.usedDays - b.pendingDays;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{b.userName}</td>
                      <td className="px-4 py-3 text-gray-700">{b.userEmail}</td>
                      <td className="px-4 py-3 text-gray-700">{b.leaveTypeName}</td>
                      <td className="px-4 py-3 text-gray-700">{b.year}</td>
                      <td className="px-4 py-3 text-gray-700">{b.totalDays}</td>
                      <td className="px-4 py-3 text-gray-700">{b.usedDays}</td>
                      <td className="px-4 py-3 text-gray-700">{b.pendingDays}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{available}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
