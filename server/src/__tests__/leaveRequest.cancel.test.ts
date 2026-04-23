import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("PATCH /api/leave-requests/:id/cancel (cancel with reason)", () => {
  let testUserId: string;
  let otherUserId: string;
  let hrAdminId: string;
  let leaveTypeId: number;
  let authToken: string;
  let otherUserToken: string;

  beforeAll(() => {
    jest.useFakeTimers({
      doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
    });
    jest.setSystemTime(new Date("2026-03-18T00:00:00Z"));
  });

  beforeEach(async () => {
    // Clean up in correct order
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.publicHoliday.deleteMany({});
    await prisma.user.deleteMany({});

    // Create HR Admin
    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-admin-patch-1",
        name: "HR Admin",
        email: "hr-patch@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });
    hrAdminId = hrAdmin.id;

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        id: "test-user-patch-1",
        name: "Test User",
        email: "testuser-patch@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });
    testUserId = testUser.id;

    // Create other user
    const otherUser = await prisma.user.create({
      data: {
        id: "other-user-patch-1",
        name: "Other User",
        email: "otheruser-patch@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });
    otherUserId = otherUser.id;

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

    // Create leave balances
    await prisma.leaveBalance.create({
      data: {
        userId: testUserId,
        leaveTypeId: leaveTypeId,
        year: 2026,
        totalDays: 20,
        usedDays: 0,
        pendingDays: 0,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        userId: otherUserId,
        leaveTypeId: leaveTypeId,
        year: 2026,
        totalDays: 20,
        usedDays: 0,
        pendingDays: 0,
      },
    });

    // Seed HK holidays
    await prisma.publicHoliday.createMany({
      data: [
        { date: new Date("2026-01-01"), name: "New Year's Day", year: 2026 },
        { date: new Date("2026-04-03"), name: "Good Friday", year: 2026 },
        {
          date: new Date("2026-04-04"),
          name: "Day after Good Friday",
          year: 2026,
        },
        { date: new Date("2026-04-06"), name: "Easter Monday", year: 2026 },
      ],
    });

    // Generate auth tokens
    authToken = JwtService.signAccessToken({
      id: testUserId,
      email: "testuser-patch@example.com",
      role: "EMPLOYEE",
    });

    otherUserToken = JwtService.signAccessToken({
      id: otherUserId,
      email: "otheruser-patch@example.com",
      role: "EMPLOYEE",
    });
  });

  test("should return 401 without auth", async () => {
    const res = await request(app).patch("/api/leave-requests/1/cancel");

    expect(res.status).toBe(401);
  });

  test("should cancel PENDING request with reason and store cancellationReason", async () => {
    // Create a pending request
    const createRes = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    const requestId = createRes.body.leaveRequest.id;

    // Cancel with reason
    const res = await request(app)
      .patch(`/api/leave-requests/${requestId}/cancel`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        reason: "Personal reasons",
      });

    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.status).toBe("CANCELLED");
    expect(res.body.leaveRequest.cancellationReason).toBe("Personal reasons");

    // Verify in database
    const cancelledRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
    expect(cancelledRequest?.cancellationReason).toBe("Personal reasons");
  });

  test("should cancel PENDING request without reason (optional field)", async () => {
    // Create a pending request
    const createRes = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    const requestId = createRes.body.leaveRequest.id;

    // Cancel without reason
    const res = await request(app)
      .patch(`/api/leave-requests/${requestId}/cancel`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.status).toBe("CANCELLED");
    expect(res.body.leaveRequest.cancellationReason).toBeNull();
  });

  test("should reject reason exceeding 500 chars", async () => {
    // Create a pending request
    const createRes = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    const requestId = createRes.body.leaveRequest.id;

    const longReason = "a".repeat(501);
    const res = await request(app)
      .patch(`/api/leave-requests/${requestId}/cancel`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        reason: longReason,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/validation|Validation/i);
  });

  test("should return 403 when non-owner tries to cancel", async () => {
    // Create a pending request for testUser
    const createRes = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    const requestId = createRes.body.leaveRequest.id;

    // Try to cancel as other user
    const res = await request(app)
      .patch(`/api/leave-requests/${requestId}/cancel`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({
        reason: "Trying to cancel someone else's request",
      });

    expect(res.status).toBe(403);
  });

  test("should cancel APPROVED request with reason (sets CANCEL_REQUESTED)", async () => {
    // Create a pending request
    const createRes = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    const requestId = createRes.body.leaveRequest.id;

    // Manually approve it
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED" },
    });

    // Cancel approved request with reason - should set CANCEL_REQUESTED instead of failing
    const res = await request(app)
      .patch(`/api/leave-requests/${requestId}/cancel`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        reason: "Need to reschedule",
      });

    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.status).toBe("CANCEL_REQUESTED");
    expect(res.body.leaveRequest.cancellationReason).toBe("Need to reschedule");
  });

  test("should return 404 for non-existent request", async () => {
    const res = await request(app)
      .patch("/api/leave-requests/99999/cancel")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        reason: "Test reason",
      });

    expect(res.status).toBe(404);
  });

  afterAll(async () => {
    jest.useRealTimers();
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.publicHoliday.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });
});
