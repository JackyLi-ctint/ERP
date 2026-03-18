import { PrismaClient } from "@prisma/client";

/**
 * Check if a date is a weekend (Saturday = 6, Sunday = 0)
 */
export function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Check if a date is a public holiday
 * @param date The date to check
 * @param holidays Set of ISO date strings (YYYY-MM-DD)
 */
export function isPublicHoliday(date: Date, holidays: Set<string>): boolean {
  // Format using UTC components to ensure timezone consistency
  const isoDateString = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  return holidays.has(isoDateString);
}

/**
 * Count working days between start and end dates (inclusive)
 * Excludes weekends and public holidays
 * @param start Start date
 * @param end End date
 * @param holidays Set of ISO date strings (YYYY-MM-DD) for public holidays
 * @param halfDay Whether to count as half day (only affects first day)
 * @param period 'AM' or 'PM' (only used if halfDay=true)
 * @returns Number of working days (can be decimal for half days)
 */
export function countWorkingDays(
  start: Date,
  end: Date,
  holidays: Set<string>,
  halfDay?: boolean,
  _period?: "AM" | "PM"
): number {
  // Return 0 if start > end
  if (start > end) {
    return 0;
  }

  let count = 0;
  // Normalize start and end to UTC midnight to handle local-time construction
  const startUtc = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  // Initialize loop cursor using UTC to avoid DST issues
  const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (current <= endUTC) {
    // Skip weekends and public holidays
    if (!isWeekend(current) && !isPublicHoliday(current, holidays)) {
      // First day gets half count if halfDay flag is set
      if (current.getTime() === startUtc.getTime() && halfDay) {
        count += 0.5;
      } else {
        count += 1;
      }
    }

    // Move to next day using UTC methods
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

/**
 * Get a set of public holiday ISO date strings for a given year
 * @param year Year to fetch holidays for
 * @param prismaClient Prisma client instance
 * @returns Set of ISO date strings (YYYY-MM-DD)
 */
export async function getHolidaySet(
  year: number,
  prismaClient: PrismaClient
): Promise<Set<string>> {
  const holidays = await prismaClient.publicHoliday.findMany({
    where: { year },
  });

  const holidaySet = new Set<string>();
  holidays.forEach((holiday: { date: Date }) => {
    const isoDateString = holiday.date.toISOString().split("T")[0];
    holidaySet.add(isoDateString);
  });

  return holidaySet;
}
