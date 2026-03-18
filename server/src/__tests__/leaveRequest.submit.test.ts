import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("POST /api/leave-requests (submit)", () => {
  let testUserId: string;
  let hrAdminId: string;
  let leaveTypeId: number;
  let authToken: string;

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

    // Create leave balance for test user, year 2026
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

    // Generate auth token for test user
    authToken = JwtService.signAccessToken({
      id: testUserId,
      email: "testuser@example.com",
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
    const res = await request(app)
      .post("/api/leave-requests")
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    expect(res.status).toBe(401);
  });

  test("should submit valid full-day request and increment pendingDays", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
        reason: "Personal leave",
      });

    expect(res.status).toBe(201);
    expect(res.body.leaveRequest).toBeDefined();
    expect(res.body.leaveRequest.status).toBe("PENDING");
    expect(res.body.leaveRequest.totalDays).toBe(1);
    expect(res.body.leaveRequest.halfDay).toBe(false);

    // Verify balance updated
    const updatedBalance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: { userId: testUserId, leaveTypeId, year: 2026 },
      },
    });
    expect(updatedBalance?.pendingDays).toBe(1);
  });

  test("should submit valid half-day AM request with 0.5 totalDays", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
        halfDay: true,
        period: "AM",
      });

    expect(res.status).toBe(201);
    expect(res.body.leaveRequest.totalDays).toBe(0.5);
    expect(res.body.leaveRequest.halfDay).toBe(true);
    expect(res.body.leaveRequest.period).toBe("AM");

    // Verify balance updated
    const updatedBalance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: { userId: testUserId, leaveTypeId, year: 2026 },
      },
    });
    expect(updatedBalance?.pendingDays).toBe(0.5);
  });

  test("should submit valid half-day PM request with 0.5 totalDays", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
        halfDay: true,
        period: "PM",
      });

    expect(res.status).toBe(201);
    expect(res.body.leaveRequest.totalDays).toBe(0.5);
    expect(res.body.leaveRequest.period).toBe("PM");
  });

  test("should return 422 for insufficient balance", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-05-01",
        endDate: "2026-06-30", // ~40 working days
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/balance|Insufficient/i);
  });

  test("should return 409 for overlapping PENDING request", async () => {
    // Create first request
    await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-03",
      });

    // Try overlapping request
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-02",
        endDate: "2026-04-05",
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/overlap/i);
  });

  test("should return 409 for overlapping APPROVED request", async () => {
    // Create and approve first request
    const firstRes = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-03",
      });

    const requestId = firstRes.body.leaveRequest.id;

    // Manually approve it
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED" },
    });

    // Try overlapping request
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-02",
        endDate: "2026-04-05",
      });

    expect(res.status).toBe(409);
  });

  test("should return 422 for past start date", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-03-01",
        endDate: "2026-03-05",
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/start|date|past/i);
  });

  test("should return 422 for weekend-only range (0 working days)", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-04", // Saturday
        endDate: "2026-04-05", // Sunday
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/working|days/i);
  });

  test("should return 422 for holiday-only range (0 working days)", async () => {
    // 2026-04-03 (Good Friday), 2026-04-04 (Day after) are holidays
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-03",
        endDate: "2026-04-04",
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/working|days/i);
  });

  test("should return 422 when leave balance not found", async () => {
    // Create a new leave type without balance
    const newLeaveType = await prisma.leaveType.create({
      data: {
        name: "Uninitialized Leave",
        defaultDays: 10,
        isCarryForward: false,
        requiresDocument: false,
        isActive: true,
        createdById: hrAdminId,
      },
    });

    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId: newLeaveType.id,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/balance|not found|exists/i);
  });

  test("should return 404 for non-existent leave type", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId: 99999,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    expect(res.status).toBe(404);
  });

  test("should return 422 when startDate > endDate", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-05",
        endDate: "2026-04-01",
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/start|end|date/i);
  });

  test("should return 422 when halfDay is true on multi-day range", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-03",
        halfDay: true,
        period: "AM",
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/halfDay|single|day/i);
  });

  test("should allow same-day leave submission (today is valid)", async () => {
    // Note: tests run on 2026-03-18 in the spec, but we'll test with a future date
    // that we know is valid (2026-04-01 is Wednesday)
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    expect(res.status).toBe(201);
    expect(res.body.leaveRequest.totalDays).toBe(1);
  });

  test("should apply multiple pending requests to balance calculation", async () => {
    // Submit first request: 1 day
    await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
      });

    // Submit second request: 1 day
    await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-07",
        endDate: "2026-04-07",
      });

    // Verify balance has 2 pending days
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_leaveTypeId_year: { userId: testUserId, leaveTypeId, year: 2026 },
      },
    });
    expect(balance?.pendingDays).toBe(2);

    // Try to submit 19+ more days - should fail (20 - 2 = 18 available)
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-05-01",
        endDate: "2026-06-30", // ~40 working days
      });

    expect(res.status).toBe(422);
  });

  test("returns 400 when reason exceeds 500 characters", async () => {
    const res = await request(app)
      .post("/api/leave-requests")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        leaveTypeId,
        startDate: "2026-04-01",
        endDate: "2026-04-01",
        reason: "a".repeat(501),
      });

    expect(res.status).toBe(400);
  });
});
