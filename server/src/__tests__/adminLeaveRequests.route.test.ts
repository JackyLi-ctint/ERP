import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("GET /api/admin/leave-requests", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;
  let employeeId: string;
  let employeeToken: string;
  let employee2Id: string;
  let leaveTypeId: number;

  beforeEach(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-admin-records-1",
        name: "HR Admin",
        email: "hr-admin-records@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });
    hrAdminId = hrAdmin.id;
    hrAdminToken = JwtService.signAccessToken({ id: hrAdminId, email: hrAdmin.email, role: "HR_ADMIN" });

    const manager = await prisma.user.create({
      data: {
        id: "mgr-records-1",
        name: "Manager",
        email: "mgr-records@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
        team: "Team A",
      },
    });
    managerId = manager.id;
    managerToken = JwtService.signAccessToken({ id: managerId, email: manager.email, role: "MANAGER" });

    const employee = await prisma.user.create({
      data: {
        id: "emp-records-1",
        name: "Employee A",
        email: "emp-records@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team A",
      },
    });
    employeeId = employee.id;
    employeeToken = JwtService.signAccessToken({ id: employeeId, email: employee.email, role: "EMPLOYEE" });

    const employee2 = await prisma.user.create({
      data: {
        id: "emp-records-2",
        name: "Employee B",
        email: "emp-records2@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team B",
      },
    });
    employee2Id = employee2.id;

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

    // Create some leave requests
    await prisma.leaveRequest.createMany({
      data: [
        {
          employeeId,
          leaveTypeId,
          startDate: new Date("2026-03-10"),
          endDate: new Date("2026-03-12"),
          totalDays: 3,
          status: "PENDING",
          reason: "vacation",
        },
        {
          employeeId,
          leaveTypeId,
          startDate: new Date("2026-04-05"),
          endDate: new Date("2026-04-06"),
          totalDays: 2,
          status: "APPROVED",
        },
        {
          employeeId: employee2Id,
          leaveTypeId,
          startDate: new Date("2026-03-20"),
          endDate: new Date("2026-03-21"),
          totalDays: 2,
          status: "REJECTED",
        },
      ],
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

  it("returns 401 if not authenticated", async () => {
    const res = await request(app).get("/api/admin/leave-requests");
    expect(res.status).toBe(401);
  });

  it("returns 403 if MANAGER tries to access", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 if EMPLOYEE tries to access", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("HR_ADMIN gets all requests (no filters)", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(3);
    expect(res.body).toHaveProperty("total", 3);
    expect(res.body).toHaveProperty("page", 1);
    expect(res.body).toHaveProperty("pageSize", 20);
  });

  it("filters by employeeId", async () => {
    const res = await request(app)
      .get(`/api/admin/leave-requests?employeeId=${employeeId}`)
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(2);
    expect(res.body.leaveRequests.every((r: { employeeId: string }) => r.employeeId === employeeId)).toBe(true);
  });

  it("filters by status", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests?status=PENDING")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(1);
    expect(res.body.leaveRequests[0].status).toBe("PENDING");
  });

  it("filters by from/to date range", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests?from=2026-03-01&to=2026-03-31")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(2);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests?status=INVALID_STATUS")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid from date format", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests?from=abc")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid to date format", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests?to=not-a-date")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(400);
  });

  it("pagination: page and pageSize work", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests?page=1&pageSize=2")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.leaveRequests).toHaveLength(2);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.total).toBe(3);
  });

  it("response includes total, page, pageSize", async () => {
    const res = await request(app)
      .get("/api/admin/leave-requests")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("pageSize");
    const lr = res.body.leaveRequests[0];
    expect(lr).toHaveProperty("id");
    expect(lr).toHaveProperty("employeeId");
    expect(lr).toHaveProperty("employeeName");
    expect(lr).toHaveProperty("leaveTypeName");
    expect(lr).toHaveProperty("startDate");
    expect(lr).toHaveProperty("endDate");
    expect(lr).toHaveProperty("totalDays");
    expect(lr).toHaveProperty("status");
    expect(lr).toHaveProperty("createdAt");
  });
});
