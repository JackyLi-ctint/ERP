import { PrismaClient, Prisma, Role, LeaveStatus, LeaveRequest, User } from "@prisma/client";
import { sendLeaveApprovedEmail, sendLeaveRejectedEmail } from "./email.service";
import { AppError } from "../lib/AppError";
import logger from "../lib/logger";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Synchronous self-approval guard — no DB call needed.
 */
function assertNotSelfApproval(request: LeaveRequest, actorId: string): void {
  if (request.employeeId === actorId) {
    throw new AppError("Cannot approve your own leave request", 422, "VALIDATION_ERROR");
  }
}

/**
 * Team-membership guard — must be called *inside* a $transaction to prevent
 * TOCTOU races if the actor's team is changed between auth check and write.
 */
async function assertTeamAuthorization(
  request: LeaveRequest & { employee: User },
  actorId: string,
  actorRole: Role,
  tx: TxClient
): Promise<void> {
  if (actorRole === Role.HR_ADMIN) {
    return; // HR_ADMIN bypasses team check
  }

  const actor = await tx.user.findUnique({ where: { id: actorId } });

  if (!actor || !actor.team || actor.team !== request.employee.team) {
    throw new AppError("Forbidden: not authorised to act on this request", 403, "FORBIDDEN");
  }
}

/**
 * Approve a leave request (PENDING → APPROVED)
 * Validates authorization, decrements pendingDays, increments usedDays
 * Records approver details and AuditLog
 */
export async function approveLeaveRequest(
  id: number,
  actorId: string,
  actorRole: Role,
  comment: string | undefined,
  prisma: PrismaClient
): Promise<LeaveRequest> {
  // Find request with employee and leaveType relations
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true, leaveType: true },
  });

  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  // Validate status
  if (request.status !== "PENDING") {
    throw new AppError("Cannot approve: request is not PENDING", 422, "VALIDATION_ERROR");
  }

  // Self-approval check (sync, outside tx)
  assertNotSelfApproval(request, actorId);

  // Get year from startDate
  const year = request.startDate.getUTCFullYear();

  // Execute in transaction (team auth check runs inside tx to prevent TOCTOU)
  const result = await prisma.$transaction(async (tx) => {
    await assertTeamAuthorization(request, actorId, actorRole, tx);

    // Update request
    const updated = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: "APPROVED" as LeaveStatus,
        approvedById: actorId,
        approverComment: comment,
      },
    });

    // Update balance
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      },
      data: {
        pendingDays: { decrement: request.totalDays },
        usedDays: { increment: request.totalDays },
      },
    });

    // Record audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: "APPROVE",
        entityType: "LeaveRequest",
        entityId: String(id),
        before: { status: "PENDING" },
        after: { status: "APPROVED" },
      },
    });

    return updated;
  });

  // Send approval email (outside transaction, failure doesn't break approval)
  try {
    const startDate = request.startDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const endDate = request.endDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    
    await sendLeaveApprovedEmail(
      request.employee.name,
      request.employee.email,
      request.leaveType.name,
      startDate,
      endDate
    );
  } catch (error) {
    // Log but don't throw - email failure shouldn't break the approval
    logger.warn({ err: error }, "[Leave Approval] Failed to send approval email");
  }

  return result;
}

/**
 * Reject a leave request (PENDING → REJECTED)
 * Validates authorization and comment, decrements pendingDays
 * Records approver details and AuditLog
 */
export async function rejectLeaveRequest(
  id: number,
  actorId: string,
  actorRole: Role,
  comment: string,
  prisma: PrismaClient
): Promise<LeaveRequest> {
  // Find request with employee and leaveType relations
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true, leaveType: true },
  });

  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  // Validate comment
  if (!comment || comment.trim() === "") {
    throw new AppError("Approver comment is required for rejection", 422, "VALIDATION_ERROR");
  }

  // Validate status
  if (request.status !== "PENDING") {
    throw new AppError("Cannot reject: request is not PENDING", 422, "VALIDATION_ERROR");
  }

  // Self-approval check (sync, outside tx)
  assertNotSelfApproval(request, actorId);

  // Get year from startDate
  const year = request.startDate.getUTCFullYear();

  // Execute in transaction (team auth check runs inside tx to prevent TOCTOU)
  const result = await prisma.$transaction(async (tx) => {
    await assertTeamAuthorization(request, actorId, actorRole, tx);

    // Update request
    const updated = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: "REJECTED" as LeaveStatus,
        approvedById: actorId,
        approverComment: comment,
      },
    });

    // Update balance - only decrement pendingDays
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      },
      data: {
        pendingDays: { decrement: request.totalDays },
      },
    });

    // Record audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: "REJECT",
        entityType: "LeaveRequest",
        entityId: String(id),
        before: { status: "PENDING" },
        after: { status: "REJECTED" },
      },
    });

    return updated;
  });

  // Send rejection email (outside transaction, failure doesn't break rejection)
  try {
    const startDate = request.startDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const endDate = request.endDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    
    await sendLeaveRejectedEmail(
      request.employee.name,
      request.employee.email,
      request.leaveType.name,
      startDate,
      endDate,
      comment
    );
  } catch (error) {
    // Log but don't throw - email failure shouldn't break the rejection
    logger.warn({ err: error }, "[Leave Approval] Failed to send rejection email");
  }

  return result;
}

/**
 * Approve cancellation of a leave request (CANCEL_REQUESTED → CANCELLED)
 * Validates authorization, decrements usedDays
 * Records AuditLog
 */
export async function approveCancellation(
  id: number,
  actorId: string,
  actorRole: Role,
  prisma: PrismaClient
): Promise<LeaveRequest> {
  // Find request with employee relation
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true },
  });

  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  // Validate status
  if (request.status !== "CANCEL_REQUESTED") {
    throw new AppError("Cannot approve: request is not CANCEL_REQUESTED", 422, "VALIDATION_ERROR");
  }

  // Self-approval check (sync, outside tx)
  assertNotSelfApproval(request, actorId);

  // Get year from startDate
  const year = request.startDate.getUTCFullYear();

  // Execute in transaction (team auth check runs inside tx to prevent TOCTOU)
  const result = await prisma.$transaction(async (tx) => {
    await assertTeamAuthorization(request, actorId, actorRole, tx);

    // Update request
    const updated = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: "CANCELLED" as LeaveStatus,
      },
    });

    // Update balance - decrement usedDays
    await tx.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: {
          userId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      },
      data: {
        usedDays: { decrement: request.totalDays },
      },
    });

    // Record audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: "APPROVE_CANCELLATION",
        entityType: "LeaveRequest",
        entityId: String(id),
        before: { status: "CANCEL_REQUESTED" },
        after: { status: "CANCELLED" },
      },
    });

    return updated;
  });

  return result;
}

/**
 * Reject cancellation of a leave request (CANCEL_REQUESTED → APPROVED)
 * Validates authorization and comment
 * No balance change
 * Records AuditLog
 */
export async function rejectCancellation(
  id: number,
  actorId: string,
  actorRole: Role,
  comment: string,
  prisma: PrismaClient
): Promise<LeaveRequest> {
  // Find request with employee relation
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true },
  });

  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  // Validate comment
  if (!comment || comment.trim() === "") {
    throw new AppError("Approver comment is required for rejection", 422, "VALIDATION_ERROR");
  }

  // Validate status
  if (request.status !== "CANCEL_REQUESTED") {
    throw new AppError("Cannot reject: request is not CANCEL_REQUESTED", 422, "VALIDATION_ERROR");
  }

  // Self-approval check (sync, outside tx)
  assertNotSelfApproval(request, actorId);

  // Execute in transaction (team auth check runs inside tx to prevent TOCTOU)
  const result = await prisma.$transaction(async (tx) => {
    await assertTeamAuthorization(request, actorId, actorRole, tx);

    // Update request - revert to APPROVED
    const updated = await tx.leaveRequest.update({
      where: { id },
      data: {
        status: "APPROVED" as LeaveStatus,
        approverComment: comment,
      },
    });

    // Record audit log
    await tx.auditLog.create({
      data: {
        actorId,
        action: "REJECT_CANCELLATION",
        entityType: "LeaveRequest",
        entityId: String(id),
        before: { status: "CANCEL_REQUESTED" },
        after: { status: "APPROVED" },
      },
    });

    return updated;
  });

  return result;
}

/**
 * Get all pending leave requests that an actor can approve
 * HR_ADMIN sees all PENDING + CANCEL_REQUESTED
 * MANAGER sees only same-team PENDING + CANCEL_REQUESTED (excluding own)
 */
export async function getSubordinatePendingRequests(
  actorId: string,
  actorRole: Role,
  prisma: PrismaClient,
  options?: { skip?: number; take?: number }
): Promise<(LeaveRequest & { employee: User; leaveType: Prisma.LeaveTypeGetPayload<{}> })[]> {
  const skip = options?.skip ?? 0;
  const take = options?.take;

  // HR_ADMIN sees all PENDING + CANCEL_REQUESTED (excluding own requests)
  if (actorRole === Role.HR_ADMIN) {
    return prisma.leaveRequest.findMany({
      where: {
        status: { in: ["PENDING" as LeaveStatus, "CANCEL_REQUESTED" as LeaveStatus] },
        NOT: { employeeId: actorId },
      },
      include: {
        employee: true,
        leaveType: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      skip,
      ...(take !== undefined && { take }),
    });
  }

  // MANAGER sees same-team PENDING + CANCEL_REQUESTED (excluding own)
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
  });

  if (!actor || !actor.team) {
    return [];
  }

  return prisma.leaveRequest.findMany({
    where: {
      status: { in: ["PENDING" as LeaveStatus, "CANCEL_REQUESTED" as LeaveStatus] },
      employee: {
        team: actor.team,
      },
      NOT: {
        employeeId: actorId,
      },
    },
    include: {
      employee: true,
      leaveType: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    skip,
    ...(take !== undefined && { take }),
  });
}

/**
 * Bulk approve multiple leave requests
 * Validates: ids array is not empty
 * For each id, validates actor eligibility (same logic as approveLeaveRequest)
 * Uses prisma.$transaction for atomicity
 * Returns array of approved leave requests
 */
export async function bulkApproveLeaveRequests(
  ids: number[],
  actorId: string,
  actorRole: Role,
  comment: string | undefined,
  prisma: PrismaClient
): Promise<LeaveRequest[]> {
  // Validate ids array is not empty
  if (!ids || ids.length === 0) {
    throw new AppError("No request IDs provided", 400, "BAD_REQUEST");
  }

  // Find all requests with employee relation
  const requests = await prisma.leaveRequest.findMany({
    where: { id: { in: ids } },
    include: { employee: true },
  });

  // Validate all requests exist
  if (requests.length !== ids.length) {
    throw new AppError("One or more leave requests not found", 404, "NOT_FOUND");
  }

  // Self-approval check (sync, outside tx)
  for (const request of requests) {
    assertNotSelfApproval(request, actorId);
    if (request.status !== "PENDING") {
      throw new AppError(`Cannot approve: request ${request.id} is not PENDING`, 422, "VALIDATION_ERROR");
    }
  }

  // Execute all approvals in a single transaction
  const result = await prisma.$transaction(async (tx: TxClient) => {
    const approved: LeaveRequest[] = [];

    for (const request of requests) {
      // Validate team authorization inside transaction
      await assertTeamAuthorization(request, actorId, actorRole, tx);

      const year = request.startDate.getUTCFullYear();

      // Update request
      const updated = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED" as LeaveStatus,
          approvedById: actorId,
          approverComment: comment,
        },
      });

      // Update balance
      await tx.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        data: {
          pendingDays: { decrement: request.totalDays },
          usedDays: { increment: request.totalDays },
        },
      });

      // Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: "APPROVE",
          entityType: "LeaveRequest",
          entityId: String(request.id),
          before: { status: "PENDING" },
          after: { status: "APPROVED" },
        },
      });

      approved.push(updated);
    }

    return approved;
  });

  return result;
}

/**
 * Bulk reject multiple leave requests
 * Validates: ids array is not empty, comment is required and not empty
 * For each id, validates actor eligibility (same logic as rejectLeaveRequest)
 * Uses prisma.$transaction for atomicity
 * Returns array of rejected leave requests
 */
export async function bulkRejectLeaveRequests(
  ids: number[],
  comment: string,
  actorId: string,
  actorRole: Role,
  prisma: PrismaClient
): Promise<LeaveRequest[]> {
  // Validate ids array is not empty
  if (!ids || ids.length === 0) {
    throw new AppError("No request IDs provided", 400, "BAD_REQUEST");
  }

  // Validate comment is required
  if (!comment || comment.trim() === "") {
    throw new AppError("Comment is required for rejection", 422, "VALIDATION_ERROR");
  }

  // Find all requests with employee relation
  const requests = await prisma.leaveRequest.findMany({
    where: { id: { in: ids } },
    include: { employee: true },
  });

  // Validate all requests exist
  if (requests.length !== ids.length) {
    throw new AppError("One or more leave requests not found", 404, "NOT_FOUND");
  }

  // Self-approval check (sync, outside tx)
  for (const request of requests) {
    assertNotSelfApproval(request, actorId);
    if (request.status !== "PENDING") {
      throw new AppError(`Cannot reject: request ${request.id} is not PENDING`, 422, "VALIDATION_ERROR");
    }
  }

  // Execute all rejections in a single transaction
  const result = await prisma.$transaction(async (tx: TxClient) => {
    const rejected: LeaveRequest[] = [];

    for (const request of requests) {
      // Validate team authorization inside transaction
      await assertTeamAuthorization(request, actorId, actorRole, tx);

      const year = request.startDate.getUTCFullYear();

      // Update request
      const updated = await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED" as LeaveStatus,
          approvedById: actorId,
          approverComment: comment,
        },
      });

      // Update balance - only decrement pendingDays
      await tx.leaveBalance.update({
        where: {
          userId_leaveTypeId_year: {
            userId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
        data: {
          pendingDays: { decrement: request.totalDays },
        },
      });

      // Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: "REJECT",
          entityType: "LeaveRequest",
          entityId: String(request.id),
          before: { status: "PENDING" },
          after: { status: "REJECTED" },
        },
      });

      rejected.push(updated);
    }

    return rejected;
  });

  return result;
}
