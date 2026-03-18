import { Router, Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  approveCancellation,
  rejectCancellation,
} from "../services/leaveApproval.service";
import { asyncHandler } from "../lib/asyncHandler";

const leaveApprovalRouter = Router();

// Zod validation schemas
const commentSchema = z.object({
  comment: z.string().max(1000).optional(),
});

/**
 * POST /api/leave-requests/:id/approve
 * Approve a leave request
 * Accessible by: MANAGER, HR_ADMIN
 * Returns: 200 with { leaveRequest }
 */
leaveApprovalRouter.post(
  "/:id/approve",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsedId = parseInt(id, 10);

    if (isNaN(parsedId)) {
      res.status(400).json({ message: "Invalid request ID" });
      return;
    }

    const validation = commentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }

    const comment = validation.data.comment;
    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    const approved = await approveLeaveRequest(
      parsedId,
      actorId,
      actorRole,
      comment,
      prisma
    );

    res.status(200).json({ leaveRequest: approved });
  })
);

/**
 * POST /api/leave-requests/:id/reject
 * Reject a leave request
 * Accessible by: MANAGER, HR_ADMIN
 * Returns: 200 with { leaveRequest }
 */
leaveApprovalRouter.post(
  "/:id/reject",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsedId = parseInt(id, 10);

    if (isNaN(parsedId)) {
      res.status(400).json({ message: "Invalid request ID" });
      return;
    }

    const validation = commentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }

    const comment = validation.data.comment;

    if (!comment || comment.trim() === "") {
      res.status(400).json({ message: "Comment is required" });
      return;
    }

    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    const rejected = await rejectLeaveRequest(
      parsedId,
      actorId,
      actorRole,
      comment,
      prisma
    );

    res.status(200).json({ leaveRequest: rejected });
  })
);

/**
 * POST /api/leave-requests/:id/approve-cancellation
 * Approve cancellation of a leave request
 * Accessible by: MANAGER, HR_ADMIN
 * Returns: 200 with { leaveRequest }
 */
leaveApprovalRouter.post(
  "/:id/approve-cancellation",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsedId = parseInt(id, 10);

    if (isNaN(parsedId)) {
      res.status(400).json({ message: "Invalid request ID" });
      return;
    }

    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    const approved = await approveCancellation(
      parsedId,
      actorId,
      actorRole,
      prisma
    );

    res.status(200).json({ leaveRequest: approved });
  })
);

/**
 * POST /api/leave-requests/:id/reject-cancellation
 * Reject cancellation of a leave request
 * Accessible by: MANAGER, HR_ADMIN
 * Returns: 200 with { leaveRequest }
 */
leaveApprovalRouter.post(
  "/:id/reject-cancellation",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const parsedId = parseInt(id, 10);

    if (isNaN(parsedId)) {
      res.status(400).json({ message: "Invalid request ID" });
      return;
    }

    const validation = commentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }

    const comment = validation.data.comment;

    if (!comment || comment.trim() === "") {
      res.status(400).json({ message: "Comment is required" });
      return;
    }

    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    const rejected = await rejectCancellation(
      parsedId,
      actorId,
      actorRole,
      comment,
      prisma
    );

    res.status(200).json({ leaveRequest: rejected });
  })
);

export { leaveApprovalRouter };
