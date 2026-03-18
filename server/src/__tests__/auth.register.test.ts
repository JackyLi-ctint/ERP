import request from "supertest";
import { createApp } from "../app";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("POST /api/auth/register", () => {
  const app = createApp();

  beforeEach(async () => {
    // Reset database before each test
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("should register a new user successfully with 201 status and tokens", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123",
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    expect(response.body.user).toHaveProperty("id");
    expect(response.body.user.email).toBe("john@example.com");
    expect(response.body.user.name).toBe("John Doe");
    expect(response.body.user.role).toBe("EMPLOYEE");
  });

  test("should return 409 for duplicate email", async () => {
    // Create first user
    await request(app).post("/api/auth/register").send({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123",
    });

    // Try to create user with same email
    const response = await request(app).post("/api/auth/register").send({
      name: "Jane Doe",
      email: "john@example.com",
      password: "SecurePass456",
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("already exists");
  });

  test("should return 400 for missing required fields", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "John Doe",
      // missing email and password
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Missing required fields");
  });

  test("should return 400 for weak password (less than 8 characters)", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "John Doe",
      email: "john@example.com",
      password: "Weak1",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Validation error");
  });

  test("should return 400 for password without uppercase letter", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "John Doe",
      email: "john@example.com",
      password: "lowercase123",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Validation error");
  });

  test("should return 400 for password without number", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePassNo",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Validation error");
  });

  test("should return 400 for invalid email format", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "John Doe",
      email: "not-an-email",
      password: "SecurePass123",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Validation error");
  });
});
