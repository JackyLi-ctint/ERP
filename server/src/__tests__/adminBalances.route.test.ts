import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("admin balances routes", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let employeeId: string;
  let employeeToken: string;
  let leaveTypeId: number;
  let carryForwardLeaveTypeId: number;

  beforeEach(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-bal-admin-1",
        name: "HR Admin",
        email: "hr-bal-admin@example.com",
        passwordHash: "hashed",
        role: "HR_ADMIN",
      },
    });
    hrAdminId = hrAdmin.id;
    hrAdminToken = JwtService.signAccessToken({ id: hrAdminId, email: hrAdmin.email, role: "HR_ADMIN" });

    const employee = await prisma.user.create({
      data: {
        id: "emp-bal-admin-1",
        name: "Employee A",
        email: "emp-bal-admin@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });
    employeeId = employee.id;
    employeeToken = JwtService.signAccessToken({ id: employeeId, email: employee.email, role: "EMPLOYEE" });

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

    const cfLeaveType = await prisma.leaveType.create({
      data: {
        name: "Carry Forward Leave",
        defaultDays: 5,
        isCarryForward: true,
        requiresDocument: false,
        isActive: true,
        createdById: hrAdminId,
      },
    });
    carryForwardLeaveTypeId = cfLeaveType.id;
  });

  afterAll(async () => {
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  // ─── POST /admin/balances/init ─────────────────────────────────────────────

  it("POST /init returns 401 if not authenticated", async () => {
    const res = await request(app).post("/api/admin/balances/init").send({ year: 2026 });
    expect(res.status).toBe(401);
  });

  it("POST /init returns 403 if EMPLOYEE", async () => {
    const res = await request(app)
      .post("/api/admin/balances/init")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ year: 2026 });
    expect(res.status).toBe(403);
  });

  it("POST /init returns 400 if year missing", async () => {
    const res = await request(app)
      .post("/api/admin/balances/init")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("POST /init returns 400 if year out of range", async () => {
    const res1 = await request(app)
      .post("/api/admin/balances/init")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ year: 1999 });
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post("/api/admin/balances/init")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ year: 2101 });
    expect(res2.status).toBe(400);
  });

  it("POST /init creates balances and returns { created, skipped }", async () => {
    const res = await request(app)
      .post("/api/admin/balances/init")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("created");
    expect(res.body).toHaveProperty("skipped");
    // 2 users (hrAdmin + employee) × 2 leave types = 4
    expect(res.body.created).toBe(4);
    expect(res.body.skipped).toBe(0);
  });

  it("POST /init is idempotent (second call returns skipped > 0)", async () => {
    await request(app)
      .post("/api/admin/balances/init")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ year: 2026 });

    const res2 = await request(app)
      .post("/api/admin/balances/init")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ year: 2026 });
    expect(res2.status).toBe(200);
    expect(res2.body.skipped).toBeGreaterThan(0);
    expect(res2.body.created).toBe(0);
  });

  // ─── GET /admin/balances ───────────────────────────────────────────────────

  it("GET / returns 401 if not authenticated", async () => {
    const res = await request(app).get("/api/admin/balances");
    expect(res.status).toBe(401);
  });

  it("GET / returns 403 if EMPLOYEE", async () => {
    const res = await request(app)
      .get("/api/admin/balances")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("GET / HR_ADMIN gets all balances with user and leaveType names", async () => {
    // Create a balance first
    await prisma.leaveBalance.create({
      data: {
        userId: employeeId,
        leaveTypeId,
        year: 2026,
        totalDays: 20,
        usedDays: 5,
        pendingDays: 2,
      },
    });

    const res = await request(app)
      .get("/api/admin/balances")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("balances");
    expect(res.body.balances).toHaveLength(1);
    const b = res.body.balances[0];
    expect(b).toHaveProperty("userId");
    expect(b).toHaveProperty("userName");
    expect(b).toHaveProperty("userEmail");
    expect(b).toHaveProperty("leaveTypeName");
    expect(b).toHaveProperty("year");
    expect(b).toHaveProperty("totalDays");
    expect(b).toHaveProperty("usedDays");
    expect(b).toHaveProperty("pendingDays");
    expect(b.userName).toBe("Employee A");
    expect(b.leaveTypeName).toBe("Annual Leave");
  });

  it("GET / filters by year", async () => {
    await prisma.leaveBalance.createMany({
      data: [
        { userId: employeeId, leaveTypeId, year: 2025, totalDays: 20, usedDays: 0, pendingDays: 0 },
        { userId: employeeId, leaveTypeId, year: 2026, totalDays: 20, usedDays: 0, pendingDays: 0 },
      ],
    });

    const res = await request(app)
      .get("/api/admin/balances?year=2025")
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.balances).toHaveLength(1);
    expect(res.body.balances[0].year).toBe(2025);
  });

  it("GET / filters by userId", async () => {
    const employee2 = await prisma.user.create({
      data: {
        id: "emp-bal-admin-2",
        name: "Employee 2",
        email: "emp-bal-admin2@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    await prisma.leaveBalance.createMany({
      data: [
        { userId: employeeId, leaveTypeId, year: 2026, totalDays: 20, usedDays: 0, pendingDays: 0 },
        { userId: employee2.id, leaveTypeId, year: 2026, totalDays: 20, usedDays: 0, pendingDays: 0 },
      ],
    });

    const res = await request(app)
      .get(`/api/admin/balances?userId=${employeeId}`)
      .set("Authorization", `Bearer ${hrAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.balances).toHaveLength(1);
    expect(res.body.balances[0].userId).toBe(employeeId);
  });

  // ─── POST /admin/balances/carry-forward ────────────────────────────────────

  it("POST /carry-forward returns 401 if unauthenticated", async () => {
    const res = await request(app)
      .post("/api/admin/balances/carry-forward")
      .send({ fromYear: 2025, toYear: 2026 });
    expect(res.status).toBe(401);
  });

  it("POST /carry-forward returns 400 if fromYear >= toYear", async () => {
    const res = await request(app)
      .post("/api/admin/balances/carry-forward")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ fromYear: 2026, toYear: 2026 });
    expect(res.status).toBe(400);

    const res2 = await request(app)
      .post("/api/admin/balances/carry-forward")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ fromYear: 2027, toYear: 2026 });
    expect(res2.status).toBe(400);
  });

  it("POST /carry-forward carries forward only isCarryForward types", async () => {
    // Annual Leave (not carry forward): 20 total, 10 used -> 10 remaining
    await prisma.leaveBalance.create({
      data: { userId: employeeId, leaveTypeId, year: 2025, totalDays: 20, usedDays: 10, pendingDays: 0 },
    });
    // Carry Forward Leave: 5 total, 2 used -> 3 remaining
    await prisma.leaveBalance.create({
      data: { userId: employeeId, leaveTypeId: carryForwardLeaveTypeId, year: 2025, totalDays: 5, usedDays: 2, pendingDays: 0 },
    });

    const res = await request(app)
      .post("/api/admin/balances/carry-forward")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ fromYear: 2025, toYear: 2026 });

    expect(res.status).toBe(200);
    expect(res.body.carried).toBe(1);
    expect(res.body.skipped).toBe(0);

    // Verify that only carryForward type was carried
    const cfBalance = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId: employeeId, leaveTypeId: carryForwardLeaveTypeId, year: 2026 } },
    });
    expect(cfBalance).not.toBeNull();
    expect(cfBalance!.totalDays).toBe(3);

    // Annual leave should NOT have a 2026 balance created by carry-forward
    const annualBalance = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId: employeeId, leaveTypeId, year: 2026 } },
    });
    expect(annualBalance).toBeNull();
  });

  it("POST /carry-forward skips balances with 0 remainder", async () => {
    // Carry Forward Leave: 5 total, 5 used -> 0 remaining
    await prisma.leaveBalance.create({
      data: { userId: employeeId, leaveTypeId: carryForwardLeaveTypeId, year: 2025, totalDays: 5, usedDays: 5, pendingDays: 2 },
    });

    const res = await request(app)
      .post("/api/admin/balances/carry-forward")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ fromYear: 2025, toYear: 2026 });

    expect(res.status).toBe(200);
    expect(res.body.carried).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it("POST /carry-forward increments existing toYear balance", async () => {
    // Setup from year balance: 5 total, 2 used -> 3 carry
    await prisma.leaveBalance.create({
      data: { userId: employeeId, leaveTypeId: carryForwardLeaveTypeId, year: 2025, totalDays: 5, usedDays: 2, pendingDays: 0 },
    });

    // Setup existing toYear balance
    await prisma.leaveBalance.create({
      data: { userId: employeeId, leaveTypeId: carryForwardLeaveTypeId, year: 2026, totalDays: 10, usedDays: 1, pendingDays: 0 },
    });

    const res = await request(app)
      .post("/api/admin/balances/carry-forward")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .send({ fromYear: 2025, toYear: 2026 });

    expect(res.status).toBe(200);
    expect(res.body.carried).toBe(1);

    // Should have incremented from 10 -> 13
    const balance = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId: employeeId, leaveTypeId: carryForwardLeaveTypeId, year: 2026 } },
    });
    expect(balance!.totalDays).toBe(13);
  });
});
