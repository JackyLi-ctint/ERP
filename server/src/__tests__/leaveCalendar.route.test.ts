import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("leave-calendar routes", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;
  let employeeId: string;
  let employeeToken: string;
  let otherEmployeeId: string;
  let leaveTypeId: number;

  beforeEach(async () => {
    // Clean up
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    // Create HR_ADMIN
    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-cal-1",
        name: "HR Admin",
        email: "hr-cal@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });
    hrAdminId = hrAdmin.id;
    hrAdminToken = JwtService.signAccessToken({
      id: hrAdminId,
      email: hrAdmin.email,
      role: "HR_ADMIN",
    });

    // Create MANAGER (team: "Team A")
    const manager = await prisma.user.create({
      data: {
        id: "mgr-cal-1",
        name: "Manager A",
        email: "mgr-cal@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
        team: "Team A",
      },
    });
    managerId = manager.id;
    managerToken = JwtService.signAccessToken({
      id: managerId,
      email: manager.email,
      role: "MANAGER",
    });

    // Create EMPLOYEE (team: "Team A")
    const employee = await prisma.user.create({
      data: {
        id: "emp-cal-1",
        name: "Employee A",
        email: "emp-cal@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team A",
      },
    });
    employeeId = employee.id;
    employeeToken = JwtService.signAccessToken({
      id: employeeId,
      email: employee.email,
      role: "EMPLOYEE",
    });

    // Create another EMPLOYEE (team: "Team B")
    const otherEmployee = await prisma.user.create({
      data: {
        id: "emp-cal-2",
        name: "Employee B",
        email: "emp-cal2@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team B",
      },
    });
    otherEmployeeId = otherEmployee.id;

    // Create leave type
    const leaveType = await prisma.leaveType.create({
      data: {
        name: "Annual Leave",
        defaultDays: 20,
        isCarryForward: false,
        requiresDocument: false,
        isActive: true,
        createdById: hrAdminId,
      },
    });
    leaveTypeId = leaveType.id;
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // ─── Auth / validation tests ───────────────────────────────────────────────

  it("returns 401 if not authenticated", async () => {
    const res = await request(app).get("/api/leave-calendar?year=2026&month=3");
    expect(res.status).toBe(401);
  });

  it("returns 400 if year is missing", async () => {
    const res = await request(app)
      .get("/api/leave-calendar?month=3")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 if month is missing", async () => {
    const res = await request(app)
      .get("/api/leave-calendar?year=2026")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 if month is out of range (0)", async () => {
    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=0")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 if month is out of range (13)", async () => {
    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=13")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(400);
  });

  // ─── EMPLOYEE visibility ───────────────────────────────────────────────────

  it("EMPLOYEE sees only their own non-DRAFT/CANCELLED leave in range", async () => {
    // Employee's own PENDING leave in March 2026
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-12"),
        totalDays: 3,
        status: "PENDING",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(1);
    expect(res.body.leaveRequests[0].employeeId).toBe(employeeId);
  });

  it("EMPLOYEE does not see other employees' leave", async () => {
    // Other employee's leave in March 2026
    await prisma.leaveRequest.create({
      data: {
        employeeId: otherEmployeeId,
        leaveTypeId,
        startDate: new Date("2026-03-05"),
        endDate: new Date("2026-03-06"),
        totalDays: 2,
        status: "APPROVED",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(0);
  });

  // ─── MANAGER visibility ────────────────────────────────────────────────────

  it("MANAGER sees their own and same-team leave", async () => {
    // Manager's own leave
    await prisma.leaveRequest.create({
      data: {
        employeeId: managerId,
        leaveTypeId,
        startDate: new Date("2026-03-15"),
        endDate: new Date("2026-03-15"),
        totalDays: 1,
        status: "APPROVED",
      },
    });

    // Team A employee's leave
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-12"),
        totalDays: 3,
        status: "PENDING",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(2);
  });

  it("MANAGER does not see different-team leave", async () => {
    // Team B employee's leave
    await prisma.leaveRequest.create({
      data: {
        employeeId: otherEmployeeId,
        leaveTypeId,
        startDate: new Date("2026-03-05"),
        endDate: new Date("2026-03-06"),
        totalDays: 2,
        status: "APPROVED",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    // Manager's team is Team A, other employee is Team B — should not appear
    const ids = res.body.leaveRequests.map((r: { employeeId: string }) => r.employeeId);
    expect(ids).not.toContain(otherEmployeeId);
  });

  // ─── HR_ADMIN visibility ───────────────────────────────────────────────────

  it("HR_ADMIN sees all leave", async () => {
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-12"),
        totalDays: 3,
        status: "APPROVED",
      },
    });

    await prisma.leaveRequest.create({
      data: {
        employeeId: otherEmployeeId,
        leaveTypeId,
        startDate: new Date("2026-03-05"),
        endDate: new Date("2026-03-06"),
        totalDays: 2,
        status: "PENDING",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(2);
  });

  // ─── Status filtering ──────────────────────────────────────────────────────

  it("excludes DRAFT and CANCELLED requests", async () => {
    // DRAFT
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-10"),
        totalDays: 1,
        status: "DRAFT",
      },
    });

    // CANCELLED
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-11"),
        endDate: new Date("2026-03-11"),
        totalDays: 1,
        status: "CANCELLED",
      },
    });

    // PENDING — should be included
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-12"),
        endDate: new Date("2026-03-12"),
        totalDays: 1,
        status: "PENDING",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(1);
    expect(res.body.leaveRequests[0].status).toBe("PENDING");
  });

  // ─── Date range filtering ──────────────────────────────────────────────────

  it("excludes requests outside the requested month range", async () => {
    // Leave entirely in February 2026
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-02-20"),
        endDate: new Date("2026-02-25"),
        totalDays: 4,
        status: "APPROVED",
      },
    });

    // Leave entirely in April 2026
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-05"),
        totalDays: 5,
        status: "APPROVED",
      },
    });

    // Leave spanning into March 2026 (starts in Feb, ends in March)
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-02-28"),
        endDate: new Date("2026-03-02"),
        totalDays: 2,
        status: "APPROVED",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    // Only the spanning leave should appear
    expect(res.body.leaveRequests).toHaveLength(1);
    expect(res.body.leaveRequests[0].startDate).toContain("2026-02-28");
  });

  // ─── Response shape ────────────────────────────────────────────────────────

  it("response includes employeeName, leaveTypeName, totalDays, status", async () => {
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-12"),
        totalDays: 3,
        status: "APPROVED",
      },
    });

    const res = await request(app)
      .get("/api/leave-calendar?year=2026&month=3")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    const entry = res.body.leaveRequests[0];
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("employeeId", employeeId);
    expect(entry).toHaveProperty("employeeName", "Employee A");
    expect(entry).toHaveProperty("leaveTypeName", "Annual Leave");
    expect(entry).toHaveProperty("totalDays", 3);
    expect(entry).toHaveProperty("status", "APPROVED");
    expect(entry).toHaveProperty("startDate");
    expect(entry).toHaveProperty("endDate");
  });
});
