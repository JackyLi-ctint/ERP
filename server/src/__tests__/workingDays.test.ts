import {
  isWeekend,
  isPublicHoliday,
  countWorkingDays,
} from "../services/workingDays.service";

describe("workingDays.service", () => {
  const holidays2025 = new Set([
    "2025-01-01", // New Year's Day (Wednesday)
    "2025-04-04", // Ching Ming Festival (Friday)
    "2025-04-18", // Good Friday (Friday)
    "2025-04-19", // Day after Good Friday (Saturday)
    "2025-04-21", // Easter Monday (Monday)
    "2025-05-01", // Labour Day (Thursday)
    "2025-10-01", // National Day (Wednesday)
    "2025-12-25", // Christmas Day (Thursday)
    "2025-12-26", // Boxing Day (Friday)
  ]);

  const holidays2026 = new Set([
    "2026-01-01", // New Year's Day (Thursday)
  ]);

  describe("isWeekend", () => {
    test("should return true for Saturday", () => {
      const saturday = new Date("2025-09-06"); // Saturday
      expect(isWeekend(saturday)).toBe(true);
    });

    test("should return true for Sunday", () => {
      const sunday = new Date("2025-09-07"); // Sunday
      expect(isWeekend(sunday)).toBe(true);
    });

    test("should return false for Monday", () => {
      const monday = new Date("2025-09-01"); // Monday
      expect(isWeekend(monday)).toBe(false);
    });

    test("should return false for Friday", () => {
      const friday = new Date("2025-09-05"); // Friday
      expect(isWeekend(friday)).toBe(false);
    });
  });

  describe("isPublicHoliday", () => {
    test("should return true for a public holiday in the set", () => {
      const newYearDay = new Date("2025-01-01");
      expect(isPublicHoliday(newYearDay, holidays2025)).toBe(true);
    });

    test("should return false for a date not in the set", () => {
      const randomDay = new Date("2025-09-02");
      expect(isPublicHoliday(randomDay, holidays2025)).toBe(false);
    });

    test("should return false for an empty holiday set", () => {
      const emptySet = new Set<string>();
      const anyDate = new Date("2025-01-01");
      expect(isPublicHoliday(anyDate, emptySet)).toBe(false);
    });
  });

  describe("countWorkingDays", () => {
    test("should count full week (Mon-Fri) with no holidays as 5 days", () => {
      const start = new Date("2025-09-01"); // Monday
      const end = new Date("2025-09-05"); // Friday
      const count = countWorkingDays(start, end, new Set());
      expect(count).toBe(5);
    });

    test("should exclude weekends: Mon to Sun = 5 days", () => {
      const start = new Date("2025-09-01"); // Monday
      const end = new Date("2025-09-07"); // Sunday
      const count = countWorkingDays(start, end, new Set());
      expect(count).toBe(5);
    });

    test("should exclude public holidays: single holiday (New Year) = 0 days", () => {
      const start = new Date("2026-01-01"); // Thursday, New Year's Day
      const end = new Date("2026-01-01");
      const count = countWorkingDays(start, end, holidays2026);
      expect(count).toBe(0);
    });

    test("should count half-day (AM) as 0.5 days", () => {
      const start = new Date("2025-09-02"); // Tuesday, not a holiday
      const end = new Date("2025-09-02");
      const count = countWorkingDays(start, end, new Set(), true, "AM");
      expect(count).toBe(0.5);
    });

    test("should count half-day (PM) as 0.5 days", () => {
      const start = new Date("2025-09-02"); // Tuesday
      const end = new Date("2025-09-02");
      const count = countWorkingDays(start, end, new Set(), true, "PM");
      expect(count).toBe(0.5);
    });

    test("should count single day non-holiday as 1 day", () => {
      const start = new Date("2025-09-02"); // Tuesday
      const end = new Date("2025-09-02");
      const count = countWorkingDays(start, end, new Set());
      expect(count).toBe(1);
    });

    test("should exclude National Day (cross-month): 2025-09-29 to 2025-10-03 = 4 days", () => {
      const start = new Date("2025-09-29"); // Monday
      const end = new Date("2025-10-03"); // Friday
      // 29(Mon), 30(Tue), 01(Wed-National Day excluded), 02(Thu), 03(Fri) = 4 days
      const count = countWorkingDays(start, end, holidays2025);
      expect(count).toBe(4);
    });

    test("should handle cross-year: 2025-12-29 to 2026-01-02 = 4 days", () => {
      const start = new Date("2025-12-29"); // Monday
      const end = new Date("2026-01-02"); // Friday
      // 2025-12-25 and 2025-12-26 are not in range
      // 2025-12-29(Mon), 2025-12-30(Tue), 2025-12-31(Wed), 2026-01-02(Fri)
      // 2026-01-01 is New Year but not included (it's Thu between Wed and Fri but not in range count)
      // Actually: 2025-12-29(Mon), 2025-12-30(Tue), 2025-12-31(Wed), 2026-01-01(Thu-holiday),  2026-01-02(Fri)
      // So: 4 days (excluding 2026-01-01 holiday and 2026-01-04, 2026-01-05 weekend)
      const holidays = new Set([...holidays2025, ...holidays2026]);
      const count = countWorkingDays(start, end, holidays);
      expect(count).toBe(4);
    });

    test("should return 0 when start > end", () => {
      const start = new Date("2025-09-05"); // Friday
      const end = new Date("2025-09-01"); // Monday (before start)
      const count = countWorkingDays(start, end, new Set());
      expect(count).toBe(0);
    });

    test("should return 0 for a single Saturday", () => {
      const sat = new Date("2025-09-06"); // Saturday
      const count = countWorkingDays(sat, sat, new Set());
      expect(count).toBe(0);
    });

    test("should return 0 for a single Sunday", () => {
      const sun = new Date("2025-09-07"); // Sunday
      const count = countWorkingDays(sun, sun, new Set());
      expect(count).toBe(0);
    });

    test("should exclude both holidays and weekends in a complex range", () => {
      const start = new Date("2025-10-01"); // Wednesday (National Day)
      const end = new Date("2025-10-05"); // Sunday
      // 01(Wed-holiday), 02(Thu), 03(Fri), 04(Sat-weekend), 05(Sun-weekend) = 2 days
      const count = countWorkingDays(start, end, holidays2025);
      expect(count).toBe(2);
    });
  });
});
