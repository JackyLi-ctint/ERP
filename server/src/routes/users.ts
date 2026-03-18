import { Router, Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../lib/asyncHandler";

const usersRouter = Router();

// Zod validation schemas
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

const roleSchema = z.object({
  role: z.nativeEnum(Role),
});

/**
 * PATCH /api/users/:id
 * Update user's role
 * Accessible by: HR_ADMIN only
 * Returns: 200 with { user }
 */
usersRouter.patch(
  "/:id",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const validation = roleSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: validation.error.message });
      return;
    }

    const { role } = validation.data;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
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

export { usersRouter };
