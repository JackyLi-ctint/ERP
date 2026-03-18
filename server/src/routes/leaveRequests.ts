import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { LeaveStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import {
  submitLeaveRequest,
  cancelLeaveRequest,
  getLeaveRequestsForUser,
} from "../services/leaveRequest.service";

// Router for POST/DELETE – mounted at /api/leave-requests
const leaveRequestsRouter = Router();

// Router for GET – mounted at /api/me/leave-requests
const meLeaveRequestsRouter = Router();

// Error handling middleware for route handlers
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      if (error.message.match(/overlap/i)) {
        res.status(409).json({ message: error.message });
      } else if (
        error.message.match(/Insufficient balance|working day|halfDay|start date|end date|Balance not found/i)
      ) {
        res.status(422).json({ message: error.message });
      } else if (error.message.match(/Forbidden/)) {
        res.status(403).json({ message: error.message });
      } else if (
        error.message.match(/not found|Not found/)
      ) {
        res.status(404).json({ message: error.message });
      } else if (error.message.match(/Cannot cancel/)) {
        res.status(422).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    });
  };

// Zod validation schemas
const submitLeaveRequestSchema = z.object({
  leaveTypeId: z.number().int().positive("leaveTypeId must be a positive integer"),
  startDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "startDate must be in YYYY-MM-DD format"
    ),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be in YYYY-MM-DD format"),
  halfDay: z.boolean().optional().default(false),
  period: z.enum(["AM", "PM"]).optional(),
  reason: z.string().optional(),
  attachmentUrl: z.string().url("attachmentUrl must be a valid URL").optional(),
});

/**
 * POST /api/leave-requests
 * Submit a new leave request
 * Accessible by: all authenticated roles
 * Returns: 201 with { leaveRequest }
 */
leaveRequestsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = submitLeaveRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Validation error",
        errors: validation.error.flatten(),
      });
      return;
    }

    const data = validation.data;
    const userId = req.user?.id as string;

    // Parse dates as UTC
    const startDate = new Date(data.startDate + "T00:00:00Z");
    const endDate = new Date(data.endDate + "T00:00:00Z");

    // Verify leave type exists
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: data.leaveTypeId },
    });

    if (!leaveType) {
      res.status(404).json({ message: "Leave type not found" });
      return;
    }

    // Submit leave request
    const leaveRequest = await submitLeaveRequest(
      {
        employeeId: userId,
        leaveTypeId: data.leaveTypeId,
        startDate,
        endDate,
        halfDay: data.halfDay,
        period: data.period,
        reason: data.reason,
        attachmentUrl: data.attachmentUrl,
      },
      prisma
    );

    res.status(201).json({ leaveRequest });
  })
);

/**
 * GET /api/me/leave-requests
 * Get current user's leave requests
 * Query params: status?, year?
 * Accessible by: all authenticated roles
 * Returns: { leaveRequests: [...] }
 */
const VALID_STATUSES = new Set<LeaveStatus>(Object.values(LeaveStatus));

meLeaveRequestsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id as string;
    const statusParam = req.query.status as string | undefined;
    const yearParam = req.query.year ? parseInt(req.query.year as string) : undefined;

    if (yearParam !== undefined && isNaN(yearParam)) {
      res.status(400).json({ error: "Invalid year value" });
      return;
    }

    const year = yearParam;

    if (statusParam !== undefined && !VALID_STATUSES.has(statusParam as LeaveStatus)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    const status = statusParam as string | undefined;
    const leaveRequests = await getLeaveRequestsForUser(userId, { status, year }, prisma);

    res.json({ leaveRequests });
  })
);

/**
 * DELETE /api/leave-requests/:id
 * Cancel a leave request (owner only)
 * Accessible by: owner of the request
 * Returns: 200 with { leaveRequest }
 */
leaveRequestsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = parseInt(req.params.id as string);
    const userId = req.user?.id as string;

    if (isNaN(requestId)) {
      res.status(400).json({ message: "Invalid request ID" });
      return;
    }

    const updatedRequest = await cancelLeaveRequest(requestId, userId, prisma);

    res.json({ leaveRequest: updatedRequest });
  })
);

export { leaveRequestsRouter, meLeaveRequestsRouter };
