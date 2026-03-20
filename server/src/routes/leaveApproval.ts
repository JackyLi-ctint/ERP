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
  bulkApproveLeaveRequests,
  bulkRejectLeaveRequests,
} from "../services/leaveApproval.service";
import { asyncHandler } from "../lib/asyncHandler";

const leaveApprovalRouter = Router();

// Zod validation schemas
const commentSchema = z.object({
  comment: z.string().max(1000).optional(),
});

const bulkApproveSchema = z.object({
  ids: z.array(z.number().positive()).min(1, "ids must be a non-empty array"),
  comment: z.string().max(1000).optional(),
});

const bulkRejectSchema = z.object({
  ids: z.array(z.number().positive()).min(1, "ids must be a non-empty array"),
  comment: z.string().min(1, "comment is required").max(1000),
});

/**
 * POST /api/leave-requests/bulk-approve
 * Bulk approve multiple leave requests
 * Accessible by: MANAGER, HR_ADMIN
 * Returns: 200 with { leaveRequests: [...] }
 */
leaveApprovalRouter.post(
  "/bulk-approve",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = bulkApproveSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }

    const { ids, comment } = validation.data;
    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    try {
      const approved = await bulkApproveLeaveRequests(
        ids,
        actorId,
        actorRole,
        comment,
        prisma
      );

      res.status(200).json({ leaveRequests: approved });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Forbidden")) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes("No request IDs provided")) {
        res.status(400).json({ message: error.message });
      } else {
        throw error;
      }
    }
  })
);

/**
 * POST /api/leave-requests/bulk-reject
 * Bulk reject multiple leave requests
 * Accessible by: MANAGER, HR_ADMIN
 * Returns: 200 with { leaveRequests: [...] }
 */
leaveApprovalRouter.post(
  "/bulk-reject",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const validation = bulkRejectSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ message: "Validation error" });
      return;
    }

    const { ids, comment } = validation.data;
    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    try {
      const rejected = await bulkRejectLeaveRequests(
        ids,
        comment,
        actorId,
        actorRole,
        prisma
      );

      res.status(200).json({ leaveRequests: rejected });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Forbidden")) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && (error.message.includes("No request IDs provided") || error.message.includes("Comment is required"))) {
        res.status(400).json({ message: error.message });
      } else {
        throw error;
      }
    }
  })
);

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
