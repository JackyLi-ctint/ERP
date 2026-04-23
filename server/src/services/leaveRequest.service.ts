import { PrismaClient, LeaveRequest, Role } from "@prisma/client";
import { countWorkingDays, getHolidaySet } from "./workingDays.service";
import { sendNewLeaveRequestEmail } from "./email.service";

/**
 * Submit a new leave request
 * Validates:
 * - startDate <= endDate
 * - startDate >= today (UTC)
 * - halfDay only on single-day ranges
 * - totalDays > 0 (not all weekend/holidays)
 * - leaveBalance exists for employee+type+year
 * - sufficient balance (totalDays + pendingDays + usedDays <= totalDays)
 * - no overlapping PENDING or APPROVED requests
 * Increments balance.pendingDays atomically
 */
export async function submitLeaveRequest(
  data: {
    employeeId: string;
    leaveTypeId: number;
    startDate: Date;
    endDate: Date;
    halfDay?: boolean;
    period?: "AM" | "PM";
    reason?: string;
    attachmentUrl?: string;
  },
  prisma: PrismaClient
): Promise<LeaveRequest> {
  // Validate date ordering
  if (data.startDate > data.endDate) {
    throw new Error("start date must not be after end date");
  }

  // Get today's date in UTC (start of day)
  const today = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  ));

  // Normalize start and end dates to UTC midnight
  const startDateUtc = new Date(
    Date.UTC(
      data.startDate.getUTCFullYear(),
      data.startDate.getUTCMonth(),
      data.startDate.getUTCDate()
    )
  );
  const endDateUtc = new Date(
    Date.UTC(
      data.endDate.getUTCFullYear(),
      data.endDate.getUTCMonth(),
      data.endDate.getUTCDate()
    )
  );

  // Validate start date is not in the past
  if (startDateUtc < today) {
    throw new Error("start date cannot be in the past");
  }

  // Validate halfDay is only used on single-day ranges
  if (data.halfDay && startDateUtc.getTime() !== endDateUtc.getTime()) {
    throw new Error("halfDay can only be used for single-day leave");
  }

  // Ensure period is provided if halfDay is true
  if (data.halfDay && !data.period) {
    throw new Error("period (AM or PM) is required when halfDay is true");
  }

  // Get year from start date
  const year = startDateUtc.getUTCFullYear();

  // Fetch holiday set for the year(s) involved
  // Get all holidays for start year and end year (in case of cross-year leave)
  const holidaysStart = await getHolidaySet(startDateUtc.getUTCFullYear(), prisma);
  const holidaysEnd = endDateUtc.getUTCFullYear() !== startDateUtc.getUTCFullYear()
    ? await getHolidaySet(endDateUtc.getUTCFullYear(), prisma)
    : new Set<string>();

  const allHolidays = new Set([...holidaysStart, ...holidaysEnd]);

  // Calculate working days
  const totalDays = countWorkingDays(
    startDateUtc,
    endDateUtc,
    allHolidays,
    data.halfDay,
    data.period
  );

  // Validate there are working days in the range
  if (totalDays === 0) {
    throw new Error("No working days in the specified date range");
  }

  // Check if leaveBalance exists for employee+type+year
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        year,
      },
    },
  });

  if (!balance) {
    throw new Error(
      "Leave balance not found for this leave type and year. Please contact HR."
    );
  }

  // Check sufficient balance
  const availableDays = balance.totalDays - balance.usedDays - balance.pendingDays;
  if (totalDays > availableDays) {
    throw new Error(
      `Insufficient balance. Available: ${availableDays} days, Requested: ${totalDays} days`
    );
  }

  // Check for overlapping PENDING or APPROVED requests
  const overlappingRequests = await prisma.leaveRequest.findMany({
    where: {
      employeeId: data.employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDateUtc },
      endDate: { gte: startDateUtc },
    },
  });

  if (overlappingRequests.length > 0) {
    throw new Error(
      "You have an overlapping leave request that is already pending or approved"
    );
  }

  // Create LeaveRequest and update balance atomically
  const result = await prisma.$transaction(async (tx) => {
    const leaveRequest = await tx.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: startDateUtc,
        endDate: endDateUtc,
        halfDay: data.halfDay || false,
        period: data.period,
        totalDays,
        reason: data.reason,
        attachmentUrl: data.attachmentUrl,
        status: "PENDING",
      },
      include: {
        leaveType: true,
      },
    });

    // Increment pendingDays in balance
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: data.employeeId,
          leaveTypeId: data.leaveTypeId,
          year,
        },
      },
      data: {
        pendingDays: {
          increment: totalDays,
        },
      },
    });

    return leaveRequest;
  });

  // Fetch employee and send notifications to managers/HR (outside transaction)
  try {
    const employee = await prisma.user.findUnique({
      where: { id: data.employeeId },
    });

    if (employee) {
      // Query managers in the same team
      const managers = await prisma.user.findMany({
        where: {
          role: Role.MANAGER,
          team: employee.team,
        },
        select: { email: true },
      });

      // Query all HR_ADMIN users
      const hrAdmins = await prisma.user.findMany({
        where: { role: Role.HR_ADMIN },
        select: { email: true },
      });

      // Combine manager and HR_ADMIN emails
      const managerEmails = [...managers, ...hrAdmins].map((u) => u.email);

      if (managerEmails.length > 0) {
        const startDate = result.startDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        const endDate = result.endDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

        await sendNewLeaveRequestEmail(
          managerEmails,
          employee.name,
          result.leaveType.name,
          startDate,
          endDate
        );
      }
    }
  } catch (error) {
    // Log but don't throw - email failure shouldn't break the request submission
    console.error("[Leave Request] Failed to send new leave request notification:", error);
  }

  return result;
}

/**
 * Cancel a leave request
 * Only owner can cancel
 * PENDING → CANCELLED (existing behavior)
 * APPROVED → CANCEL_REQUESTED (new behavior for approval workflow)
 * Decrements balance.pendingDays for PENDING, no balance change for APPROVED
 */
export async function cancelLeaveRequest(
  requestId: number,
  userId: string,
  prisma: PrismaClient,
  cancellationReason?: string
): Promise<LeaveRequest> {
  // Find the request
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: {
      leaveType: true,
    },
  });

  if (!request) {
    throw new Error("Leave request not found");
  }

  // Verify ownership
  if (request.employeeId !== userId) {
    throw new Error("Forbidden: You can only cancel your own requests");
  }

  // Handle PENDING → CANCELLED (existing behavior)
  if (request.status === "PENDING") {
    // Get year from start date
    const year = request.startDate.getUTCFullYear();

    // Update status and decrement pendingDays atomically
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: "CANCELLED",
          cancellationReason: cancellationReason || null,
        },
        include: {
          leaveType: true,
        },
      });

      // Decrement pendingDays in balance
      await tx.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        data: {
          pendingDays: {
            decrement: request.totalDays,
          },
        },
      });

      return updated;
    });

    return result;
  }

  // Handle APPROVED → CANCEL_REQUESTED (new behavior, no balance change at this stage)
  if (request.status === "APPROVED") {
    return prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCEL_REQUESTED",
        cancellationReason: cancellationReason || null,
      },
      include: { leaveType: true },
    });
  }

  // Any other status is not cancellable
  throw new Error(
    `Cannot cancel: request is not in a cancellable state`
  );
}

/**
 * Get leave requests for a user with optional filters
 */
export async function getLeaveRequestsForUser(
  userId: string,
  filters?: {
    status?: string;
    year?: number;
  },
  prisma?: PrismaClient
): Promise<LeaveRequest[]> {
  if (!prisma) {
    throw new Error("Prisma client is required");
  }

  const where: any = {
    employeeId: userId,
  };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.year) {
    // Filter by year using date range
    const startOfYear = new Date(Date.UTC(filters.year, 0, 1));
    const endOfYear = new Date(Date.UTC(filters.year + 1, 0, 0));
    where.OR = [
      {
        startDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      {
        endDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    ];
  }

  return prisma.leaveRequest.findMany({
    where,
    include: {
      leaveType: {
        select: {
          id: true,
          name: true,
          defaultDays: true,
          isCarryForward: true,
          requiresDocument: true,
        },
      },
    },
    orderBy: {
      startDate: "desc",
    },
  });
}
