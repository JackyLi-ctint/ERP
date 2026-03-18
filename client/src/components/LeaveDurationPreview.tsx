import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/api";

interface Holiday {
  id: number;
  date: string;
  name: string;
  year: number;
}

function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function isPublicHoliday(date: Date, holidays: Set<string>): boolean {
  const isoDateString = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return holidays.has(isoDateString);
}

function countWorkingDays(
  start: Date,
  end: Date,
  holidays: Set<string>,
  halfDay?: boolean,
  _period?: "AM" | "PM"
): number {
  if (start > end) {
    return 0;
  }

  let count = 0;
  const startUtc = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const current = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const endUTC = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );

  while (current <= endUTC) {
    if (!isWeekend(current) && !isPublicHoliday(current, holidays)) {
      if (current.getTime() === startUtc.getTime() && halfDay) {
        count += 0.5;
      } else {
        count += 1;
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

interface LeaveDurationPreviewProps {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  halfDay?: boolean;
  period?: "AM" | "PM";
}

export function LeaveDurationPreview({
  startDate,
  endDate,
  halfDay,
  period,
}: LeaveDurationPreviewProps) {
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());

  // Determine which years we need holidays for
  const years = new Set<number>();
  if (startDate) {
    const start = new Date(startDate + "T00:00:00Z");
    years.add(start.getUTCFullYear());
  }
  if (endDate) {
    const end = new Date(endDate + "T00:00:00Z");
    years.add(end.getUTCFullYear());
  }

  // Fetch holidays for relevant years
  const { isLoading, data: selectedHolidays } = useQuery({
    queryKey: ["holidays", ...Array.from(years).sort()],
    queryFn: async () => {
      if (years.size === 0) return [];

      const yearArray = Array.from(years);
      const yearParams = yearArray.map((y) => `year=${y}`).join("&");
      const response = await apiClient.get(`/holidays?${yearParams}`);
      return response.data.holidays as Holiday[];
    },
    enabled: years.size > 0,
  });

  // Update holiday set when holidays are fetched
  useEffect(() => {
    if (selectedHolidays && selectedHolidays.length > 0) {
      const set = new Set<string>();
      selectedHolidays.forEach((h) => {
        const isoDate = h.date.split("T")[0] ?? h.date; // Extract YYYY-MM-DD
        set.add(isoDate);
      });
      setHolidaySet(set);
    }
  }, [selectedHolidays]);

  // Calculate working days
  let calculatedDays: number | null = null;
  let statusMessage = "";

  if (startDate && endDate) {
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");

    if (start > end) {
      statusMessage = "Invalid date range";
    } else if (start.getTime() === end.getTime() && halfDay && !period) {
      statusMessage = "Select AM or PM";
    } else if (!halfDay && start.getTime() !== end.getTime() && !period) {
      // Multi-day: just calculate
      calculatedDays = countWorkingDays(start, end, holidaySet, false);
    } else {
      calculatedDays = countWorkingDays(start, end, holidaySet, halfDay, period);
    }
  }

  if (isLoading) {
    return (
      <div className="p-2 bg-gray-100 rounded animate-pulse">
        <div className="h-5 bg-gray-300 rounded w-24"></div>
      </div>
    );
  }

  if (statusMessage) {
    return <div className="p-2 text-sm text-gray-500">{statusMessage}</div>;
  }

  if (calculatedDays !== null) {
    if (calculatedDays === 0) {
      return (
        <div className="p-2 text-sm text-red-600">
          No working days in this range
        </div>
      );
    }

    const daysText = calculatedDays === 1 ? "day" : "days";
    return (
      <div className="p-2 text-sm text-green-600 font-medium">
        {calculatedDays} working {daysText}
      </div>
    );
  }

  return null;
}
