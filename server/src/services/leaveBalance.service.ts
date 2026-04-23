import { PrismaClient, LeaveBalance } from "@prisma/client";

/**
 * Initialize leave balances for all active users and active leave types for a given year
 * - Upserts a balance row for each user × active leave type combination
 * - Skips existing balances (does NOT overwrite)
 * - Returns count of created vs skipped
 */
export async function initBalances(
  year: number,
  prisma: PrismaClient
): Promise<{ created: number; skipped: number }> {
  // Fetch active users and active leave types in parallel
  const [activeUsers, activeLeaveTypes] = await Promise.all([
    prisma.user.findMany(),
    prisma.leaveType.findMany({ where: { isActive: true } }),
  ]);

  const total = activeUsers.length * activeLeaveTypes.length;
  if (total === 0) return { created: 0, skipped: 0 };

  // Build batch data for all user × leaveType combinations
  const data = activeUsers.flatMap((user) =>
    activeLeaveTypes.map((leaveType) => ({
      userId: user.id,
      leaveTypeId: leaveType.id,
      year,
      totalDays: leaveType.defaultDays,
      usedDays: 0,
      pendingDays: 0,
    }))
  );

  // Single batched insert — skips any combination that already exists
  const result = await prisma.leaveBalance.createMany({
    data,
    skipDuplicates: true,
  });

  return { created: result.count, skipped: total - result.count };
}

/**
 * Get all leave balances for a specific user in a given year
 * Includes related leaveType and user details
 */
export async function getBalancesForUser(
  userId: string,
  year: number,
  prisma: PrismaClient
): Promise<LeaveBalance[]> {
  return prisma.leaveBalance.findMany({
    where: {
      userId,
      year,
    },
    include: {
      leaveType: {
        select: {
          id: true,
          name: true,
          defaultDays: true,
          isCarryForward: true,
          requiresDocument: true,
          isActive: true,
        },
      },
    },
    orderBy: {
      leaveType: {
        name: "asc",
      },
    },
  });
}

/**
 * Get a specific leave balance for a user × leave type × year
 * Includes related leaveType details
 */
export async function getBalanceForType(
  userId: string,
  leaveTypeId: number,
  year: number,
  prisma: PrismaClient
): Promise<LeaveBalance | null> {
  return prisma.leaveBalance.findUnique({
    where: {
      userId_leaveTypeId_year: {
        userId,
        leaveTypeId,
        year,
      },
    },
    include: {
      leaveType: {
        select: {
          id: true,
          name: true,
          defaultDays: true,
          isCarryForward: true,
          requiresDocument: true,
          isActive: true,
        },
      },
    },
  });
}
