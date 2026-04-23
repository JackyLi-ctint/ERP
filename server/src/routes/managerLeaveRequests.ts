import { Router, Request, Response } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { getSubordinatePendingRequests } from "../services/leaveApproval.service";
import { asyncHandler } from "../lib/asyncHandler";
import config from "../config";

const managerLeaveRequestsRouter = Router();

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).default(config.pagination.defaultSize),
});

/**
 * GET /api/manager/leave-requests
 * Get all pending/cancel-requested leave requests that the actor can approve
 * MANAGER sees only same-team requests
 * HR_ADMIN sees all requests
 * Accessible by: MANAGER, HR_ADMIN
 * Query params: page (default 1), pageSize (default from config, max from config)
 * Returns: 200 with { leaveRequests, page, pageSize }
 */
managerLeaveRequestsRouter.get(
  "/",
  requireAuth,
  requireRole("MANAGER", "HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id as string;
    const actorRole = req.user?.role as Role;

    const parsed = paginationQuerySchema.safeParse(req.query);
    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success
      ? Math.min(parsed.data.pageSize, config.pagination.maxSize)
      : config.pagination.defaultSize;

    const skip = (page - 1) * pageSize;

    const leaveRequests = await getSubordinatePendingRequests(actorId, actorRole, prisma, {
      skip,
      take: pageSize,
    });

    res.status(200).json({ leaveRequests, page, pageSize });
  })
);

export { managerLeaveRequestsRouter };
