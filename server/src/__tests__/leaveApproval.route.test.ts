import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("leaveApproval routes", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;
  let employeeId: string;
  let employeeToken: string;
  let otherManagerId: string;
  let otherEmployeeId: string;
  let leaveTypeId: number;
  let leaveRequestId: number;

  beforeEach(async () => {
    // Clean up
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.publicHoliday.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    // Create HR_ADMIN (team: null)
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
    hrAdminToken = JwtService.signAccessToken({
      id: hrAdminId,
      email: hrAdmin.email,
      role: "HR_ADMIN",
    });

    // Create MANAGER (team: "Team A")
    const manager = await prisma.user.create({
      data: {
        id: "manager-1",
        name: "Manager A",
        email: "manager@example.com",
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
        id: "employee-1",
        name: "Employee A",
        email: "employee@example.com",
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

    // Create MANAGER (team: "Team B")
    const otherManager = await prisma.user.create({
      data: {
        id: "manager-2",
        name: "Manager B",
        email: "manager2@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
        team: "Team B",
      },
    });
    otherManagerId = otherManager.id;

    // Create EMPLOYEE (team: "Team B")
    const otherEmployee = await prisma.user.create({
      data: {
        id: "employee-2",
        name: "Employee B",
        email: "employee2@example.com",
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

    // Create leave balance for both team A employees
    await prisma.leaveBalance.create({
      data: {
        userId: employeeId,
        leaveTypeId,
        year: 2026,
        totalDays: 14,
        usedDays: 0,
        pendingDays: 0,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        userId: otherEmployeeId,
        leaveTypeId,
        year: 2026,
        totalDays: 14,
        usedDays: 0,
        pendingDays: 0,
      },
    });

    // Seed HK holidays for 2026
    await prisma.publicHoliday.createMany({
      data: [
        { date: new Date("2026-01-01"), name: "New Year's Day", year: 2026 },
        {
          date: new Date("2026-02-17"),
          name: "Chinese New Year",
          year: 2026,
        },
        {
          date: new Date("2026-02-18"),
          name: "Chinese New Year",
          year: 2026,
        },
        {
          date: new Date("2026-04-03"),
          name: "Good Friday",
          year: 2026,
        },
        {
          date: new Date("2026-04-04"),
          name: "Day after Good Friday",
          year: 2026,
        },
        {
          date: new Date("2026-04-06"),
          name: "Easter Monday",
          year: 2026,
        },
        {
          date: new Date("2026-05-01"),
          name: "Labour Day",
          year: 2026,
        },
        {
          date: new Date("2026-06-10"),
          name: "Dragon Boat Festival",
          year: 2026,
        },
        {
          date: new Date("2026-09-11"),
          name: "Mid-Autumn Festival",
          year: 2026,
        },
        {
          date: new Date("2026-10-01"),
          name: "National Day",
          year: 2026,
        },
        {
          date: new Date("2026-10-29"),
          name: "Chong Yeung Festival",
          year: 2026,
        },
        {
          date: new Date("2026-12-25"),
          name: "Christmas Day",
          year: 2026,
        },
      ],
    });

    // Create a PENDING leave request for employee
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate: new Date("2026-04-07"),
        endDate: new Date("2026-04-09"),
        halfDay: false,
        totalDays: 3,
        reason: "Personal leave",
        status: "PENDING",
      },
    });
    leaveRequestId = leaveRequest.id;

    // Update balance to reflect pending days
    await prisma.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: employeeId,
          leaveTypeId,
          year: 2026,
        },
      },
      data: {
        pendingDays: 3,
      },
    });
  });

  afterEach(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.publicHoliday.deleteMany({});
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe("POST /api/leave-requests/:id/approve", () => {
    test("should return 401 without auth token", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/approve`)
        .send({ comment: "Approved" });

      expect(res.status).toBe(401);
    });

    test("should return 403 for EMPLOYEE role", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/approve`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ comment: "Approved" });

      expect(res.status).toBe(403);
    });

    test("should return 403 for MANAGER on different team", async () => {
      const otherManagerToken = JwtService.signAccessToken({
        id: otherManagerId,
        email: "manager2@example.com",
        role: "MANAGER",
      });

      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/approve`)
        .set("Authorization", `Bearer ${otherManagerToken}`)
        .send({ comment: "Approved" });

      expect(res.status).toBe(403);
    });

    test("should return 200 for MANAGER on same team", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/approve`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ comment: "Approved" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest).toBeDefined();
      expect(res.body.leaveRequest.status).toBe("APPROVED");
    });

    test("should return 200 for HR_ADMIN", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/approve`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ comment: "Approved" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("APPROVED");
    });

    test("should return 404 for non-existent request id", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/99999/approve`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ comment: "Approved" });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/leave-requests/:id/reject", () => {
    test("should return 401 without auth token", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/reject`)
        .send({ comment: "Rejected" });

      expect(res.status).toBe(401);
    });

    test("should return 400 if comment missing", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/reject`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("should return 200 with comment", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/reject`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ comment: "Rejected for valid reason" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("REJECTED");
    });
  });

  describe("POST /api/leave-requests/:id/approve-cancellation", () => {
    test("should return 200 for authorised manager", async () => {
      // First approve the request
      await prisma.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: "APPROVED", approvedById: managerId },
      });

      // Update balance to reflect approved status
      await prisma.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId: employeeId,
            leaveTypeId,
            year: 2026,
          },
        },
        data: {
          pendingDays: 0,
          usedDays: 3,
        },
      });

      // Create a cancellation request
      await prisma.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: "CANCEL_REQUESTED" },
      });

      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/approve-cancellation`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("CANCELLED");
    });

    test("should return 422 if request is not CANCEL_REQUESTED", async () => {
      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/approve-cancellation`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/leave-requests/:id/reject-cancellation", () => {
    test("should return 400 if comment missing", async () => {
      // Set request to CANCEL_REQUESTED
      await prisma.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: "CANCEL_REQUESTED" },
      });

      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/reject-cancellation`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("should return 200 with comment and revert to APPROVED", async () => {
      // First approve the request
      await prisma.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: "APPROVED", approvedById: managerId },
      });

      // Update balance
      await prisma.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId: employeeId,
            leaveTypeId,
            year: 2026,
          },
        },
        data: {
          pendingDays: 0,
          usedDays: 3,
        },
      });

      // Set to CANCEL_REQUESTED
      await prisma.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: "CANCEL_REQUESTED" },
      });

      const res = await request(app)
        .post(`/api/leave-requests/${leaveRequestId}/reject-cancellation`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ comment: "Cancellation rejected" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("APPROVED");
    });
  });

  describe("GET /api/manager/leave-requests", () => {
    test("should return 401 without auth", async () => {
      const res = await request(app).get("/api/manager/leave-requests");

      expect(res.status).toBe(401);
    });

    test("should return 403 for EMPLOYEE", async () => {
      const res = await request(app)
        .get("/api/manager/leave-requests")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });

    test("should return 200 for MANAGER with same-team PENDING + CANCEL_REQUESTED", async () => {
      const res = await request(app)
        .get("/api/manager/leave-requests")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.leaveRequests).toBeDefined();
      expect(Array.isArray(res.body.leaveRequests)).toBe(true);
      expect(res.body.leaveRequests.length).toBe(1);
      expect(res.body.leaveRequests[0].status).toMatch(/PENDING|CANCEL_REQUESTED/);
    });

    test("should return 200 for HR_ADMIN with all PENDING + CANCEL_REQUESTED", async () => {
      // Create another request for team B
      await prisma.leaveRequest.create({
        data: {
          employeeId: otherEmployeeId,
          leaveTypeId,
          startDate: new Date("2026-05-01"),
          endDate: new Date("2026-05-03"),
          halfDay: false,
          totalDays: 3,
          reason: "Vacation",
          status: "PENDING",
        },
      });

      const res = await request(app)
        .get("/api/manager/leave-requests")
        .set("Authorization", `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.leaveRequests).toBeDefined();
      expect(res.body.leaveRequests.length).toBe(2);
    });
  });
});
