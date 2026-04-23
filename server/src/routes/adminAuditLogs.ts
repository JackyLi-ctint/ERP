import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../lib/asyncHandler";
import config from "../config";

const adminAuditLogsRouter = Router();

const querySchema = z.object({
  from: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    "Invalid ISO date format for 'from'"
  ),
  to: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    "Invalid ISO date format for 'to'"
  ),
  entityType: z.string().optional(),
  actorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(config.pagination.maxSize).default(config.pagination.defaultSize),
});

adminAuditLogsRouter.get(
  "/",
  requireAuth,
  requireRole("HR_ADMIN"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid query parameters" });
      return;
    }

    const { from, to, entityType, actorId, page, pageSize } = parsed.data;

    // where is typed via prisma inference; cast needed until prisma generate is re-run
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }
    if (entityType) where.entityType = entityType;
    if (actorId) where.actorId = actorId;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  })
);

export { adminAuditLogsRouter };
