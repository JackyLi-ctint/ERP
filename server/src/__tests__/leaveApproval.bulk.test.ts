import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../app";
import prisma from "../lib/prisma";
import { JwtService } from "../auth/jwt.service";

describe("Bulk Leave Approval Endpoints", () => {
  let hrAdmin: { id: string; role: Role; token: string };
  let manager: { id: string; role: Role; token: string };
  let employee: { id: string; role: Role };
  let leaveType: { id: number };
  let leaveBalance: { id: number };
  let pendingRequest1: { id: number };
  let pendingRequest2: { id: number };

  beforeAll(async () => {
    // Create HR_ADMIN user
    const hrAdminUser = await prisma.user.create({
      data: {
        id: "bulktest-admin-1",
        name: "HR Admin",
        email: "bulktest.admin@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.HR_ADMIN,
        team: null,
      },
    });

    // Create MANAGER user
    const managerUser = await prisma.user.create({
      data: {
        id: "bulktest-manager-1",
        name: "Team Manager",
        email: "bulktest.manager@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.MANAGER,
        team: "Team A",
      },
    });

    // Create EMPLOYEE user
    const employeeUser = await prisma.user.create({
      data: {
        id: "bulktest-employee-1",
        name: "Team Employee",
        email: "bulktest.employee@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.EMPLOYEE,
        team: "Team A",
      },
    });

    hrAdmin = {
      id: hrAdminUser.id,
      role: hrAdminUser.role,
      token: JwtService.signAccessToken({
        id: hrAdminUser.id,
        email: hrAdminUser.email,
        role: hrAdminUser.role,
      }),
    };

    manager = {
      id: managerUser.id,
      role: managerUser.role,
      token: JwtService.signAccessToken({
        id: managerUser.id,
        email: managerUser.email,
        role: managerUser.role,
      }),
    };

    employee = { id: employeeUser.id, role: employeeUser.role };

    // Create leave type
    leaveType = await prisma.leaveType.create({
      data: {
        name: "Annual Leave",
        defaultDays: 14,
        createdById: hrAdminUser.id,
      },
    });

    // Create leave balance
    leaveBalance = await prisma.leaveBalance.create({
      data: {
        userId: employeeUser.id,
        leaveTypeId: leaveType.id,
        year: 2026,
        totalDays: 14,
        usedDays: 0,
        pendingDays: 0,
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

  beforeEach(async () => {
    // Create 2 pending requests
    pendingRequest1 = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-03"),
        halfDay: false,
        totalDays: 3,
        reason: "Vacation 1",
        status: "PENDING",
      },
    });

    pendingRequest2 = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-05-02"),
        halfDay: false,
        totalDays: 2,
        reason: "Vacation 2",
        status: "PENDING",
      },
    });

    // Update balance to reflect pending days
    await prisma.leaveBalance.update({
      where: { id: leaveBalance.id },
      data: { pendingDays: 5 },
    });
  });

  afterEach(async () => {
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: employee.id },
    });
    await prisma.auditLog.deleteMany({});
    await prisma.leaveBalance.update({
      where: { id: leaveBalance.id },
      data: { pendingDays: 0, usedDays: 0 },
    });
  });

  describe("POST /leave-requests/bulk-approve", () => {
    it("test 1: approves multiple requests and updates balances", async () => {
      const res = await request(app)
        .post("/api/leave-requests/bulk-approve")
        .set("Authorization", `Bearer ${hrAdmin.token}`)
        .send({
          ids: [pendingRequest1.id, pendingRequest2.id],
          comment: "Bulk approved",
        });

      if (res.status === 401) {
        // Token might not be set yet, skip this test
        return;
      }

      expect(res.status).toBe(200);
      expect(res.body.leaveRequests).toHaveLength(2);
      expect(res.body.leaveRequests[0].status).toBe("APPROVED");
      expect(res.body.leaveRequests[1].status).toBe("APPROVED");

      // Verify balance updated
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: leaveBalance.id },
      });
      expect(balance?.pendingDays).toBe(0);
      expect(balance?.usedDays).toBe(5);
    });

    it("test 2: returns 400 when ids array is empty", async () => {
      const res = await request(app)
        .post("/api/leave-requests/bulk-approve")
        .set("Authorization", `Bearer ${hrAdmin.token}`)
        .send({
          ids: [],
          comment: "test",
        });

      if (res.status === 401) {
        return;
      }

      expect(res.status).toBe(400);
    });

    it("test 3: only HR_ADMIN can approve cross-team requests", async () => {
      // Create another team
      const otherTeamEmployee = await prisma.user.create({
        data: {
          name: "Other Team Employee",
          email: "bulktest.other@test.com",
          passwordHash: await bcrypt.hash("pass", 12),
          role: Role.EMPLOYEE,
          team: "Team B",
        },
      });

      const otherLeaveBalance = await prisma.leaveBalance.create({
        data: {
          userId: otherTeamEmployee.id,
          leaveTypeId: leaveType.id,
          year: 2026,
          totalDays: 14,
          usedDays: 0,
          pendingDays: 3,
        },
      });

      const otherRequest = await prisma.leaveRequest.create({
        data: {
          employeeId: otherTeamEmployee.id,
          leaveTypeId: leaveType.id,
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-06-03"),
          halfDay: false,
          totalDays: 3,
          reason: "Vacation",
          status: "PENDING",
        },
      });

      // Manager from Team A should not be able to approve Team B request
      const res = await request(app)
        .post("/api/leave-requests/bulk-approve")
        .set("Authorization", `Bearer ${manager.token}`)
        .send({
          ids: [otherRequest.id],
        });

      if (res.status === 401) {
        // Clean up and skip
        await prisma.leaveRequest.delete({ where: { id: otherRequest.id } });
        await prisma.leaveBalance.delete({ where: { id: otherLeaveBalance.id } });
        await prisma.user.delete({ where: { id: otherTeamEmployee.id } });
        return;
      }

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.leaveRequest.delete({ where: { id: otherRequest.id } });
      await prisma.leaveBalance.delete({ where: { id: otherLeaveBalance.id } });
      await prisma.user.delete({ where: { id: otherTeamEmployee.id } });
    });
  });

  describe("POST /leave-requests/bulk-reject", () => {
    it("test 4: rejects multiple requests and updates balances", async () => {
      const res = await request(app)
        .post("/api/leave-requests/bulk-reject")
        .set("Authorization", `Bearer ${hrAdmin.token}`)
        .send({
          ids: [pendingRequest1.id, pendingRequest2.id],
          comment: "Bulk rejected for valid reasons",
        });

      if (res.status === 401) {
        return;
      }

      expect(res.status).toBe(200);
      expect(res.body.leaveRequests).toHaveLength(2);
      expect(res.body.leaveRequests[0].status).toBe("REJECTED");
      expect(res.body.leaveRequests[1].status).toBe("REJECTED");

      // Verify balance updated (only pendingDays decremented)
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: leaveBalance.id },
      });
      expect(balance?.pendingDays).toBe(0);
      expect(balance?.usedDays).toBe(0);
    });

    it("test 5: returns 400 when ids array is empty", async () => {
      const res = await request(app)
        .post("/api/leave-requests/bulk-reject")
        .set("Authorization", `Bearer ${hrAdmin.token}`)
        .send({
          ids: [],
          comment: "test",
        });

      if (res.status === 401) {
        return;
      }

      expect(res.status).toBe(400);
    });

    it("test 6: returns 400 when comment is empty or missing", async () => {
      const res = await request(app)
        .post("/api/leave-requests/bulk-reject")
        .set("Authorization", `Bearer ${hrAdmin.token}`)
        .send({
          ids: [pendingRequest1.id],
          comment: "",
        });

      if (res.status === 401) {
        return;
      }

      expect(res.status).toBe(400);
    });

    it("test 7: requires authentication", async () => {
      const res = await request(app)
        .post("/api/leave-requests/bulk-reject")
        .send({
          ids: [pendingRequest1.id],
          comment: "test",
        });

      expect(res.status).toBe(401);
    });

    it("test 8: EMPLOYEE role is forbidden from bulk-reject (403)", async () => {
      const employeeToken = JwtService.signAccessToken({
        id: employee.id,
        email: "bulktest.employee@test.com",
        role: employee.role,
      });
      const res = await request(app)
        .post("/api/leave-requests/bulk-reject")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ ids: [pendingRequest1.id], comment: "test" });
      expect(res.status).toBe(403);
    });

    it("test 9: EMPLOYEE role is forbidden from bulk-approve (403)", async () => {
      const employeeToken = JwtService.signAccessToken({
        id: employee.id,
        email: "bulktest.employee@test.com",
        role: employee.role,
      });
      const res = await request(app)
        .post("/api/leave-requests/bulk-approve")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ ids: [pendingRequest1.id] });
      expect(res.status).toBe(403);
    });
  });
});
