import { Router, Request, Response } from "express";
import { Prisma, LeaveStatus, Role } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../lib/asyncHandler";

export const leaveCalendarRouter = Router();

/**
 * GET /api/leave-calendar?year=YYYY&month=MM
 * Returns leave requests visible to the authenticated user for the given month.
 * - EMPLOYEE: own requests only
 * - MANAGER: own + same-team requests
 * - HR_ADMIN: all requests
 * Excludes DRAFT and CANCELLED statuses.
 */
leaveCalendarRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const yearParam = req.query.year as string | undefined;
    const monthParam = req.query.month as string | undefined;

    if (!yearParam) {
      res.status(400).json({ message: "year is required" });
      return;
    }
    if (!monthParam) {
      res.status(400).json({ message: "month is required" });
      return;
    }

    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);

    if (isNaN(year) || isNaN(month)) {
      res.status(400).json({ message: "year and month must be integers" });
      return;
    }

    if (month < 1 || month > 12) {
      res.status(400).json({ message: "month must be between 1 and 12" });
      return;
    }

    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0));

    const actorId = req.user!.id;
    const actorRole = req.user!.role;

    const excludedStatuses: LeaveStatus[] = ["DRAFT", "CANCELLED"];

    const baseWhere: Prisma.LeaveRequestWhereInput = {
      status: { notIn: excludedStatuses },
      startDate: { lte: lastDayOfMonth },
      endDate: { gte: firstDayOfMonth },
    };

    let whereClause: Prisma.LeaveRequestWhereInput = baseWhere;

    if (actorRole === Role.EMPLOYEE) {
      whereClause = { ...baseWhere, employeeId: actorId };
    } else if (actorRole === Role.MANAGER) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { team: true },
      });

      if (actor?.team) {
        whereClause = {
          ...baseWhere,
          OR: [
            { employeeId: actorId },
            { employee: { team: actor.team } },
          ],
        };
      } else {
        whereClause = { ...baseWhere, employeeId: actorId };
      }
    }
    // HR_ADMIN: no additional filter

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: { select: { name: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { startDate: "asc" },
    });

    const result = leaveRequests.map((lr) => ({
      id: lr.id,
      employeeId: lr.employeeId,
      employeeName: lr.employee.name,
      leaveTypeName: lr.leaveType.name,
      startDate: lr.startDate.toISOString(),
      endDate: lr.endDate.toISOString(),
      totalDays: lr.totalDays,
      status: lr.status,
    }));

    res.json({ leaveRequests: result });
  })
);
