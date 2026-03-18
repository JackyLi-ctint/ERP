import { Router } from "express";
import authRoutes from "./auth";
import holidaysRoutes from "./holidays";
import leaveTypesRoutes from "./leaveTypes";
import leaveBalanceRoutes from "./leaveBalance";

const router = Router();

router.use("/auth", authRoutes);
router.use("/holidays", holidaysRoutes);
router.use("/leave-types", leaveTypesRoutes);
router.use("/", leaveBalanceRoutes);

export default router;
