import { Request, Response, NextFunction } from "express";
import { JwtService } from "../auth/jwt.service";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing or invalid Authorization header");
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
    throw new Error("Unauthorized: Invalid or expired token");
  }
}
