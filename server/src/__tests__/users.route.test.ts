import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("users routes", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;
  let employeeId: string;
  let employeeToken: string;
  let targetUserId: string;

  beforeEach(async () => {
    // Clean up
    await prisma.user.deleteMany({});

    // Create HR_ADMIN
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
    hrAdminToken = JwtService.signAccessToken({
      id: hrAdminId,
      email: hrAdmin.email,
      role: "HR_ADMIN",
    });

    // Create MANAGER
    const manager = await prisma.user.create({
      data: {
        id: "manager-1",
        name: "Manager",
        email: "manager@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
        team: "Team A",
      },
    });
    managerId = manager.id;
    managerToken = JwtService.signAccessToken({
      id: managerId,
      email: manager.email,
      role: "MANAGER",
    });

    // Create EMPLOYEE
    const employee = await prisma.user.create({
      data: {
        id: "employee-1",
        name: "Employee",
        email: "employee@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
        team: "Team A",
      },
    });
    employeeId = employee.id;
    employeeToken = JwtService.signAccessToken({
      id: employeeId,
      email: employee.email,
      role: "EMPLOYEE",
    });

    // Create target user for PATCH test
    const targetUser = await prisma.user.create({
      data: {
        id: "target-user-1",
        name: "Target User",
        email: "target@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });
    targetUserId = targetUser.id;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("GET /api/users", () => {
    test("should return 401 without auth", async () => {
      const res = await request(app).get("/api/users");

      expect(res.status).toBe(401);
    });

    test("should return 403 for MANAGER", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });

    test("should return 403 for EMPLOYEE", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });

    test("should return 200 for HR_ADMIN with user array", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBe(4);

      // Check that response does not include passwordHash
      res.body.users.forEach((user: any) => {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("role");
        expect(user).toHaveProperty("team");
        expect(user).toHaveProperty("title");
        expect(user).not.toHaveProperty("passwordHash");
      });
    });
  });

  describe("PATCH /api/users/:id/identity", () => {
    test("should return 401 without auth", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/identity`)
        .send({ team: "Team B" });

      expect(res.status).toBe(401);
    });

    test("should return 403 for MANAGER", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/identity`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ team: "Team B" });

      expect(res.status).toBe(403);
    });

    test("should return 403 for EMPLOYEE", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/identity`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ team: "Team B" });

      expect(res.status).toBe(403);
    });

    test("should return 404 for non-existent user id", async () => {
      const res = await request(app)
        .patch(`/api/users/non-existent-id/identity`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ team: "Team B" });

      expect(res.status).toBe(404);
    });

    test("should return 400 for invalid body (missing both team and title)", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/identity`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test("should return 200 and update team and title for HR_ADMIN", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/identity`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ team: "Team C", title: "Senior Manager" });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.team).toBe("Team C");
      expect(res.body.user.title).toBe("Senior Manager");

      // Verify the update in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });
      expect(updatedUser?.team).toBe("Team C");
      expect(updatedUser?.title).toBe("Senior Manager");
    });

    test("returns 400 when team exceeds 100 characters", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}/identity`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ team: "a".repeat(101) });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/users/:id", () => {
    test("should return 401 without auth", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}`)
        .send({ role: "MANAGER" });

      expect(res.status).toBe(401);
    });

    test("should return 403 for MANAGER", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ role: "MANAGER" });

      expect(res.status).toBe(403);
    });

    test("should return 404 for non-existent user", async () => {
      const res = await request(app)
        .patch(`/api/users/non-existent-id`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ role: "MANAGER" });

      expect(res.status).toBe(404);
    });

    test("should return 400 for invalid role value", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ role: "INVALID_ROLE" });

      expect(res.status).toBe(400);
    });

    test("should return 200 and update role for HR_ADMIN", async () => {
      const res = await request(app)
        .patch(`/api/users/${targetUserId}`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({ role: "MANAGER" });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe("MANAGER");

      const updated = await prisma.user.findUnique({ where: { id: targetUserId } });
      expect(updated?.role).toBe("MANAGER");
    });
  });
});
