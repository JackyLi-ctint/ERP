import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../lib/asyncHandler";

export const leaveRequestDetailRouter = Router();

/**
 * GET /api/leave-requests/:id
 * Returns a single leave request detail.
 * - EMPLOYEE: own request only
 * - MANAGER: own or same-team requests
 * - HR_ADMIN: any request
 */
leaveRequestDetailRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(404).json({ message: "Leave request not found" });
      return;
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, team: true } },
        leaveType: { select: { name: true } },
      },
    });

    if (!leaveRequest) {
      res.status(404).json({ message: "Leave request not found" });
      return;
    }

    const actorId = req.user!.id;
    const actorRole = req.user!.role;

    if (actorRole === "EMPLOYEE") {
      if (leaveRequest.employeeId !== actorId) {
        throw new Error("Forbidden: You can only view your own leave requests");
      }
    } else if (actorRole === "MANAGER") {
      if (leaveRequest.employeeId !== actorId) {
        const actor = await prisma.user.findUnique({
          where: { id: actorId },
          select: { team: true },
        });
        if (!actor?.team || actor.team !== leaveRequest.employee.team) {
          throw new Error("Forbidden: You can only view leave requests from your team");
        }
      }
    }
    // HR_ADMIN: no restriction

    res.status(200).json({
      leaveRequest: {
        id: leaveRequest.id,
        employeeId: leaveRequest.employeeId,
        employeeName: leaveRequest.employee.name,
        leaveTypeName: leaveRequest.leaveType.name,
        startDate: leaveRequest.startDate.toISOString(),
        endDate: leaveRequest.endDate.toISOString(),
        halfDay: leaveRequest.halfDay,
        period: leaveRequest.period ?? undefined,
        totalDays: leaveRequest.totalDays,
        reason: leaveRequest.reason ?? undefined,
        status: leaveRequest.status,
        approvedById: leaveRequest.approvedById ?? undefined,
        approverComment: leaveRequest.approverComment ?? undefined,
        createdAt: leaveRequest.createdAt.toISOString(),
      },
    });
  })
);
