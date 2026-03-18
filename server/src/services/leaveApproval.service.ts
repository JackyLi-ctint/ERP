import { PrismaClient, Role, LeaveStatus, LeaveRequest, User } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Synchronous self-approval guard — no DB call needed.
 */
function assertNotSelfApproval(request: LeaveRequest, actorId: string): void {
  if (request.employeeId === actorId) {
    throw new Error("Cannot approve your own leave request");
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
  if (actorRole === "HR_ADMIN") {
    return; // HR_ADMIN bypasses team check
  }

  const actor = await tx.user.findUnique({ where: { id: actorId } });

  if (!actor || !actor.team || actor.team !== request.employee.team) {
    throw new Error("Forbidden: not authorised to act on this request");
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
  // Find request with employee relation
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true },
  });

  if (!request) {
    throw new Error("Leave request not found");
  }

  // Validate status
  if (request.status !== "PENDING") {
    throw new Error("Cannot approve: request is not PENDING");
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
  // Find request with employee relation
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true },
  });

  if (!request) {
    throw new Error("Leave request not found");
  }

  // Validate comment
  if (!comment || comment.trim() === "") {
    throw new Error("Approver comment is required for rejection");
  }

  // Validate status
  if (request.status !== "PENDING") {
    throw new Error("Cannot reject: request is not PENDING");
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
    throw new Error("Leave request not found");
  }

  // Validate status
  if (request.status !== "CANCEL_REQUESTED") {
    throw new Error("Cannot approve: request is not CANCEL_REQUESTED");
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
    throw new Error("Leave request not found");
  }

  // Validate comment
  if (!comment || comment.trim() === "") {
    throw new Error("Approver comment is required for rejection");
  }

  // Validate status
  if (request.status !== "CANCEL_REQUESTED") {
    throw new Error("Cannot reject: request is not CANCEL_REQUESTED");
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
  prisma: PrismaClient
): Promise<(LeaveRequest & { employee: User; leaveType: any })[]> {
  // HR_ADMIN sees all PENDING + CANCEL_REQUESTED (excluding own requests)
  if (actorRole === "HR_ADMIN") {
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
  });
}
