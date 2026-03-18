import { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new Error("Unauthorized: User not authenticated");
    }

    // HR_ADMIN is a superuser and passes all role checks
    if (req.user.role === "HR_ADMIN") {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      throw new Error(
        `Forbidden: User role '${req.user.role}' does not have permission for this resource`
      );
    }

    next();
  };
}
