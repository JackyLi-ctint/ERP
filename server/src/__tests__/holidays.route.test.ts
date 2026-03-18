import request from "supertest";
import { createApp } from "../app";
import { PrismaClient } from "@prisma/client";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("GET /api/holidays", () => {
  const app = createApp();

  beforeEach(async () => {
    // Reset database before each test
    await prisma.publicHoliday.deleteMany({});
    await prisma.user.deleteMany({});

    // Seed a test user
    await prisma.user.create({
      data: {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    // Seed some 2025 holidays
    await prisma.publicHoliday.createMany({
      data: [
        { date: new Date("2025-01-01"), name: "New Year's Day", year: 2025 },
        {
          date: new Date("2025-04-04"),
          name: "Ching Ming Festival",
          year: 2025,
        },
        { date: new Date("2025-05-01"), name: "Labour Day", year: 2025 },
        {
          date: new Date("2025-12-25"),
          name: "Christmas Day",
          year: 2025,
        },
      ],
    });

    // Seed a 2026 holiday
    await prisma.publicHoliday.create({
      data: {
        date: new Date("2026-01-01"),
        name: "New Year's Day",
        year: 2026,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should return 401 without valid JWT", async () => {
    const res = await request(app).get("/api/holidays?year=2025");
    expect(res.status).toBe(401);
  });

  test("should return holidays for requested year with valid JWT", async () => {
    // Create a valid access token using JwtService
    const token = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .get("/api/holidays?year=2025")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("holidays");
    expect(Array.isArray(res.body.holidays)).toBe(true);
    expect(res.body.holidays.length).toBe(4);
    // Verify structure
    expect(res.body.holidays[0]).toHaveProperty("id");
    expect(res.body.holidays[0]).toHaveProperty("date");
    expect(res.body.holidays[0]).toHaveProperty("name");
    expect(res.body.holidays[0]).toHaveProperty("year");
  });

  test("should return only holidays for the requested year", async () => {
    const token = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .get("/api/holidays?year=2026")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.holidays.length).toBe(1);
    expect(res.body.holidays[0].year).toBe(2026);
  });

  test("should return empty array for year with no holidays", async () => {
    const token = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .get("/api/holidays?year=2027")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.holidays.length).toBe(0);
  });

  test("should allow HRs and managers to access holidays", async () => {
    const managerToken = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "MANAGER",
    });
    const hrToken = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "HR_ADMIN",
    });

    const res1 = await request(app)
      .get("/api/holidays?year=2025")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .get("/api/holidays?year=2025")
      .set("Authorization", `Bearer ${hrToken}`);
    expect(res2.status).toBe(200);
  });

  test("should return 400 for year out of valid range (too old)", async () => {
    const token = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .get("/api/holidays?year=1999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test("should return 400 for year out of valid range (too far future)", async () => {
    const token = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .get("/api/holidays?year=2101")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test("should return 400 for non-numeric year parameter", async () => {
    const token = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .get("/api/holidays?year=abc")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test("should return 400 when year parameter is missing", async () => {
    const token = JwtService.signAccessToken({
      id: "test-user-id",
      email: "test@example.com",
      role: "EMPLOYEE",
    });

    const res = await request(app)
      .get("/api/holidays")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
