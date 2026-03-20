import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";

const prisma = new PrismaClient();

// Mock the Azure AD service
jest.mock("../services/azureAd.service", () => ({
  isAzureConfigured: jest.fn(() => true),
  getAuthCodeUrl: jest.fn(async () => "https://login.microsoftonline.com/mock-auth-url"),
  generateState: jest.fn(() => "test-state"),
  consumeState: jest.fn((_state: string) => true), // accept any state in tests
  acquireTokenByCode: jest.fn(async (code: string) => {
    if (code === "valid-code") {
      return {
        oid: "00000000-0000-0000-0000-000000000001",
        name: "Azure User",
        email: "azure@example.com",
      };
    }
    throw new Error("Invalid code");
  }),
}));

describe("Azure AD routes", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Delete in dependency order to satisfy foreign key constraints
    await prisma.auditLog.deleteMany({});
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.user.deleteMany({});
  });

  // Test: GET /api/auth/azure/initiate when not configured → 503
  it("GET /auth/azure/initiate when not configured should return 503", async () => {
    const { isAzureConfigured } = require("../services/azureAd.service");
    isAzureConfigured.mockReturnValueOnce(false);

    const res = await request(app).get("/api/auth/azure/initiate");

    expect(res.status).toBe(503);
    expect(res.body.message).toContain("not configured");
  });

  // Test: GET /api/auth/azure/initiate when configured → should redirect
  it("GET /auth/azure/initiate when configured should redirect to auth URL", async () => {
    const res = await request(app).get("/api/auth/azure/initiate");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("login.microsoftonline.com");
  });

  // Test: GET /api/auth/azure/callback without code param → 400
  it("GET /auth/azure/callback without code param should return 400", async () => {
    const res = await request(app).get("/api/auth/azure/callback?state=test-state");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("authorization code");
  });

  // Test: GET /api/auth/azure/callback with invalid state → 400
  it("GET /auth/azure/callback with invalid/missing state should return 400", async () => {
    const { consumeState } = require("../services/azureAd.service");
    consumeState.mockReturnValueOnce(false);

    const res = await request(app).get("/api/auth/azure/callback?code=valid-code&state=stale-state");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("state");
  });

  // Test: GET /api/auth/azure/callback with valid code → user created and redirect
  it("GET /auth/azure/callback with valid code should create user and redirect", async () => {
    const res = await request(app).get("/api/auth/azure/callback?code=valid-code&state=test-state");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accessToken");
    expect(res.headers.location).toContain("refreshToken");

    // Verify user was created
    const user = await prisma.user.findUnique({
      where: { email: "azure@example.com" },
    });
    expect(user).toBeDefined();
    expect(user?.msEntraOid).toBe("00000000-0000-0000-0000-000000000001");
  });

  // Test: GET /api/auth/azure/callback with existing user → link and redirect
  it("GET /auth/azure/callback with existing user should link and redirect", async () => {
    // Pre-create a user
    await prisma.user.create({
      data: {
        id: "existing-user",
        name: "Existing User",
        email: "azure@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    const res = await request(app).get("/api/auth/azure/callback?code=valid-code&state=test-state");

    expect(res.status).toBe(302);

    // Verify user was linked to Azure AD
    const user = await prisma.user.findUnique({
      where: { email: "azure@example.com" },
    });
    expect(user?.msEntraOid).toBe("00000000-0000-0000-0000-000000000001");
  });

  // Test: POST /auth/azure/callback with invalid code → error handling
  it("GET /auth/azure/callback with invalid code should return 500", async () => {
    const { acquireTokenByCode, consumeState, generateState } = require("../services/azureAd.service");
    acquireTokenByCode.mockRejectedValueOnce(new Error("Invalid code"));
    // Insert a valid state so we pass the CSRF check
    generateState.mockReturnValueOnce("valid-state");
    consumeState.mockReturnValueOnce(true);

    const res = await request(app).get("/api/auth/azure/callback?code=invalid-code&state=valid-state");

    expect(res.status).toBe(500);
  });
});
