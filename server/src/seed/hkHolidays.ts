import prisma from "../lib/prisma";

const HK_HOLIDAYS = [
  // 2025
  { date: "2025-01-01", name: "New Year's Day", year: 2025 },
  { date: "2025-01-29", name: "Lunar New Year's Day", year: 2025 },
  { date: "2025-01-30", name: "2nd day of Lunar New Year", year: 2025 },
  { date: "2025-01-31", name: "3rd day of Lunar New Year", year: 2025 },
  { date: "2025-04-04", name: "Ching Ming Festival", year: 2025 },
  { date: "2025-04-18", name: "Good Friday", year: 2025 },
  { date: "2025-04-19", name: "Day after Good Friday", year: 2025 },
  { date: "2025-04-21", name: "Easter Monday", year: 2025 },
  { date: "2025-05-01", name: "Labour Day", year: 2025 },
  { date: "2025-05-05", name: "The Birthday of the Buddha", year: 2025 },
  { date: "2025-05-31", name: "Tuen Ng Festival", year: 2025 },
  { date: "2025-07-01", name: "HKSAR Establishment Day", year: 2025 },
  { date: "2025-10-01", name: "National Day", year: 2025 },
  { date: "2025-10-07", name: "Chung Yeung Festival", year: 2025 },
  { date: "2025-12-25", name: "Christmas Day", year: 2025 },
  { date: "2025-12-26", name: "The first weekday after Christmas Day", year: 2025 },

  // 2026
  { date: "2026-01-01", name: "New Year's Day", year: 2026 },
  { date: "2026-02-17", name: "Lunar New Year's Day", year: 2026 },
  { date: "2026-02-18", name: "2nd day of Lunar New Year", year: 2026 },
  { date: "2026-02-19", name: "3rd day of Lunar New Year", year: 2026 },
  { date: "2026-04-05", name: "Ching Ming Festival", year: 2026 },
  { date: "2026-04-03", name: "Good Friday", year: 2026 },
  { date: "2026-04-04", name: "Day after Good Friday", year: 2026 },
  { date: "2026-04-06", name: "Easter Monday", year: 2026 },
  { date: "2026-05-01", name: "Labour Day", year: 2026 },
  { date: "2026-05-24", name: "The Birthday of the Buddha", year: 2026 },
  { date: "2026-06-19", name: "Tuen Ng Festival", year: 2026 },
  { date: "2026-07-01", name: "HKSAR Establishment Day", year: 2026 },
  { date: "2026-09-28", name: "Day following the Mid-Autumn Festival (substitute day)", year: 2026 },
  { date: "2026-10-01", name: "National Day", year: 2026 },
  { date: "2026-10-25", name: "Chung Yeung Festival", year: 2026 },
  { date: "2026-12-25", name: "Christmas Day", year: 2026 },
  { date: "2026-12-26", name: "The first weekday after Christmas Day", year: 2026 },

  // 2027
  { date: "2027-01-01", name: "New Year's Day", year: 2027 },
  { date: "2027-02-06", name: "Lunar New Year's Day", year: 2027 },
  { date: "2027-02-07", name: "2nd day of Lunar New Year", year: 2027 },
  { date: "2027-02-08", name: "3rd day of Lunar New Year", year: 2027 },
  { date: "2027-03-26", name: "Good Friday", year: 2027 },
  { date: "2027-03-27", name: "Day after Good Friday", year: 2027 },
  { date: "2027-03-29", name: "Easter Monday", year: 2027 },
  { date: "2027-04-05", name: "Ching Ming Festival", year: 2027 },
  { date: "2027-05-01", name: "Labour Day", year: 2027 },
  { date: "2027-05-13", name: "The Birthday of the Buddha", year: 2027 },
  { date: "2027-07-01", name: "HKSAR Establishment Day", year: 2027 },
  { date: "2027-07-09", name: "Tuen Ng Festival", year: 2027 },
  { date: "2027-09-14", name: "Day following the Mid-Autumn Festival", year: 2027 },
  { date: "2027-10-01", name: "National Day", year: 2027 },
  { date: "2027-10-14", name: "Chung Yeung Festival", year: 2027 },
  { date: "2027-12-25", name: "Christmas Day", year: 2027 },
  { date: "2027-12-27", name: "The first weekday after Christmas Day", year: 2027 },
];

async function seedHolidays() {
  console.log("Seeding HK public holidays...");

  for (const holiday of HK_HOLIDAYS) {
    await prisma.publicHoliday.upsert({
      where: { date: new Date(holiday.date) },
      update: { name: holiday.name, year: holiday.year },
      create: {
        date: new Date(holiday.date),
        name: holiday.name,
        year: holiday.year,
      },
    });
  }

  console.log(`Seeded ${HK_HOLIDAYS.length} holidays`);
}

async function main() {
  await seedHolidays();
}

main()
  .then(() => {
    console.log("Seed completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
