import { Role, LeaveStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  approveCancellation,
  rejectCancellation,
  getSubordinatePendingRequests,
} from "../services/leaveApproval.service";
import { cancelLeaveRequest } from "../services/leaveRequest.service";

describe("LeaveApproval Service", () => {
  let hrAdmin: { id: string; role: Role; team: string | null };
  let manager: { id: string; role: Role; team: string | null };
  let employee: { id: string; role: Role; team: string | null };
  let otherEmployee: { id: string; role: Role; team: string | null };
  let otherManager: { id: string; role: Role; team: string | null };
  let leaveType: { id: number };
  let leaveBalance1: { id: number; totalDays: number; pendingDays: number; usedDays: number };
  let leaveBalance2: { id: number; totalDays: number; pendingDays: number; usedDays: number };
  let pendingRequest: { id: number; status: LeaveStatus; totalDays: number; employeeId: string };

  beforeAll(async () => {
    // Clean up any leftover data from previous suites
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    // Create users
    hrAdmin = await prisma.user.create({
      data: {
        name: "HR Admin",
        email: "hradmin@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.HR_ADMIN,
        team: null,
      },
    });

    manager = await prisma.user.create({
      data: {
        name: "Team A Manager",
        email: "manager@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.MANAGER,
        team: "Team A",
      },
    });

    employee = await prisma.user.create({
      data: {
        name: "Team A Employee",
        email: "employee@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.EMPLOYEE,
        team: "Team A",
      },
    });

    otherManager = await prisma.user.create({
      data: {
        name: "Team B Manager",
        email: "manager_b@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.MANAGER,
        team: "Team B",
      },
    });

    otherEmployee = await prisma.user.create({
      data: {
        name: "Team B Employee",
        email: "employee_b@test.com",
        passwordHash: await bcrypt.hash("pass", 12),
        role: Role.EMPLOYEE,
        team: "Team B",
      },
    });

    // Create leave type
    leaveType = await prisma.leaveType.create({
      data: {
        name: "Annual Leave",
        defaultDays: 14,
        createdById: hrAdmin.id,
      },
    });

    // Create leave balances
    leaveBalance1 = await prisma.leaveBalance.create({
      data: {
        userId: employee.id,
        leaveTypeId: leaveType.id,
        year: 2026,
        totalDays: 14,
        usedDays: 0,
        pendingDays: 0,
      },
    });

    leaveBalance2 = await prisma.leaveBalance.create({
      data: {
        userId: otherEmployee.id,
        leaveTypeId: leaveType.id,
        year: 2026,
        totalDays: 14,
        usedDays: 0,
        pendingDays: 0,
      },
    });
  });

  afterAll(async () => {
    // Clean up in FK order
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create fresh pending request for each test
    pendingRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: new Date("2026-03-20"),
        endDate: new Date("2026-03-22"),
        halfDay: false,
        totalDays: 3,
        reason: "Vacation",
        status: "PENDING",
      },
    });

    // Update balance to reflect pending days
    await prisma.leaveBalance.update({
      where: { id: leaveBalance1.id },
      data: { pendingDays: 3 },
    });
  });

  afterEach(async () => {
    // Clean up requests created during tests
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: employee.id },
    });
    await prisma.leaveRequest.deleteMany({
      where: { employeeId: otherEmployee.id },
    });

    // Clean up audit logs
    await prisma.auditLog.deleteMany({});

    // Reset balance
    await prisma.leaveBalance.update({
      where: { id: leaveBalance1.id },
      data: { pendingDays: 0, usedDays: 0 },
    });

    await prisma.leaveBalance.update({
      where: { id: leaveBalance2.id },
      data: { pendingDays: 0, usedDays: 0 },
    });
  });

  describe("approveLeaveRequest", () => {
    it("test 1: PENDING → APPROVED, pendingDays decremented, usedDays incremented", async () => {
      const result = await approveLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Approved",
        prisma
      );

      expect(result.status).toBe("APPROVED");
      expect(result.approvedById).toBe(manager.id);

      // Check balance
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: leaveBalance1.id },
      });
      expect(balance!.pendingDays).toBe(0);
      expect(balance!.usedDays).toBe(3);
    });

    it("test 2: records approvedById and optional comment", async () => {
      const result = await approveLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Good reason",
        prisma
      );

      expect(result.approvedById).toBe(manager.id);
      expect(result.approverComment).toBe("Good reason");
    });

    it("test 3: writes AuditLog entry", async () => {
      await approveLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Approved",
        prisma
      );

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: "APPROVE",
          entityType: "LeaveRequest",
          entityId: String(pendingRequest.id),
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog!.actorId).toBe(manager.id);
      expect(auditLog!.action).toBe("APPROVE");
    });

    it("test 4: throws 404 if request not found", async () => {
      await expect(
        approveLeaveRequest(99999, manager.id, manager.role, "Approved", prisma)
      ).rejects.toThrow(/not found/i);
    });

    it("test 5: throws 403 if MANAGER is on different team", async () => {
      await expect(
        approveLeaveRequest(
          pendingRequest.id,
          otherManager.id,
          otherManager.role,
          "Approved",
          prisma
        )
      ).rejects.toThrow(/Forbidden/);
    });

    it("test 6: MANAGER with null team is blocked (cannot approve any request)", async () => {
      // Create a MANAGER with no team assigned
      const nullTeamManager = await prisma.user.create({
        data: {
          name: "No Team Manager",
          email: "noteam.manager@test.com",
          passwordHash: await bcrypt.hash("pass", 12),
          role: Role.MANAGER,
          team: null,
        },
      });

      try {
        await expect(
          approveLeaveRequest(
            pendingRequest.id,
            nullTeamManager.id,
            nullTeamManager.role,
            "Approved",
            prisma
          )
        ).rejects.toThrow(/Forbidden/);
      } finally {
        await prisma.user.delete({ where: { id: nullTeamManager.id } });
      }
    });

    it("test 7b: HR_ADMIN cannot approve own leave request (self-approval blocked)", async () => {
      // Create a leave request belonging to the hrAdmin
      const ownRequest = await prisma.leaveRequest.create({
        data: {
          employeeId: hrAdmin.id,
          leaveTypeId: leaveType.id,
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-06-03"),
          halfDay: false,
          totalDays: 3,
          status: "PENDING",
        },
      });

      try {
        await expect(
          approveLeaveRequest(
            ownRequest.id,
            hrAdmin.id,
            hrAdmin.role,
            "Self approved",
            prisma
          )
        ).rejects.toThrow(/Cannot approve your own leave request/);
      } finally {
        await prisma.leaveRequest.delete({ where: { id: ownRequest.id } });
      }
    });

    it("test 7: HR_ADMIN can approve regardless of team", async () => {
      const result = await approveLeaveRequest(
        pendingRequest.id,
        hrAdmin.id,
        hrAdmin.role,
        "Approved by admin",
        prisma
      );

      expect(result.status).toBe("APPROVED");
      expect(result.approvedById).toBe(hrAdmin.id);
    });

    it("test 8: throws 422 if actor is approving own request", async () => {
      await expect(
        approveLeaveRequest(
          pendingRequest.id,
          employee.id,
          employee.role,
          "Self approval",
          prisma
        )
      ).rejects.toThrow(/Cannot approve your own leave request/);
    });

    it("test 9: throws 422 if status is not PENDING", async () => {
      // First reject the request
      await prisma.leaveRequest.update({
        where: { id: pendingRequest.id },
        data: { status: "REJECTED" },
      });

      await expect(
        approveLeaveRequest(
          pendingRequest.id,
          manager.id,
          manager.role,
          "Approved",
          prisma
        )
      ).rejects.toThrow(/Cannot approve: request is not PENDING/);
    });
  });

  describe("rejectLeaveRequest", () => {
    it("test 10: PENDING → REJECTED, pendingDays decremented", async () => {
      const result = await rejectLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Not approved",
        prisma
      );

      expect(result.status).toBe("REJECTED");

      // Check balance
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: leaveBalance1.id },
      });
      expect(balance!.pendingDays).toBe(0);
    });

    it("test 11: throws 422 if comment is empty/missing", async () => {
      await expect(
        rejectLeaveRequest(pendingRequest.id, manager.id, manager.role, "", prisma)
      ).rejects.toThrow(/Approver comment is required for rejection/);
    });

    it("test 12: throws 403 if MANAGER is on different team", async () => {
      await expect(
        rejectLeaveRequest(
          pendingRequest.id,
          otherManager.id,
          otherManager.role,
          "Rejected",
          prisma
        )
      ).rejects.toThrow(/Forbidden/);
    });
  });

  describe("approveCancellation", () => {
    it("test 13: CANCEL_REQUESTED → CANCELLED, usedDays decremented", async () => {
      // First approve the request to get APPROVED status
      await approveLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Approved",
        prisma
      );

      // Update balance to reflect usedDays (should be 3 from approval)
      await prisma.leaveBalance.update({
        where: { id: leaveBalance1.id },
        data: { usedDays: 3 },
      });

      // Request cancellation
      await prisma.leaveRequest.update({
        where: { id: pendingRequest.id },
        data: { status: "CANCEL_REQUESTED" },
      });

      // Now approve the cancellation
      const result = await approveCancellation(
        pendingRequest.id,
        manager.id,
        manager.role,
        prisma
      );

      expect(result.status).toBe("CANCELLED");

      // Check balance
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: leaveBalance1.id },
      });
      expect(balance!.usedDays).toBe(0);
    });

    it("test 14: throws 422 if status is not CANCEL_REQUESTED", async () => {
      // Request is still in PENDING status
      await expect(
        approveCancellation(pendingRequest.id, manager.id, manager.role, prisma)
      ).rejects.toThrow(/Cannot approve: request is not CANCEL_REQUESTED/);
    });
  });

  describe("rejectCancellation", () => {
    it("test 15: CANCEL_REQUESTED → APPROVED, no balance change", async () => {
      // First approve the request
      await approveLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Approved",
        prisma
      );

      // Update balance
      await prisma.leaveBalance.update({
        where: { id: leaveBalance1.id },
        data: { pendingDays: 0, usedDays: 3 },
      });

      // Request cancellation
      await prisma.leaveRequest.update({
        where: { id: pendingRequest.id },
        data: { status: "CANCEL_REQUESTED" },
      });

      // Reject the cancellation
      const result = await rejectCancellation(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Keep the leave",
        prisma
      );

      expect(result.status).toBe("APPROVED");

      // Check balance unchanged
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: leaveBalance1.id },
      });
      expect(balance!.usedDays).toBe(3);
    });

    it("test 16: throws 422 if comment missing", async () => {
      // Setup: approve and then set to CANCEL_REQUESTED
      await approveLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Approved",
        prisma
      );
      await prisma.leaveRequest.update({
        where: { id: pendingRequest.id },
        data: { status: "CANCEL_REQUESTED" },
      });

      await expect(
        rejectCancellation(pendingRequest.id, manager.id, manager.role, "", prisma)
      ).rejects.toThrow(/Approver comment is required for rejection/);
    });
  });

  describe("cancelLeaveRequest (updated)", () => {
    it("test 17: APPROVED → CANCEL_REQUESTED", async () => {
      // First approve the request
      await approveLeaveRequest(
        pendingRequest.id,
        manager.id,
        manager.role,
        "Approved",
        prisma
      );

      // Update balance
      await prisma.leaveBalance.update({
        where: { id: leaveBalance1.id },
        data: { pendingDays: 0, usedDays: 3 },
      });

      // Now cancel it
      const result = await cancelLeaveRequest(pendingRequest.id, employee.id, prisma);

      expect(result.status).toBe("CANCEL_REQUESTED");
    });

    it("test 18: PENDING → CANCELLED still works (existing behaviour preserved)", async () => {
      // Request is still in PENDING status
      const result = await cancelLeaveRequest(pendingRequest.id, employee.id, prisma);

      expect(result.status).toBe("CANCELLED");

      // Check balance
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: leaveBalance1.id },
      });
      expect(balance!.pendingDays).toBe(0);
    });
  });

  describe("getSubordinatePendingRequests", () => {
    it("test 19: MANAGER sees only same-team PENDING + CANCEL_REQUESTED", async () => {
      // Create another pending request for otherEmployee (Team B)
      await prisma.leaveRequest.create({
        data: {
          employeeId: otherEmployee.id,
          leaveTypeId: leaveType.id,
          startDate: new Date("2026-04-20"),
          endDate: new Date("2026-04-22"),
          halfDay: false,
          totalDays: 2,
          reason: "Vacation",
          status: "PENDING",
        },
      });

      // Get pending requests for manager (Team A)
      const result = await getSubordinatePendingRequests(
        manager.id,
        manager.role,
        prisma
      );

      // Should only see the employee's request, not otherEmployee's
      expect(result).toHaveLength(1);
      expect(result[0].employeeId).toBe(employee.id);
    });

    it("test 20: MANAGER does not see own requests in the list", async () => {
      // Create a pending request for the manager (should not appear)
      await prisma.leaveRequest.create({
        data: {
          employeeId: manager.id,
          leaveTypeId: leaveType.id,
          startDate: new Date("2026-05-20"),
          endDate: new Date("2026-05-22"),
          halfDay: false,
          totalDays: 3,
          reason: "Vacation",
          status: "PENDING",
        },
      });

      // Get pending requests
      const result = await getSubordinatePendingRequests(
        manager.id,
        manager.role,
        prisma
      );

      // Should only see employee's request, not manager's own
      expect(result.some((r: any) => r.employeeId === manager.id)).toBe(false);
    });

    it("test 21: HR_ADMIN sees ALL PENDING + CANCEL_REQUESTED", async () => {
      // Create a CANCEL_REQUESTED request for otherEmployee
      await prisma.leaveRequest.create({
        data: {
          employeeId: otherEmployee.id,
          leaveTypeId: leaveType.id,
          startDate: new Date("2026-04-20"),
          endDate: new Date("2026-04-22"),
          halfDay: false,
          totalDays: 2,
          reason: "Vacation",
          status: "CANCEL_REQUESTED",
        },
      });

      // Get pending requests for HR_ADMIN
      const result = await getSubordinatePendingRequests(
        hrAdmin.id,
        hrAdmin.role,
        prisma
      );

      // Should see both PENDING (employee's) and CANCEL_REQUESTED (otherEmployee's)
      const statuses = result.map((r: any) => r.status);
      expect(statuses).toContain("PENDING");
      expect(statuses).toContain("CANCEL_REQUESTED");
    });

    it("test 22: MANAGER on team with no pending requests returns empty array", async () => {
      // Clean up all requests for Team A
      await prisma.leaveRequest.deleteMany({
        where: { employeeId: employee.id },
      });

      // Get pending requests
      const result = await getSubordinatePendingRequests(
        manager.id,
        manager.role,
        prisma
      );

      expect(result).toHaveLength(0);
    });
  });
});

