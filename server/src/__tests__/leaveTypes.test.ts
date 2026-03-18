import request from "supertest";
import { createApp } from "../app";
import { PrismaClient } from "@prisma/client";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("Leave Types Routes", () => {
  const app = createApp();

  let employeeToken: string;
  let managerToken: string;
  let hrAdminToken: string;

  let employeeId: string;
  let managerId: string;
  let hrAdminId: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test users
    const employee = await prisma.user.create({
      data: {
        id: "employee-1",
        name: "Employee User",
        email: "employee@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    const manager = await prisma.user.create({
      data: {
        id: "manager-1",
        name: "Manager User",
        email: "manager@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
      },
    });

    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-admin-1",
        name: "HR Admin User",
        email: "hradmin@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });

    employeeId = employee.id;
    managerId = manager.id;
    hrAdminId = hrAdmin.id;

    // Create tokens
    employeeToken = JwtService.signAccessToken({
      id: employeeId,
      email: "employee@example.com",
      role: "EMPLOYEE",
    });

    managerToken = JwtService.signAccessToken({
      id: managerId,
      email: "manager@example.com",
      role: "MANAGER",
    });

    hrAdminToken = JwtService.signAccessToken({
      id: hrAdminId,
      email: "hradmin@example.com",
      role: "HR_ADMIN",
    });
  });

  afterAll(async () => {
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe("GET /api/leave-types", () => {
    test("should return 401 without auth", async () => {
      const res = await request(app).get("/api/leave-types");
      expect(res.status).toBe(401);
    });

    test("should return active leave types for authenticated employee", async () => {
      // Create leave types
      await prisma.leaveType.createMany({
        data: [
          {
            name: "Annual Leave",
            defaultDays: 20,
            isCarryForward: false,
            requiresDocument: false,
            isActive: true,
            createdById: hrAdminId,
          },
          {
            name: "Sick Leave",
            defaultDays: 10,
            isCarryForward: false,
            requiresDocument: true,
            isActive: true,
            createdById: hrAdminId,
          },
          {
            name: "Inactive Leave",
            defaultDays: 5,
            isCarryForward: false,
            requiresDocument: false,
            isActive: false,
            createdById: hrAdminId,
          },
        ],
      });

      const res = await request(app)
        .get("/api/leave-types")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("leaveTypes");
      expect(Array.isArray(res.body.leaveTypes)).toBe(true);
      expect(res.body.leaveTypes.length).toBe(2); // Only active types
      expect(res.body.leaveTypes.every((lt: any) => lt.isActive === true)).toBe(true);
      expect(res.body.leaveTypes.some((lt: any) => lt.name === "Annual Leave")).toBe(true);
    });

    test("should not return deactivated leave types", async () => {
      await prisma.leaveType.create({
        data: {
          name: "Deactivated Leave",
          defaultDays: 5,
          isCarryForward: false,
          requiresDocument: false,
          isActive: false,
          createdById: hrAdminId,
        },
      });

      const res = await request(app)
        .get("/api/leave-types")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.leaveTypes.length).toBe(0);
    });
  });

  describe("GET /api/leave-types/:id", () => {
    test("should return leave type by ID for authenticated user", async () => {
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

      const res = await request(app)
        .get(`/api/leave-types/${leaveType.id}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("leaveType");
      expect(res.body.leaveType.id).toBe(leaveType.id);
      expect(res.body.leaveType.name).toBe("Annual Leave");
    });
  });

  describe("POST /api/leave-types", () => {
    test("should return 403 when employee tries to create", async () => {
      const res = await request(app)
        .post("/api/leave-types")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          name: "Annual Leave",
          defaultDays: 20,
        });

      expect(res.status).toBe(403);
    });

    test("should return 403 when manager tries to create", async () => {
      const res = await request(app)
        .post("/api/leave-types")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          name: "Annual Leave",
          defaultDays: 20,
        });

      expect(res.status).toBe(403);
    });

    test("should allow HR Admin to create leave type with 201 status", async () => {
      const res = await request(app)
        .post("/api/leave-types")
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({
          name: "Annual Leave",
          defaultDays: 20,
          isCarryForward: false,
          requiresDocument: false,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("leaveType");
      expect(res.body.leaveType.name).toBe("Annual Leave");
      expect(res.body.leaveType.defaultDays).toBe(20);
      expect(res.body.leaveType.isActive).toBe(true);
      expect(res.body.leaveType.createdById).toBe(hrAdminId);
    });

    test("should return 409 on duplicate leave type name", async () => {
      // Create first leave type
      await prisma.leaveType.create({
        data: {
          name: "Annual Leave",
          defaultDays: 20,
          isCarryForward: false,
          requiresDocument: false,
          isActive: true,
          createdById: hrAdminId,
        },
      });

      // Try to create duplicate
      const res = await request(app)
        .post("/api/leave-types")
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({
          name: "Annual Leave",
          defaultDays: 25,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain("already exists");
    });

    test("should return 422 when defaultDays is 0 or negative", async () => {
      const res = await request(app)
        .post("/api/leave-types")
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({
          name: "Invalid Leave",
          defaultDays: 0,
        });

      expect(res.status).toBe(422);
      expect(res.body.message).toContain("defaultDays");
    });

    test("should return 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/leave-types")
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({
          defaultDays: 20,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("name");
    });
  });

  describe("PATCH /api/leave-types/:id", () => {
    test("should allow HR Admin to update leave type", async () => {
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

      const res = await request(app)
        .patch(`/api/leave-types/${leaveType.id}`)
        .set("Authorization", `Bearer ${hrAdminToken}`)
        .send({
          defaultDays: 25,
          isCarryForward: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.leaveType.defaultDays).toBe(25);
      expect(res.body.leaveType.isCarryForward).toBe(true);
      expect(res.body.leaveType.name).toBe("Annual Leave"); // Unchanged
    });

    test("should return 403 for non-HR-Admin trying to update", async () => {
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

      const res = await request(app)
        .patch(`/api/leave-types/${leaveType.id}`)
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          defaultDays: 25,
        });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/leave-types/:id", () => {
    test("should allow HR Admin to deactivate leave type", async () => {
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

      const res = await request(app)
        .delete(`/api/leave-types/${leaveType.id}`)
        .set("Authorization", `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);

      // Verify it's deactivated, not deleted
      const updated = await prisma.leaveType.findUnique({
        where: { id: leaveType.id },
      });
      expect(updated?.isActive).toBe(false);
    });

    test("should return 403 for non-HR-Admin trying to deactivate", async () => {
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

      const res = await request(app)
        .delete(`/api/leave-types/${leaveType.id}`)
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });
  });
});
