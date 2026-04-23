import { Router, Request, Response } from "express";
import { Prisma, LeaveStatus } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../lib/asyncHandler";
import config from "../config";

export const adminLeaveRequestsRouter = Router();

const VALID_STATUSES = new Set<string>(Object.values(LeaveStatus));

/**
 * GET /api/admin/leave-requests
 * HR_ADMIN only — returns paginated list of all leave requests with optional filters.
 */
adminLeaveRequestsRouter.get(
  "/",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const employeeId = req.query.employeeId as string | undefined;
    const status = req.query.status as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const pageRaw = req.query.page as string | undefined;
    const pageSizeRaw = req.query.pageSize as string | undefined;

    // Validate status
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      res.status(400).json({ message: `Invalid status value: ${status}` });
      return;
    }

    const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10)) : 1;
    let pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : config.pagination.defaultSize;
    if (pageSize > config.pagination.maxSize) pageSize = config.pagination.maxSize;
    if (pageSize < 1) pageSize = 1;

    const where: Prisma.LeaveRequestWhereInput = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }
    if (status) {
      where.status = status as LeaveStatus;
    }
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (from !== undefined) {
      if (!DATE_RE.test(from)) {
        res.status(400).json({ message: "from must be a date in YYYY-MM-DD format" });
        return;
      }
      where.startDate = { gte: new Date(from + "T00:00:00Z") };
    }
    if (to !== undefined) {
      if (!DATE_RE.test(to)) {
        res.status(400).json({ message: "to must be a date in YYYY-MM-DD format" });
        return;
      }
      where.endDate = { lte: new Date(to + "T23:59:59Z") };
    }

    const [leaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: { select: { name: true } },
          leaveType: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    res.status(200).json({
      leaveRequests: leaveRequests.map((lr) => ({
        id: lr.id,
        employeeId: lr.employeeId,
        employeeName: lr.employee.name,
        leaveTypeName: lr.leaveType.name,
        startDate: lr.startDate.toISOString(),
        endDate: lr.endDate.toISOString(),
        totalDays: lr.totalDays,
        status: lr.status,
        reason: lr.reason ?? undefined,
        approvedById: lr.approvedById ?? undefined,
        approverComment: lr.approverComment ?? undefined,
        createdAt: lr.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    });
  })
);
