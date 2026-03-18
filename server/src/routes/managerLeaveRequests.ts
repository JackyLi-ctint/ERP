import { Router, Request, Response } from "express";
import { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { getSubordinatePendingRequests } from "../services/leaveApproval.service";
import { asyncHandler } from "../lib/asyncHandler";

const managerLeaveRequestsRouter = Router();

/**
 * GET /api/manager/leave-requests
 * Get all pending/cancel-requested leave requests that the actor can approve
 * MANAGER sees only same-team requests
 * HR_ADMIN sees all requests
 * Accessible by: MANAGER, HR_ADMIN
 * Returns: 200 with { leaveRequests }
 */
managerLeaveRequestsRouter.get(
  "/",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    const leaveRequests = await getSubordinatePendingRequests(
      actorId,
      actorRole,
      prisma
    );

    res.status(200).json({ leaveRequests });
  })
);

export { managerLeaveRequestsRouter };
