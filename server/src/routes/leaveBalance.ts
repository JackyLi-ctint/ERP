import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { getBalancesForUser } from "../services/leaveBalance.service";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

/**
 * GET /api/me/balances?year=YYYY
 * Returns current user's leave balances for the given year
 * Accessible by: all authenticated roles
 * Defaults to current year if no year parameter provided
 */
router.get(
  "/me/balances",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ message: "Invalid year. Must be between 2000 and 2100." });
      return;
    }

    const balances = await getBalancesForUser(req.user!.id, year, prisma);

    res.json({ balances });
  })
);

/**
 * GET /api/users/:userId/balances?year=YYYY
 * Returns specific user's leave balances
 * Accessible by: HR_ADMIN only
 * Defaults to current year if no year parameter provided
 */
router.get(
  "/users/:userId/balances",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId as string;

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const yearParam = req.query.year as string | undefined;
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ message: "Invalid year. Must be between 2000 and 2100." });
      return;
    }

    const balances = await getBalancesForUser(userId, year, prisma);

    res.json({ balances });
  })
);

export default router;
