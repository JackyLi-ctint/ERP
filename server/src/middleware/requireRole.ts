import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../lib/AppError";

export const SUPERUSER_ROLES: Role[] = [Role.HR_ADMIN];

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError("Unauthorized: User not authenticated", 401, "UNAUTHORIZED");
    }

    // Superusers pass all role checks
    if (SUPERUSER_ROLES.includes(req.user.role)) {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(
        `Forbidden: User role '${req.user.role}' does not have permission for this resource`,
        403,
        "FORBIDDEN"
      );
    }

    next();
  };
}
