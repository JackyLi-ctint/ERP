import request from "supertest";
import { createApp } from "../app";
import { PrismaClient } from "@prisma/client";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("Leave Balance Routes", () => {
  const app = createApp();

  let employeeToken: string;
  let managerToken: string;
  let hrAdminToken: string;

  let employeeId: string;
  let employee2Id: string;
  let managerUserId: string;
  let hrAdminId: string;

  let annualLeaveTypeId: number;

  beforeEach(async () => {
    // Clean up database
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.user.deleteMany({});

    // Create users
    const employee = await prisma.user.create({
      data: {
        id: "employee-1",
        name: "Employee 1",
        email: "employee1@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    const employee2 = await prisma.user.create({
      data: {
        id: "employee-2",
        name: "Employee 2",
        email: "employee2@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    const manager = await prisma.user.create({
      data: {
        id: "manager-1",
        name: "Manager",
        email: "manager@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
      },
    });

    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-admin-1",
        name: "HR Admin",
        email: "hr@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });

    employeeId = employee.id;
    employee2Id = employee2.id;
    managerUserId = manager.id;
    hrAdminId = hrAdmin.id;

    // Create tokens
    employeeToken = JwtService.signAccessToken({
      id: employeeId,
      email: "employee1@example.com",
      role: "EMPLOYEE",
    });

    managerToken = JwtService.signAccessToken({
      id: managerUserId,
      email: "manager@example.com",
      role: "MANAGER",
    });

    hrAdminToken = JwtService.signAccessToken({
      id: hrAdminId,
      email: "hr@example.com",
      role: "HR_ADMIN",
    });

    // Create leave types
    const annualLeave = await prisma.leaveType.create({
      data: {
        name: "Annual Leave",
        defaultDays: 20,
        isCarryForward: false,
        requiresDocument: false,
        isActive: true,
        createdById: hrAdminId,
      },
    });

    annualLeaveTypeId = annualLeave.id;

    const sickLeave = await prisma.leaveType.create({
      data: {
        name: "Sick Leave",
        defaultDays: 10,
        isCarryForward: false,
        requiresDocument: true,
        isActive: true,
        createdById: hrAdminId,
      },
    });

    // Create leave balances for employees
    await prisma.leaveBalance.createMany({
      data: [
        {
          userId: employeeId,
          leaveTypeId: annualLeave.id,
          year: 2025,
          totalDays: 20,
          usedDays: 5,
          pendingDays: 2,
        },
        {
          userId: employeeId,
          leaveTypeId: sickLeave.id,
          year: 2025,
          totalDays: 10,
          usedDays: 0,
          pendingDays: 0,
        },
        {
          userId: employee2Id,
          leaveTypeId: annualLeave.id,
          year: 2025,
          totalDays: 20,
          usedDays: 0,
          pendingDays: 0,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe("GET /api/me/balances", () => {
    test("should return 401 without auth", async () => {
      const res = await request(app).get("/api/me/balances?year=2025");
      expect(res.status).toBe(401);
    });

    test("should return current user's balances for given year", async () => {
      const res = await request(app)
        .get("/api/me/balances?year=2025")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("balances");
      expect(Array.isArray(res.body.balances)).toBe(true);
      expect(res.body.balances.length).toBe(2); // Annual + Sick

      const annualBalance = res.body.balances.find(
        (b: any) => b.leaveType.name === "Annual Leave"
      );
      expect(annualBalance).toBeDefined();
      expect(annualBalance.totalDays).toBe(20);
      expect(annualBalance.usedDays).toBe(5);
      expect(annualBalance.pendingDays).toBe(2);
    });

    test("should return only balances for the specified year", async () => {
      // Create balance for 2026
      await prisma.leaveBalance.create({
        data: {
          userId: employeeId,
          leaveTypeId: annualLeaveTypeId,
          year: 2026,
          totalDays: 20,
          usedDays: 0,
          pendingDays: 0,
        },
      });

      const res = await request(app)
        .get("/api/me/balances?year=2025")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.balances.every((b: any) => b.year === 2025)).toBe(true);
    });

    test("should return empty array if no balances for year", async () => {
      const res = await request(app)
        .get("/api/me/balances?year=2024")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.balances).toEqual([]);
    });

    test("should default to current year if no year param", async () => {
      const currentYear = new Date().getFullYear();
      
      // Create balance for current year
      await prisma.leaveBalance.create({
        data: {
          userId: employeeId,
          leaveTypeId: annualLeaveTypeId,
          year: currentYear,
          totalDays: 20,
          usedDays: 0,
          pendingDays: 0,
        },
      });

      const res = await request(app)
        .get("/api/me/balances")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.balances.every((b: any) => b.year === currentYear)).toBe(true);
    });

    test("should allow manager to see own balances", async () => {
      // Create manager balance
      await prisma.leaveBalance.create({
        data: {
          userId: managerUserId,
          leaveTypeId: annualLeaveTypeId,
          year: 2025,
          totalDays: 25,
          usedDays: 0,
          pendingDays: 0,
        },
      });

      const res = await request(app)
        .get("/api/me/balances?year=2025")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.balances.length).toBe(1);
      expect(res.body.balances[0].totalDays).toBe(25);
    });
  });

  describe("GET /api/users/:userId/balances", () => {
    test("should return 401 without auth", async () => {
      const res = await request(app).get(`/api/users/${employeeId}/balances?year=2025`);
      expect(res.status).toBe(401);
    });

    test("should return 403 when employee tries to see another user's balances", async () => {
      const res = await request(app)
        .get(`/api/users/${employee2Id}/balances?year=2025`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });

    test("should return 403 when manager tries to see another user's balances", async () => {
      const res = await request(app)
        .get(`/api/users/${employeeId}/balances?year=2025`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });

    test("should allow HR Admin to see any user's balances", async () => {
      const res = await request(app)
        .get(`/api/users/${employeeId}/balances?year=2025`)
        .set("Authorization", `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("balances");
      expect(res.body.balances.length).toBe(2);

      const annualBalance = res.body.balances.find(
        (b: any) => b.leaveType.name === "Annual Leave"
      );
      expect(annualBalance).toBeDefined();
      expect(annualBalance.usedDays).toBe(5);
    });

    test("should default to current year if no year param", async () => {
      const currentYear = new Date().getFullYear();

      // Create balance for current year
      await prisma.leaveBalance.create({
        data: {
          userId: employeeId,
          leaveTypeId: annualLeaveTypeId,
          year: currentYear,
          totalDays: 20,
          usedDays: 3,
          pendingDays: 0,
        },
      });

      const res = await request(app)
        .get(`/api/users/${employeeId}/balances`)
        .set("Authorization", `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.balances.every((b: any) => b.year === currentYear)).toBe(true);
    });
  });
});
