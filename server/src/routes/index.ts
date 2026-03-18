import { Router } from "express";
import authRoutes from "./auth";
import holidaysRoutes from "./holidays";
import leaveTypesRoutes from "./leaveTypes";
import leaveBalanceRoutes from "./leaveBalance";
import { leaveRequestsRouter, meLeaveRequestsRouter } from "./leaveRequests";
import { leaveApprovalRouter } from "./leaveApproval";
import { leaveRequestDetailRouter } from "./leaveRequestDetail";
import { managerLeaveRequestsRouter } from "./managerLeaveRequests";
import { usersRouter } from "./users";
import { leaveCalendarRouter } from "./leaveCalendar";
import { adminLeaveRequestsRouter } from "./adminLeaveRequests";
import { adminBalancesRouter } from "./adminBalances";

const router = Router();

router.use("/auth", authRoutes);
router.use("/holidays", holidaysRoutes);
router.use("/leave-types", leaveTypesRoutes);
router.use("/", leaveBalanceRoutes);
router.use("/me/leave-requests", meLeaveRequestsRouter);
router.use("/leave-requests", leaveRequestsRouter);
router.use("/leave-requests", leaveApprovalRouter);
router.use("/leave-requests", leaveRequestDetailRouter);
router.use("/manager/leave-requests", managerLeaveRequestsRouter);
router.use("/users", usersRouter);
router.use("/leave-calendar", leaveCalendarRouter);
router.use("/admin/leave-requests", adminLeaveRequestsRouter);
router.use("/admin/balances", adminBalancesRouter);

export default router;
