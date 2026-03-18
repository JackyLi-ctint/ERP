import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

async function main() {
  // Clear existing data
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.publicHoliday.deleteMany({});

  console.log("Creating demo users...");

  // Create HR Admin 1
  const hrAdmin1 = await prisma.user.create({
    data: {
      name: "Alice HR Admin",
      email: "alice@company.com",
      passwordHash: await bcrypt.hash("SecurePass123", 12),
      role: Role.HR_ADMIN,
      department: "Human Resources",
      team: null,
    },
  });

  // Create HR Admin 2
  const hrAdmin2 = await prisma.user.create({
    data: {
      name: "Bob HR Admin",
      email: "bob@company.com",
      passwordHash: await bcrypt.hash("SecurePass456", 12),
      role: Role.HR_ADMIN,
      department: "Human Resources",
      team: null,
    },
  });

  // Create Manager
  const manager = await prisma.user.create({
    data: {
      name: "Charlie Manager",
      email: "charlie@company.com",
      passwordHash: await bcrypt.hash("SecurePass789", 12),
      role: Role.MANAGER,
      department: "Engineering",
      team: "Engineering",
    },
  });

  // Create Employee 1
  const employee1 = await prisma.user.create({
    data: {
      name: "Diana Employee",
      email: "diana@company.com",
      passwordHash: await bcrypt.hash("SecurePass012", 12),
      role: Role.EMPLOYEE,
      department: "Engineering",
      team: "Engineering",
    },
  });

  // Create Employee 2
  const employee2 = await prisma.user.create({
    data: {
      name: "Eve Employee",
      email: "eve@company.com",
      passwordHash: await bcrypt.hash("SecurePass345", 12),
      role: Role.EMPLOYEE,
      department: "Engineering",
      team: "Engineering",
    },
  });

  console.log("Demo users created successfully:");
  console.log(`- HR Admin 1: ${hrAdmin1.email}`);
  console.log(`- HR Admin 2: ${hrAdmin2.email}`);
  console.log(`- Manager: ${manager.email} (Engineering team)`);
  console.log(`- Employee 1: ${employee1.email} (Engineering team)`);
  console.log(`- Employee 2: ${employee2.email} (Engineering team)`);

  // Seed HK public holidays
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
  console.log(`HK public holidays seeded: ${HK_HOLIDAYS.length} holidays`);
}

main()
  .catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
