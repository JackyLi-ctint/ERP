import { Request, Response, NextFunction } from "express";
import { JwtService } from "../auth/jwt.service";
import { AppError } from "../lib/AppError";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Unauthorized: Missing or invalid Authorization header", 401, "UNAUTHORIZED");
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const payload = JwtService.verifyAccessToken(token);
    req.user = {
      id: payload.id,
      role: payload.role,
    };
    next();
  } catch (error) {
    throw new AppError("Unauthorized: Invalid or expired token", 401, "UNAUTHORIZED");
  }
}
