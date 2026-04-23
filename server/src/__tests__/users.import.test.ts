import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../app";
import { JwtService } from "../auth/jwt.service";

const prisma = new PrismaClient();

describe("CSV user import", () => {
  let hrAdminId: string;
  let hrAdminToken: string;
  let managerId: string;
  let managerToken: string;

  beforeEach(async () => {
    // Clean up
    await prisma.leaveRequest.deleteMany({});
    await prisma.leaveBalance.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});

    // Create HR_ADMIN
    const hrAdmin = await prisma.user.create({
      data: {
        id: "hr-import-1",
        name: "HR Admin",
        email: "hr-import@example.com",
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

    // Create MANAGER (non-HR_ADMIN)
    const manager = await prisma.user.create({
      data: {
        id: "mgr-import-1",
        name: "Manager",
        email: "manager-import@example.com",
        passwordHash: "hashed",
        role: "MANAGER",
      },
    });
    managerId = manager.id;
    managerToken = JwtService.signAccessToken({
      id: managerId,
      email: manager.email,
      role: "MANAGER",
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

  // Test 1: Valid CSV with 2 rows → 200, created: 2
  it("POST /users/import with valid CSV (2 rows) should create 2 users", async () => {
    const csvContent = `name,email,role,team,title,department
Alice Smith,alice@example.com,EMPLOYEE,Engineering,Engineer,Operations
Bob Jones,bob@example.com,MANAGER,Sales,Sales Manager,Commercial`;

    const res = await request(app)
      .post("/api/users/import")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .attach("file", Buffer.from(csvContent), "users.csv");

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(0);
    expect(res.body.errors).toEqual([]);

    // Verify both users exist
    const alice = await prisma.user.findUnique({ where: { email: "alice@example.com" } });
    const bob = await prisma.user.findUnique({ where: { email: "bob@example.com" } });
    expect(alice).toBeDefined();
    expect(bob).toBeDefined();
  });

  // Test 2: CSV with duplicate email (one already exists) → skipped: 1
  it("POST /users/import with CSV containing duplicate email should skip", async () => {
    // Pre-create a user
    await prisma.user.create({
      data: {
        id: "existing-user",
        name: "Existing User",
        email: "existing@example.com",
        passwordHash: "hashed",
        role: "EMPLOYEE",
      },
    });

    const csvContent = `name,email,role,team,title,department
New User,newuser@example.com,EMPLOYEE,Engineering,Engineer,Operations
Duplicate,existing@example.com,MANAGER,Sales,Sales Manager,Commercial`;

    const res = await request(app)
      .post("/api/users/import")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .attach("file", Buffer.from(csvContent), "users.csv");

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.skipped).toBe(1);
    expect(res.body.errors.length).toBe(0);
  });

  // Test 3: No file uploaded → 400
  it("POST /users/import with no file should return 400", async () => {
    const res = await request(app)
      .post("/api/users/import")
      .set("Authorization", `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("file");
  });

  // Test 4: CSV missing required `name` column → errors array contains row error
  it("POST /users/import with CSV missing name column should report errors", async () => {
    const csvContent = `email,role,team
alice@example.com,EMPLOYEE,Engineering
bob@example.com,MANAGER,Sales`;

    const res = await request(app)
      .post("/api/users/import")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .attach("file", Buffer.from(csvContent), "users.csv");

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(0);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.errors[0]).toHaveProperty("row");
    expect(res.body.errors[0]).toHaveProperty("message");
  });

  // Test 5: Unauthenticated → 401
  it("POST /users/import without auth should return 401", async () => {
    const csvContent = `name,email,role,team,title,department
Alice Smith,alice@example.com,EMPLOYEE,Engineering,Engineer,Operations`;

    const res = await request(app)
      .post("/api/users/import")
      .attach("file", Buffer.from(csvContent), "users.csv");

    expect(res.status).toBe(401);
  });

  // Test 6: Non-HR_ADMIN → 403
  it("POST /users/import by non-HR_ADMIN should return 403", async () => {
    const csvContent = `name,email,role,team,title,department
Alice Smith,alice@example.com,EMPLOYEE,Engineering,Engineer,Operations`;

    const res = await request(app)
      .post("/api/users/import")
      .set("Authorization", `Bearer ${managerToken}`)
      .attach("file", Buffer.from(csvContent), "users.csv");

    expect(res.status).toBe(403);
  });

  // Test 7: CSV with invalid email format → errors reported
  it("POST /users/import with invalid email should report errors", async () => {
    const csvContent = `name,email,role,team
Alice Smith,not-an-email,EMPLOYEE,Engineering`;

    const res = await request(app)
      .post("/api/users/import")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .attach("file", Buffer.from(csvContent), "users.csv");

    expect(res.status).toBe(200);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  // Test 8: Mix of valid and invalid rows
  it("POST /users/import with mixed valid/invalid rows should create valid, skip invalid", async () => {
    const csvContent = `name,email,role,team
Alice Smith,alice@example.com,EMPLOYEE,Engineering
Bob Jones,invalid-email,MANAGER,Sales
Carol White,carol@example.com,EMPLOYEE,HR`;

    const res = await request(app)
      .post("/api/users/import")
      .set("Authorization", `Bearer ${hrAdminToken}`)
      .attach("file", Buffer.from(csvContent), "users.csv");

    expect(res.status).toBe(200);
    expect(res.body.created).toBeGreaterThan(0);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });
});
