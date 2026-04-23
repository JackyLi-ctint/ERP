import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const RoleSchema = z.enum(["EMPLOYEE", "MANAGER", "HR_ADMIN"]);
export type Role = z.infer<typeof RoleSchema>;

export const LeaveStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCEL_REQUESTED",
  "CANCELLED",
]);
export type LeaveStatus = z.infer<typeof LeaveStatusSchema>;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: AuthUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ─── Leave Types ─────────────────────────────────────────────────────────────

export const LeaveTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  defaultDays: z.number(),
  isCarryForward: z.boolean(),
  requiresDocument: z.boolean(),
  isActive: z.boolean(),
});
export type LeaveType = z.infer<typeof LeaveTypeSchema>;

// ─── Leave Requests ──────────────────────────────────────────────────────────

export const SubmitLeaveRequestSchema = z
  .object({
    leaveTypeId: z.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    halfDay: z.boolean().default(false),
    period: z.enum(["AM", "PM"]).optional(),
    reason: z.string().max(500).optional(),
    attachmentUrl: z.string().url().optional(),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });
export type SubmitLeaveRequest = z.infer<typeof SubmitLeaveRequestSchema>;

export const CancelLeaveRequestSchema = z.object({
  cancellationReason: z.string().max(500).optional(),
});
export type CancelLeaveRequest = z.infer<typeof CancelLeaveRequestSchema>;

export const LeaveRequestSchema = z.object({
  id: z.number(),
  leaveTypeId: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  totalDays: z.number(),
  halfDay: z.boolean(),
  period: z.string().optional(),
  reason: z.string().optional(),
  cancellationReason: z.string().optional(),
  status: LeaveStatusSchema,
  leaveType: z.object({ id: z.number(), name: z.string() }),
  createdAt: z.string(),
});
export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;

// ─── Leave Balance ────────────────────────────────────────────────────────────

export const LeaveBalanceSchema = z.object({
  id: z.number(),
  userId: z.string(),
  leaveTypeId: z.number(),
  year: z.number(),
  totalDays: z.number(),
  usedDays: z.number(),
  pendingDays: z.number(),
  leaveType: z.object({ id: z.number(), name: z.string() }),
});
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;

// ─── Approval ─────────────────────────────────────────────────────────────────

export const ApproveLeaveSchema = z.object({
  comment: z.string().max(500).optional(),
});
export type ApproveLeave = z.infer<typeof ApproveLeaveSchema>;

export const RejectLeaveSchema = z.object({
  comment: z.string().min(1).max(500),
});
export type RejectLeave = z.infer<typeof RejectLeaveSchema>;

export const BulkApproveSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  comment: z.string().max(500).optional(),
});
export type BulkApprove = z.infer<typeof BulkApproveSchema>;

export const BulkRejectSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  comment: z.string().min(1).max(500),
});
export type BulkReject = z.infer<typeof BulkRejectSchema>;

// ─── Users ────────────────────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: RoleSchema,
  team: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  role: RoleSchema.default("EMPLOYEE"),
  team: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
});
export type CreateUser = z.infer<typeof CreateUserSchema>;

// ─── Pending Request (manager approval view) ────────────────────────────────

export const PendingRequestSchema = z.object({
  id: z.number(),
  leaveTypeId: z.number(),
  startDate: z.string(),
  endDate: z.string(),
  totalDays: z.number(),
  halfDay: z.boolean(),
  period: z.string().optional(),
  reason: z.string().optional(),
  status: LeaveStatusSchema,
  leaveType: z.object({ id: z.number(), name: z.string() }),
  employee: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  createdAt: z.string(),
});
export type PendingRequest = z.infer<typeof PendingRequestSchema>;

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const AuditLogSchema = z.object({
  id: z.number(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  actorId: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  createdAt: z.string(),
  actor: z.object({ id: z.string(), name: z.string(), email: z.string() }).optional(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const AuditLogsResponseSchema = z.object({
  logs: z.array(AuditLogSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});
export type AuditLogsResponse = z.infer<typeof AuditLogsResponseSchema>;
