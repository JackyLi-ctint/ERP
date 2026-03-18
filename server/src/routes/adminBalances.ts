import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../lib/asyncHandler";
import { initBalances } from "../services/leaveBalance.service";

export const adminBalancesRouter = Router();

/**
 * POST /api/admin/balances/init
 * Initialize leave balances for all users and active leave types for a given year.
 * HR_ADMIN only.
 */
adminBalancesRouter.post(
  "/init",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { year } = req.body as { year?: unknown };

    if (year === undefined || year === null) {
      res.status(400).json({ message: "year is required" });
      return;
    }

    const yearNum = Number(year);
    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
      res.status(400).json({ message: "year must be an integer between 2000 and 2100" });
      return;
    }

    const result = await initBalances(yearNum, prisma);
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: "INIT_BALANCES",
        entityType: "LeaveBalance",
        entityId: "batch",
        after: { year: yearNum, created: result.created, skipped: result.skipped },
      },
    });
    res.status(200).json(result);
  })
);

/**
 * GET /api/admin/balances
 * Returns all leave balances with optional year/userId filters.
 * HR_ADMIN only.
 */
adminBalancesRouter.get(
  "/",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const yearRaw = req.query.year as string | undefined;
    const userId = req.query.userId as string | undefined;

    const where: { year?: number; userId?: string } = {};
    if (yearRaw) {
      const yearNum = parseInt(yearRaw, 10);
      if (!isNaN(yearNum)) where.year = yearNum;
    }
    if (userId) {
      where.userId = userId;
    }

    const balances = await prisma.leaveBalance.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: [{ year: "desc" }, { user: { name: "asc" } }],
    });

    res.status(200).json({
      balances: balances.map((b) => ({
        id: b.id,
        userId: b.userId,
        userName: b.user.name,
        userEmail: b.user.email,
        leaveTypeId: b.leaveTypeId,
        leaveTypeName: b.leaveType.name,
        year: b.year,
        totalDays: b.totalDays,
        usedDays: b.usedDays,
        pendingDays: b.pendingDays,
      })),
    });
  })
);

/**
 * POST /api/admin/balances/carry-forward
 * Carry forward isCarryForward leave balances from fromYear to toYear.
 * HR_ADMIN only.
 */
adminBalancesRouter.post(
  "/carry-forward",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const { fromYear, toYear } = req.body as { fromYear?: unknown; toYear?: unknown };

    const fromYearNum = Number(fromYear);
    const toYearNum = Number(toYear);

    if (
      !Number.isInteger(fromYearNum) ||
      !Number.isInteger(toYearNum) ||
      fromYear === undefined ||
      toYear === undefined
    ) {
      res.status(400).json({ message: "fromYear and toYear must be integers" });
      return;
    }

    if (toYearNum <= fromYearNum) {
      res.status(400).json({ message: "toYear must be greater than fromYear" });
      return;
    }

    // Fetch all balances from fromYear where leaveType.isCarryForward = true
    const fromBalances = await prisma.leaveBalance.findMany({
      where: {
        year: fromYearNum,
        leaveType: { isCarryForward: true },
      },
      include: {
        leaveType: { select: { id: true, isCarryForward: true } },
      },
    });

    let carried = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const balance of fromBalances) {
        const carryAmount = Math.max(0, balance.totalDays - balance.usedDays);
        if (carryAmount <= 0) {
          skipped++;
          continue;
        }

        // Check if toYear balance exists
        const existing = await tx.leaveBalance.findUnique({
          where: {
            userId_leaveTypeId_year: {
              userId: balance.userId,
              leaveTypeId: balance.leaveTypeId,
              year: toYearNum,
            },
          },
        });

        if (existing) {
          await tx.leaveBalance.update({
            where: {
              userId_leaveTypeId_year: {
                userId: balance.userId,
                leaveTypeId: balance.leaveTypeId,
                year: toYearNum,
              },
            },
            data: {
              totalDays: { increment: carryAmount },
            },
          });
        } else {
          await tx.leaveBalance.create({
            data: {
              userId: balance.userId,
              leaveTypeId: balance.leaveTypeId,
              year: toYearNum,
              totalDays: carryAmount,
              usedDays: 0,
              pendingDays: 0,
            },
          });
        }
        carried++;
      }

      // Write audit log
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: "CARRY_FORWARD",
          entityType: "LeaveBalance",
          entityId: "batch",
          after: { fromYear: fromYearNum, toYear: toYearNum, affectedCount: carried },
        },
      });
    });

    res.status(200).json({ carried, skipped });
  })
);
