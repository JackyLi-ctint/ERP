import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

/**
 * GET /api/holidays?year=YYYY
 * Returns all public holidays for the given year
 * Requires authentication (any role)
 */
router.get("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string);

    // Validate year parameter
    if (isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ message: "Invalid year. Must be between 2000 and 2100." });
      return;
    }

    const holidays = await prisma.publicHoliday.findMany({
      where: { year },
      orderBy: { date: "asc" },
    });

    res.json({ holidays });
  } catch (error) {
    console.error("Error fetching holidays:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
