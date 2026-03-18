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
  // Get all active users
  const activeUsers = await prisma.user.findMany({
    where: {
      // If user model ever adds isActive field in future, we'd filter here
      // For now, we include all users
    },
  });

  // Get all active leave types
  const activeLeaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
  });

  let created = 0;
  let skipped = 0;

  // Create or skip balances for each user × leave type combination
  for (const user of activeUsers) {
    for (const leaveType of activeLeaveTypes) {
      const existingBalance = await prisma.leaveBalance.findUnique({
        where: {
          userId_leaveTypeId_year: {
            userId: user.id,
            leaveTypeId: leaveType.id,
            year,
          },
        },
      });

      if (existingBalance) {
        skipped++;
      } else {
        await prisma.leaveBalance.create({
          data: {
            userId: user.id,
            leaveTypeId: leaveType.id,
            year,
            totalDays: leaveType.defaultDays,
            usedDays: 0,
            pendingDays: 0,
          },
        });
        created++;
      }
    }
  }

  return { created, skipped };
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
