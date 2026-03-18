import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaveCalendar, CalendarEntry } from "../lib/api";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border border-amber-200",
  APPROVED: "bg-green-100 text-green-800 border border-green-200",
  CANCEL_REQUESTED: "bg-orange-100 text-orange-800 border border-orange-200",
  REJECTED: "bg-red-100 text-red-800 border border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  CANCEL_REQUESTED: "Cancel Req.",
  REJECTED: "Rejected",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getEntriesForDay(entries: CalendarEntry[], day: Date): CalendarEntry[] {
  return entries.filter((e) => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    // Normalize to UTC midnight for comparison
    const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const targetDay = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
    return startDay <= targetDay && targetDay <= endDay;
  });
}

export function LeaveCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["leave-calendar", year, month],
    queryFn: () => getLeaveCalendar(year, month),
  });

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Build grid: first day of month's weekday offset, then all days
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = firstDay.getDay(); // 0=Sun

  // Cells: leading empty slots + day cells
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevMonth}
          className="rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
        >
          ← Previous
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <button
          onClick={nextMonth}
          className="rounded-md bg-white border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
        >
          Next →
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
          Loading...
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-200">
            {DAY_HEADERS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 bg-white">
            {cells.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[96px] border-b border-r border-gray-100 bg-gray-50"
                  />
                );
              }

              const cellDate = new Date(year, month - 1, day);
              const dayEntries = getEntriesForDay(entries, cellDate);
              const isToday =
                today.getFullYear() === year &&
                today.getMonth() + 1 === month &&
                today.getDate() === day;

              return (
                <div
                  key={day}
                  className="min-h-[96px] border-b border-r border-gray-100 p-1.5"
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                      isToday
                        ? "bg-indigo-600 text-white"
                        : "text-gray-700"
                    }`}
                  >
                    {day}
                  </span>

                  <div className="space-y-0.5">
                    {dayEntries.map((entry) => {
                      const chipStyle =
                        STATUS_STYLES[entry.status] ??
                        "bg-gray-100 text-gray-800 border border-gray-200";
                      const label = STATUS_LABELS[entry.status] ?? entry.status;
                      return (
                        <div
                          key={`${entry.id}-${day}`}
                          className={`rounded px-1 py-0.5 text-[10px] leading-tight truncate ${chipStyle}`}
                          title={`${entry.employeeName} — ${entry.leaveTypeName} (${label})`}
                        >
                          <span className="font-medium truncate">{entry.employeeName}</span>
                          <span className="ml-1 opacity-75">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
