import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("GET /api/leave-requests/:id", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;
  let employeeId: string;
  let employeeToken: string;
  let differentTeamEmployeeId: string;
  let leaveTypeId: number;
  let leaveRequestId: number;
  let otherLeaveRequestId: number;

  beforeEach(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-detail-1",
        name: "HR Admin",
        email: "hr-detail@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
        team: "HR",
      },
    });
    hrAdminId = hrAdmin.id;
    hrAdminToken = JwtService.signAccessToken({ id: hrAdminId, email: hrAdmin.email, role: "HR_ADMIN" });

    const manager = await prisma.user.create({
      data: {
        id: "mgr-detail-1",
        name: "Manager A",
        email: "mgr-detail@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
        team: "Team A",
      },
    });
    managerId = manager.id;
    managerToken = JwtService.signAccessToken({ id: managerId, email: manager.email, role: "MANAGER" });

    const employee = await prisma.user.create({
      data: {
        id: "emp-detail-1",
        name: "Employee A",
        email: "emp-detail@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team A",
      },
    });
    employeeId = employee.id;
    employeeToken = JwtService.signAccessToken({ id: employeeId, email: employee.email, role: "EMPLOYEE" });

    const differentTeamEmployee = await prisma.user.create({
      data: {
        id: "emp-detail-3",
        name: "Employee C",
        email: "emp-detail3@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team B",
      },
    });
    differentTeamEmployeeId = differentTeamEmployee.id;

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

    // Employee A's leave request
    const lr1 = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-03-10"),
        endDate: new Date("2026-03-12"),
        totalDays: 3,
        status: "PENDING",
        reason: "vacation",
      },
    });
    leaveRequestId = lr1.id;

    // Employee C (different team) leave request
    const lr2 = await prisma.leaveRequest.create({
      data: {
        employeeId: differentTeamEmployeeId,
        leaveTypeId,
        startDate: new Date("2026-03-15"),
        endDate: new Date("2026-03-16"),
        totalDays: 2,
        status: "APPROVED",
      },
    });
    otherLeaveRequestId = lr2.id;
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  it("returns 401 if not authenticated", async () => {
    const res = await request(app).get(`/api/leave-requests/${leaveRequestId}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 if request not found", async () => {
    const res = await request(app)
      .get("/api/leave-requests/999999")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(404);
  });

  it("EMPLOYEE can view own request", async () => {
    const res = await request(app)
      .get(`/api/leave-requests/${leaveRequestId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.id).toBe(leaveRequestId);
    expect(res.body.leaveRequest.employeeId).toBe(employeeId);
  });

  it("EMPLOYEE cannot view another employee's request (403)", async () => {
    const res = await request(app)
      .get(`/api/leave-requests/${otherLeaveRequestId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("MANAGER can view same-team employee's request", async () => {
    const res = await request(app)
      .get(`/api/leave-requests/${leaveRequestId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.id).toBe(leaveRequestId);
  });

  it("MANAGER cannot view different-team employee's request (403)", async () => {
    const res = await request(app)
      .get(`/api/leave-requests/${otherLeaveRequestId}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it("HR_ADMIN can view any request", async () => {
    const res1 = await request(app)
      .get(`/api/leave-requests/${leaveRequestId}`)
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .get(`/api/leave-requests/${otherLeaveRequestId}`)
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res2.status).toBe(200);
  });

  it("response includes expected fields", async () => {
    const res = await request(app)
      .get(`/api/leave-requests/${leaveRequestId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);

    const lr = res.body.leaveRequest;
    expect(lr).toHaveProperty("id");
    expect(lr).toHaveProperty("employeeId");
    expect(lr).toHaveProperty("employeeName");
    expect(lr).toHaveProperty("leaveTypeName");
    expect(lr).toHaveProperty("startDate");
    expect(lr).toHaveProperty("endDate");
    expect(lr).toHaveProperty("halfDay");
    expect(lr).toHaveProperty("totalDays");
    expect(lr).toHaveProperty("status");
    expect(lr).toHaveProperty("createdAt");
    expect(lr.employeeName).toBe("Employee A");
    expect(lr.leaveTypeName).toBe("Annual Leave");
    expect(lr.status).toBe("PENDING");
    expect(lr.reason).toBe("vacation");
  });
});
