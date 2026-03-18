import { Router } from "express";
import authRoutes from "./auth";
import holidaysRoutes from "./holidays";
import leaveTypesRoutes from "./leaveTypes";
import leaveBalanceRoutes from "./leaveBalance";
import { leaveRequestsRouter, meLeaveRequestsRouter } from "./leaveRequests";

const router = Router();

router.use("/auth", authRoutes);
router.use("/holidays", holidaysRoutes);
router.use("/leave-types", leaveTypesRoutes);
router.use("/", leaveBalanceRoutes);
router.use("/me/leave-requests", meLeaveRequestsRouter);
router.use("/leave-requests", leaveRequestsRouter);

export default router;
