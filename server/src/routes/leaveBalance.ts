import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { getBalancesForUser } from "../services/leaveBalance.service";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/AppError";

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

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
    const parsed = yearQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid year. Must be between 2000 and 2100.", 400, "VALIDATION_ERROR");
    }
    const year = parsed.data.year ?? new Date().getFullYear();

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

    const yearParam2 = req.query.year as string | undefined;
    const parsed2 = yearQuerySchema.safeParse(req.query);
    if (yearParam2 !== undefined && !parsed2.success) {
      throw new AppError("Invalid year. Must be between 2000 and 2100.", 400, "VALIDATION_ERROR");
    }
    const year2 = parsed2.data?.year ?? new Date().getFullYear();

    const balances = await getBalancesForUser(userId, year2, prisma);

    res.json({ balances });
  })
);

export default router;
