import { PrismaClient } from "@prisma/client";
import { initBalances } from "../services/leaveBalance.service";

const prisma = new PrismaClient();

describe("initBalances", () => {
  let hrAdminId: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.user.deleteMany({});

    // Create HR Admin
    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-admin-1",
        name: "HR Admin",
        email: "hr@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });
    hrAdminId = hrAdmin.id;
  });

  afterAll(async () => {
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  test("should create balance for each user × active leave type", async () => {
    // Create leave types
    const annual = await prisma.leaveType.create({
      data: {
        name: "Annual Leave",
        defaultDays: 20,
        isCarryForward: false,
        requiresDocument: false,
        isActive: true,
        createdById: hrAdminId,
      },
    });

    const sick = await prisma.leaveType.create({
      data: {
        name: "Sick Leave",
        defaultDays: 10,
        isCarryForward: false,
        requiresDocument: true,
        isActive: true,
        createdById: hrAdminId,
      },
    });

    // Create inactive leave type (should be skipped)
    await prisma.leaveType.create({
      data: {
        name: "Inactive Leave",
        defaultDays: 5,
        isCarryForward: false,
        requiresDocument: false,
        isActive: false,
        createdById: hrAdminId,
      },
    });

    // Create users
    const user1 = await prisma.user.create({
      data: {
        id: "user-1",
        name: "User 1",
        email: "user1@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    const user2 = await prisma.user.create({
      data: {
        id: "user-2",
        name: "User 2",
        email: "user2@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    // Run initBalances
    const result = await initBalances(2025, prisma);

    // Should create 3 users (hr-admin + user-1 + user-2) × 2 active leave types = 6 balances
    expect(result.created).toBe(6);
    expect(result.skipped).toBe(0);

    // Verify balances were created for both users
    const user1Balances = await prisma.leaveBalance.findMany({
      where: { userId: user1.id, year: 2025 },
    });
    expect(user1Balances.length).toBe(2);

    const user2Balances = await prisma.leaveBalance.findMany({
      where: { userId: user2.id, year: 2025 },
    });
    expect(user2Balances.length).toBe(2);

    const annualBalance = user1Balances.find((b) => b.leaveTypeId === annual.id);
    expect(annualBalance).toBeDefined();
    expect(annualBalance?.totalDays).toBe(20);
    expect(annualBalance?.usedDays).toBe(0);
    expect(annualBalance?.pendingDays).toBe(0);

    const sickBalance = user1Balances.find((b) => b.leaveTypeId === sick.id);
    expect(sickBalance).toBeDefined();
    expect(sickBalance?.totalDays).toBe(10);
  });

  test("should be idempotent - running twice does not duplicate balances", async () => {
    // Create leave type
    await prisma.leaveType.create({
      data: {
        name: "Annual Leave",
        defaultDays: 20,
        isCarryForward: false,
        requiresDocument: false,
        isActive: true,
        createdById: hrAdminId,
      },
    });

    // Create user
    await prisma.user.create({
      data: {
        id: "user-1",
        name: "User 1",
        email: "user1@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    // Run initBalances first time (2 users: hr-admin + user-1) × 1 leave type = 2
    const result1 = await initBalances(2025, prisma);
    expect(result1.created).toBe(2);
    expect(result1.skipped).toBe(0);

    // Run initBalances second time for same year
    const result2 = await initBalances(2025, prisma);
    expect(result2.created).toBe(0);
    expect(result2.skipped).toBe(2);

    // Verify total balances is still 2 (not 4)
    const allBalances = await prisma.leaveBalance.findMany({
      where: { year: 2025 },
    });
    expect(allBalances.length).toBe(2);
  });

  test("should exclude inactive leave types from balance init", async () => {
    // Create active leave type
    await prisma.leaveType.create({
      data: {
        name: "Active Leave",
        defaultDays: 20,
        isCarryForward: false,
        requiresDocument: false,
        isActive: true,
        createdById: hrAdminId,
      },
    });

    // Create inactive leave type
    await prisma.leaveType.create({
      data: {
        name: "Inactive Leave",
        defaultDays: 10,
        isCarryForward: false,
        requiresDocument: false,
        isActive: false,
        createdById: hrAdminId,
      },
    });

    // Create user
    const testUser = await prisma.user.create({
      data: {
        id: "user-1",
        name: "User 1",
        email: "user1@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    // Run initBalances
    const result = await initBalances(2025, prisma);

    // Should create 2 balances (1 for HR Admin, 1 for test user) × 1 active leave type
    expect(result.created).toBe(2);

    // Verify that only the active leave type got balances
    const balances = await prisma.leaveBalance.findMany({
      where: { year: 2025 },
      include: { leaveType: true },
    });
    expect(balances.length).toBe(2);
    expect(balances.every((b) => b.leaveType.isActive === true)).toBe(true);
    
    // Verify test user balance
    const userBalance = balances.find((b) => b.userId === testUser.id);
    expect(userBalance).toBeDefined();
    expect(userBalance?.totalDays).toBe(20); // From active leave type
  });
});
