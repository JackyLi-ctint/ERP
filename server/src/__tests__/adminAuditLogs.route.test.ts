import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("admin audit logs routes", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-audit-admin-1",
        name: "HR Admin",
        email: "hr-audit-admin@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });
    hrAdminId = hrAdmin.id;
    hrAdminToken = JwtService.signAccessToken({ id: hrAdminId, email: hrAdmin.email, role: "HR_ADMIN" });

    const manager = await prisma.user.create({
      data: {
        id: "manager-audit-1",
        name: "Manager",
        email: "manager-audit@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
      },
    });
    managerId = manager.id;
    managerToken = JwtService.signAccessToken({ id: managerId, email: manager.email, role: "MANAGER" });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // ─── GET /admin/audit-logs ────────────────────────────────────────────────

  it("GET /audit-logs returns 401 if not authenticated", async () => {
    const res = await request(app).get("/api/admin/audit-logs");
    expect(res.status).toBe(401);
  });

  it("GET /audit-logs returns 403 if MANAGER (not HR_ADMIN)", async () => {
    const res = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /audit-logs returns 200 with empty logs by default", async () => {
    const res = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("logs");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page");
    expect(res.body).toHaveProperty("pageSize");
    expect(res.body).toHaveProperty("totalPages");
    expect(res.body.logs).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.totalPages).toBe(0);
  });

  it("GET /audit-logs returns logs with actor populated", async () => {
    const now = new Date();
    await prisma.auditLog.create({
      data: {
        actorId: hrAdminId,
        action: "APPROVE_LEAVE",
        entityType: "LeaveRequest",
        entityId: "123",
        before: { status: "PENDING" },
        after: { status: "APPROVED" },
        timestamp: now,
      },
    });

    const res = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
    const log = res.body.logs[0];
    expect(log).toHaveProperty("id");
    expect(log).toHaveProperty("actorId", hrAdminId);
    expect(log).toHaveProperty("actor");
    expect(log.actor).toHaveProperty("id", hrAdminId);
    expect(log.actor).toHaveProperty("name", "HR Admin");
    expect(log.actor).toHaveProperty("email", "hr-audit-admin@example.com");
    expect(log).toHaveProperty("action", "APPROVE_LEAVE");
    expect(log).toHaveProperty("entityType", "LeaveRequest");
    expect(log).toHaveProperty("entityId", "123");
    expect(log).toHaveProperty("before");
    expect(log).toHaveProperty("after");
    expect(log).toHaveProperty("timestamp");
  });

  it("GET /audit-logs filters by date range", async () => {
    const jan1 = new Date("2026-01-01T00:00:00Z");
    const feb1 = new Date("2026-02-01T00:00:00Z");
    const mar1 = new Date("2026-03-01T00:00:00Z");
    const apr1 = new Date("2026-04-01T00:00:00Z");

    await prisma.auditLog.createMany({
      data: [
        {
          actorId: hrAdminId,
          action: "ACTION1",
          entityType: "LeaveRequest",
          entityId: "1",
          timestamp: jan1,
        },
        {
          actorId: hrAdminId,
          action: "ACTION2",
          entityType: "LeaveRequest",
          entityId: "2",
          timestamp: feb1,
        },
        {
          actorId: hrAdminId,
          action: "ACTION3",
          entityType: "LeaveRequest",
          entityId: "3",
          timestamp: mar1,
        },
        {
          actorId: hrAdminId,
          action: "ACTION4",
          entityType: "LeaveRequest",
          entityId: "4",
          timestamp: apr1,
        },
      ],
    });

    // Filter from Feb 1 to Mar 31
    const res = await request(app)
      .get("/api/admin/audit-logs")
      .query({ from: "2026-02-01", to: "2026-03-31" })
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // ACTION2 (Feb) and ACTION3 (Mar)
    expect(res.body.logs).toHaveLength(2);
  });

  it("GET /audit-logs filters by entityType", async () => {
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: hrAdminId,
          action: "CREATE",
          entityType: "LeaveRequest",
          entityId: "1",
        },
        {
          actorId: hrAdminId,
          action: "CREATE",
          entityType: "LeaveBalance",
          entityId: "2",
        },
        {
          actorId: hrAdminId,
          action: "UPDATE",
          entityType: "LeaveRequest",
          entityId: "3",
        },
      ],
    });

    const res = await request(app)
      .get("/api/admin/audit-logs")
      .query({ entityType: "LeaveRequest" })
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // 2 LeaveRequest logs
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.logs.every((log: any) => log.entityType === "LeaveRequest")).toBe(true);
  });

  it("GET /audit-logs filters by actorId", async () => {
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: hrAdminId,
          action: "ACTION1",
          entityType: "LeaveRequest",
          entityId: "1",
        },
        {
          actorId: managerId,
          action: "ACTION2",
          entityType: "LeaveRequest",
          entityId: "2",
        },
        {
          actorId: hrAdminId,
          action: "ACTION3",
          entityType: "LeaveRequest",
          entityId: "3",
        },
      ],
    });

    const res = await request(app)
      .get("/api/admin/audit-logs")
      .query({ actorId: hrAdminId })
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // 2 logs by hrAdminId
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.logs.every((log: any) => log.actorId === hrAdminId)).toBe(true);
  });

  it("GET /audit-logs handles pagination", async () => {
    // Create 30 logs
    const logsData = [];
    for (let i = 0; i < 30; i++) {
      logsData.push({
        actorId: hrAdminId,
        action: `ACTION_${i}`,
        entityType: "LeaveRequest",
        entityId: `${i}`,
      });
    }
    await prisma.auditLog.createMany({ data: logsData });

    // Get page 1 with pageSize 10
    const res1 = await request(app)
      .get("/api/admin/audit-logs")
      .query({ page: 1, pageSize: 10 })
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.logs).toHaveLength(10);
    expect(res1.body.page).toBe(1);
    expect(res1.body.pageSize).toBe(10);
    expect(res1.body.total).toBe(30);
    expect(res1.body.totalPages).toBe(3);

    // Get page 2
    const res2 = await request(app)
      .get("/api/admin/audit-logs")
      .query({ page: 2, pageSize: 10 })
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.logs).toHaveLength(10);
    expect(res2.body.page).toBe(2);

    // Get page 3
    const res3 = await request(app)
      .get("/api/admin/audit-logs")
      .query({ page: 3, pageSize: 10 })
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res3.status).toBe(200);
    expect(res3.body.logs).toHaveLength(10);
    expect(res3.body.page).toBe(3);
  });

  it("GET /audit-logs returns 400 for invalid query params", async () => {
    const res = await request(app)
      .get("/api/admin/audit-logs")
      .query({ page: "invalid" })
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("GET /audit-logs orders by timestamp descending", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    await prisma.auditLog.createMany({
      data: [
        {
          actorId: hrAdminId,
          action: "FIRST",
          entityType: "LeaveRequest",
          entityId: "1",
          timestamp: twoDaysAgo,
        },
        {
          actorId: hrAdminId,
          action: "SECOND",
          entityType: "LeaveRequest",
          entityId: "2",
          timestamp: yesterday,
        },
        {
          actorId: hrAdminId,
          action: "THIRD",
          entityType: "LeaveRequest",
          entityId: "3",
          timestamp: now,
        },
      ],
    });

    const res = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(3);
    expect(res.body.logs[0].action).toBe("THIRD"); // Most recent first
    expect(res.body.logs[1].action).toBe("SECOND");
    expect(res.body.logs[2].action).toBe("FIRST");
  });
});
