import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../lib/asyncHandler";
import { upload } from "../middleware/upload";

const usersRouter = Router();

// Zod validation schemas
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  team: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(72).optional(),
  role: z.nativeEnum(Role).optional(),
  team: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
});

const identitySchema = z
  .object({
    team: z.string().max(100).optional(),
    title: z.string().max(100).optional(),
  })
  .strict()
  .refine((data) => data.team !== undefined || data.title !== undefined, {
    message: "At least one of team or title must be provided",
  });

/**
 * GET /api/users
 * Get all users
 * Accessible by: HR_ADMIN only
 * Returns: 200 with { users }
 */
usersRouter.get(
  "/",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        team: true,
        title: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json({ users });
  })
);

/**
 * POST /api/users
 * Create a new user
 * Accessible by: HR_ADMIN only
 * Returns: 201 with { user }
 */
usersRouter.post(
  "/",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: validation.error.issues[0]?.message ?? "Validation error" });
      return;
    }

    const { name, email, password, role, team, title, department } = validation.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "A user with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, team, title, department },
      select: { id: true, name: true, email: true, role: true, team: true, title: true, department: true },
    });

    res.status(201).json({ user });
  })
);

/**
 * PATCH /api/users/:id/identity
 * Update user's team and/or title
 * Accessible by: HR_ADMIN only
 * Returns: 200 with { user }
 */
usersRouter.patch(
  "/:id/identity",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const validation = identitySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: validation.error.message });
      return;
    }

    const { team, title } = validation.data;

    // Verify user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Update user identity
    const updateData: any = {};
    if (team !== undefined) {
      updateData.team = team;
    }
    if (title !== undefined) {
      updateData.title = title;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        team: true,
        title: true,
      },
    });

    res.status(200).json({ user: updated });
  })
);

/**
 * PATCH /api/users/:id
 * Update any combination of user fields (name, email, password, role, team, title, department)
 * Accessible by: HR_ADMIN only
 * Returns: 200 with { user }
 */
usersRouter.patch(
  "/:id",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: validation.error.issues[0]?.message ?? "Validation error" });
      return;
    }

    const { name, email, password, role, team, title, department } = validation.data;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check email uniqueness if changing
    if (email && email !== existingUser.email) {
      const conflict = await prisma.user.findUnique({ where: { email } });
      if (conflict) {
        res.status(409).json({ message: "A user with this email already exists" });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
    if (role) updateData.role = role;
    if (team !== undefined) updateData.team = team || null;
    if (title !== undefined) updateData.title = title || null;
    if (department !== undefined) updateData.department = department || null;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, team: true, title: true, department: true },
    });

    res.status(200).json({ user: updated });
  })
);

/**
 * POST /api/users/import
 * Bulk import users from CSV file
 * Accessible by: HR_ADMIN only
 * CSV columns: name, email, role, team, title, department
 * Returns: 200 with { created, skipped, errors }
 */
usersRouter.post(
  "/import",
  requireAuth,
  requireRole("HR_ADMIN"),
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({ message: "No CSV file uploaded" });
      return;
    }

    // Parse CSV from buffer
    let records: Record<string, string>[];
    try {
      records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
      }) as Record<string, string>[];
    } catch (error) {
      res.status(400).json({ message: "Failed to parse CSV file" });
      return;
    }

    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    // Schema for validating each CSV row (no password — auto-generated on import)
    const importSchema = z.object({
      name: z.string().min(1).max(100),
      email: z.string().email().max(255),
      role: z.nativeEnum(Role).default(Role.EMPLOYEE),
      team: z.string().max(100).optional(),
      title: z.string().max(100).optional(),
      department: z.string().max(100).optional(),
    });

    // Process each row
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +2 because row 1 is headers, arrays are 0-indexed

      try {
        const validation = importSchema.safeParse({
          name: row.name,
          email: row.email,
          role: row.role || "EMPLOYEE",
          team: row.team,
          title: row.title,
          department: row.department,
        });

        if (!validation.success) {
          errors.push({
            row: rowNumber,
            message: validation.error.issues[0]?.message ?? "Validation error",
          });
          continue;
        }

        const { name, email, role, team, title, department } = validation.data;

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          skipped++;
          continue;
        }

        // Generate random UUID as temp password
        const tempPassword = randomUUID();
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        // Create user
        await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,
            role,
            team,
            title,
            department,
          },
        });

        created++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push({
          row: rowNumber,
          message,
        });
      }
    }

    res.status(200).json({
      created,
      skipped,
      errors,
    });
  })
);

export { usersRouter };
