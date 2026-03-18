import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("DELETE /api/leave-requests/:id (cancel)", () => {
  let testUserId: string;
  let otherUserId: string;
  let hrAdminId: string;
  let leaveTypeId: number;
  let authToken: string;
  let otherUserToken: string;

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
        id: "hr-admin-1",
        name: "HR Admin",
        email: "hr@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });
    hrAdminId = hrAdmin.id;

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        id: "test-user-1",
        name: "Test User",
        email: "testuser@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });
    testUserId = testUser.id;

    // Create other user
    const otherUser = await prisma.user.create({
      data: {
        id: "other-user-1",
        name: "Other User",
        email: "otheruser@example.com",
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
      email: "testuser@example.com",
      role: "EMPLOYEE",
    });

    otherUserToken = JwtService.signAccessToken({
      id: otherUserId,
      email: "otheruser@example.com",
      role: "EMPLOYEE",
    });
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.publicHoliday.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  test("should return 401 without auth", async () => {
    const res = await request(app).delete("/api/leave-requests/1");

    expect(res.status).toBe(401);
  });

  test("should cancel PENDING request and decrement pendingDays", async () => {
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

    // Verify balance has pending days
    let balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: testUserId,
          leaveTypeId,
          year: 2026,
        },
      },
    });
    expect(balance?.pendingDays).toBe(1);

    // Cancel the request
    const res = await request(app)
      .delete(`/api/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.status).toBe("CANCELLED");

    // Verify balance decremented
    balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: {
          userId: testUserId,
          leaveTypeId,
          year: 2026,
        },
      },
    });
    expect(balance?.pendingDays).toBe(0);
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
      .delete(`/api/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(res.status).toBe(403);
  });

  test("should return 200 when cancelling APPROVED request (sets CANCEL_REQUESTED)", async () => {
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

    // Cancel approved request - should set CANCEL_REQUESTED instead of failing
    const res = await request(app)
      .delete(`/api/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leaveRequest.status).toBe("CANCEL_REQUESTED");
  });

  test("should return 422 when trying to cancel already CANCELLED request", async () => {
    // Create and cancel a request
    const createRes = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    const requestId = createRes.body.leaveRequest.id;

    // Cancel it
    await request(app)
      .delete(`/api/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${authToken}`);

    // Try to cancel again
    const res = await request(app)
      .delete(`/api/leave-requests/${requestId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(422);
  });

  test("should return 404 for non-existent request", async () => {
    const res = await request(app)
      .delete("/api/leave-requests/99999")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});
