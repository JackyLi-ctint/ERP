import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("GET /api/manager/leave-requests", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;
  let employeeId: string;
  let employeeToken: string;
  let otherTeamEmployeeId: string;
  let leaveTypeId: number;

  beforeEach(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    const hrAdmin = await prisma.user.create({
      data: {
        id: "mgr-route-hradmin-1",
        name: "HR Admin",
        email: "mgr-route-hradmin@example.com",
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

    const manager = await prisma.user.create({
      data: {
        id: "mgr-route-manager-1",
        name: "Manager",
        email: "mgr-route-manager@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
        team: "Team Alpha",
      },
    });
    managerId = manager.id;
    managerToken = JwtService.signAccessToken({
      id: managerId,
      email: manager.email,
      role: "MANAGER",
    });

    const employee = await prisma.user.create({
      data: {
        id: "mgr-route-emp-1",
        name: "Employee Alpha",
        email: "mgr-route-emp@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team Alpha",
      },
    });
    employeeId = employee.id;
    employeeToken = JwtService.signAccessToken({
      id: employeeId,
      email: employee.email,
      role: "EMPLOYEE",
    });

    const otherTeamEmployee = await prisma.user.create({
      data: {
        id: "mgr-route-emp-2",
        name: "Employee Beta",
        email: "mgr-route-emp2@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team Beta",
      },
    });
    otherTeamEmployeeId = otherTeamEmployee.id;

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

    // Same-team pending request
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-03"),
        totalDays: 3,
        status: "PENDING",
        reason: "Holiday",
      },
    });

    // Other-team pending request
    await prisma.leaveRequest.create({
      data: {
        employeeId: otherTeamEmployeeId,
        leaveTypeId,
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-07-02"),
        totalDays: 2,
        status: "PENDING",
        reason: "Sick",
      },
    });
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it("returns 401 without authentication", async () => {
    const res = await request(app).get("/api/manager/leave-requests");
    expect(res.status).toBe(401);
  });

  it("returns 403 for EMPLOYEE role", async () => {
    const res = await request(app)
      .get("/api/manager/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("MANAGER sees only same-team requests", async () => {
    const res = await request(app)
      .get("/api/manager/leave-requests")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toBeDefined();
    const ids = res.body.leaveRequests.map((r: { employeeId: string }) => r.employeeId);
    expect(ids).toContain(employeeId);
    expect(ids).not.toContain(otherTeamEmployeeId);
  });

  it("HR_ADMIN sees all pending requests across teams", async () => {
    const res = await request(app)
      .get("/api/manager/leave-requests")
      .set("Authorization", `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toBeDefined();
    const ids = res.body.leaveRequests.map((r: { employeeId: string }) => r.employeeId);
    expect(ids).toContain(employeeId);
    expect(ids).toContain(otherTeamEmployeeId);
  });

  it("respects page and pageSize query params", async () => {
    const res = await request(app)
      .get("/api/manager/leave-requests?page=1&pageSize=1")
      .set("Authorization", `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.leaveRequests).toHaveLength(1);
  });
});
