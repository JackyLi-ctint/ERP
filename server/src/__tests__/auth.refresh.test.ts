import request from "supertest";
import { createApp } from "../app";
import { PrismaClient } from "@prisma/client";
import { JwtService } from "../auth/jwt.service";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

describe("POST /api/auth/refresh", () => {
  const app = createApp();

  beforeEach(async () => {
    // Reset database before each test
    await prisma.user.deleteMany({});

    // Create a test user
    await prisma.user.create({
      data: {
        id: "test-user-id",
        name: "John Doe",
        email: "john@example.com",
        passwordHash: await bcrypt.hash("SecurePass123", 12),
        role: "EMPLOYEE",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should return 401 when refresh token is missing", async () => {
    const response = await request(app).post("/api/auth/refresh").send({});

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Refresh token is required");
  });

  test("should return 401 when refresh token is invalid", async () => {
    const response = await request(app).post("/api/auth/refresh").send({
      token: "invalid-token",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Invalid or expired refresh token");
  });

  test("should return new accessToken with valid refresh token", async () => {
    // Create a valid refresh token
    const refreshToken = JwtService.signRefreshToken({
      id: "test-user-id",
      email: "john@example.com",
      role: "EMPLOYEE",
    });

    const response = await request(app).post("/api/auth/refresh").send({
      token: refreshToken,
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    expect(response.body.user.email).toBe("john@example.com");
  });
});
