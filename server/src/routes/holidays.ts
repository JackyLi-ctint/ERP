import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/AppError";

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

const router = Router();

/**
 * GET /api/holidays?year=YYYY
 * Returns all public holidays for the given year
 * Requires authentication (any role)
 */
router.get("/", requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = yearQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError("Invalid year. Must be between 2000 and 2100.", 400, "VALIDATION_ERROR");
  }

  const { year } = parsed.data;
  const holidays = await prisma.publicHoliday.findMany({
    where: { year },
    orderBy: { date: "asc" },
  });

  res.json({ holidays });
}));

export default router;
