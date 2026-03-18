import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// Error handling middleware for route handlers
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      if (error.message.includes("already exists")) {
        res.status(409).json({ message: error.message });
      } else if (error.message.includes("Semantic validation")) {
        res.status(422).json({ message: error.message });
      } else if (error.message.includes("Validation error")) {
        res.status(400).json({ message: error.message });
      } else if (error.message.includes("Forbidden")) {
        res.status(403).json({ message: error.message });
      } else if (error.message.includes("Not found")) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    });
  };

// Zod validation schemas
const createLeaveTypeSchema = z.object({
  name: z.string().min(1, "name is required"),
  defaultDays: z.number().positive("defaultDays must be greater than 0"),
  isCarryForward: z.boolean().optional().default(false),
  requiresDocument: z.boolean().optional().default(false),
});

const updateLeaveTypeSchema = z.object({
  name: z.string().min(1).optional(),
  defaultDays: z.number().positive().optional(),
  isCarryForward: z.boolean().optional(),
  requiresDocument: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;

/**
 * GET /api/leave-types
 * Returns active leave types for regular users; all types for HR_ADMIN
 * Accessible by: all authenticated roles
 */
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const isAdmin = (req as any).user?.role === "HR_ADMIN";
    const leaveTypes = await prisma.leaveType.findMany({
      where: isAdmin ? {} : { isActive: true },
      select: {
        id: true,
        name: true,
        defaultDays: true,
        isCarryForward: true,
        requiresDocument: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    res.json({ leaveTypes });
  })
);

/**
 * GET /api/leave-types/:id
 * Returns a specific leave type by ID
 * Accessible by: all authenticated roles
 */
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const leaveTypeId = parseInt(req.params.id as string);

    if (isNaN(leaveTypeId)) {
      res.status(400).json({ message: "Invalid leave type ID" });
      return;
    }

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: {
        id: true,
        name: true,
        defaultDays: true,
        isCarryForward: true,
        requiresDocument: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!leaveType) {
      res.status(404).json({ message: "Leave type not found" });
      return;
    }

    res.json({ leaveType });
  })
);

/**
 * POST /api/leave-types
 * Creates a new leave type
 * Accessible by: HR_ADMIN only
 */
router.post(
  "/",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const validationResult = createLeaveTypeSchema.safeParse(req.body);
    if (!validationResult.success) {
      const error = validationResult.error.issues[0];
      if (error.code === "too_small") {
        // Semantic validation error - return 422
        throw new Error(`Semantic validation error: ${error.path.join(".")}: ${error.message}`);
      } else {
        // Structural validation error - return 400
        throw new Error(`Validation error: ${error.path.join(".")}: ${error.message}`);
      }
    }

    const data = validationResult.data as CreateLeaveTypeInput;

    // Check for duplicate name
    const existing = await prisma.leaveType.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new Error(`Leave type '${data.name}' already exists`);
    }

    // Create the leave type
    const leaveType = await prisma.leaveType.create({
      data: {
        name: data.name,
        defaultDays: data.defaultDays,
        isCarryForward: data.isCarryForward,
        requiresDocument: data.requiresDocument,
        createdById: req.user!.id,
      },
      select: {
        id: true,
        name: true,
        defaultDays: true,
        isCarryForward: true,
        requiresDocument: true,
        isActive: true,
        createdById: true,
        createdAt: true,
      },
    });

    res.status(201).json({ leaveType });
  })
);

/**
 * PATCH /api/leave-types/:id
 * Updates an existing leave type
 * Accessible by: HR_ADMIN only
 */
router.patch(
  "/:id",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const leaveTypeId = parseInt(req.params.id as string);

    if (isNaN(leaveTypeId)) {
      res.status(400).json({ message: "Invalid leave type ID" });
      return;
    }

    // Validate request body
    const validationResult = updateLeaveTypeSchema.safeParse(req.body);
    if (!validationResult.success) {
      const error = validationResult.error.issues[0];
      if (error.code === "too_small") {
        // Semantic validation error - return 422
        throw new Error(`Semantic validation error: ${error.path.join(".")}: ${error.message}`);
      } else {
        // Structural validation error - return 400
        throw new Error(`Validation error: ${error.path.join(".")}: ${error.message}`);
      }
    }

    const data = validationResult.data as UpdateLeaveTypeInput;

    // Check if leave type exists
    const existing = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });

    if (!existing) {
      res.status(404).json({ message: "Leave type not found" });
      return;
    }

    // If name is being updated, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.leaveType.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new Error(`Leave type '${data.name}' already exists`);
      }
    }

    // Update the leave type
    const updated = await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data,
      select: {
        id: true,
        name: true,
        defaultDays: true,
        isCarryForward: true,
        requiresDocument: true,
        isActive: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ leaveType: updated });
  })
);

/**
 * DELETE /api/leave-types/:id
 * Deactivates a leave type (soft delete - sets isActive to false)
 * Accessible by: HR_ADMIN only
 */
router.delete(
  "/:id",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const leaveTypeId = parseInt(req.params.id as string);

    if (isNaN(leaveTypeId)) {
      res.status(400).json({ message: "Invalid leave type ID" });
      return;
    }

    // Check if leave type exists
    const existing = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });

    if (!existing) {
      res.status(404).json({ message: "Leave type not found" });
      return;
    }

    // Deactivate the leave type (soft delete)
    const updated = await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        defaultDays: true,
        isCarryForward: true,
        requiresDocument: true,
        isActive: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ leaveType: updated });
  })
);

export default router;
