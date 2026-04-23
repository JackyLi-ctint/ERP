import request from "supertest";
import { createApp } from "../app";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

describe("POST /api/auth/login", () => {
  const app = createApp();

  beforeEach(async () => {
    // Reset database before each test
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    // Create a test user
    await prisma.user.create({
      data: {
        name: "John Doe",
        email: "john@example.com",
        passwordHash: await bcrypt.hash("SecurePass123", 12),
        role: "EMPLOYEE",
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

  test("should login successfully with correct credentials and return tokens", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "john@example.com",
      password: "SecurePass123",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    expect(response.body.user.email).toBe("john@example.com");
    expect(response.body.user.name).toBe("John Doe");
  });

  test("should return 401 for wrong password", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "john@example.com",
      password: "WrongPassword123",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Invalid email or password");
  });

  test("should return 401 for unknown user", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "unknown@example.com",
      password: "SecurePass123",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Invalid email or password");
  });

  test("should return 400 for missing email", async () => {
    const response = await request(app).post("/api/auth/login").send({
      password: "SecurePass123",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Missing required fields");
  });

  test("should return 400 for missing password", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "john@example.com",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Missing required fields");
  });

  test("should return 400 for invalid email format", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "not-an-email",
      password: "SecurePass123",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Validation error");
  });
});
