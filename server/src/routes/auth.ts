import { Router, Request, Response, NextFunction } from "express";
import { register, login, refreshToken } from "../services/auth.service";

const router = Router();

// Error handling middleware for route handlers
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      if (error.message.includes("already exists")) {
        res.status(409).json({ message: error.message });
      } else if (error.message.includes("Validation error")) {
        res.status(400).json({ message: error.message });
      } else if (error.message.includes("Invalid email or password")) {
        res.status(401).json({ message: error.message });
      } else if (
        error.message.includes("Invalid or expired") ||
        error.message.includes("Refresh token is required")
      ) {
        res.status(401).json({ message: error.message });
      } else {
        res.status(500).json({ message: error.message });
      }
    });
  };

router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const result = await register(name, email, password);
    res.status(201).json(result);
  })
);

router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const result = await login(email, password);
    res.status(200).json(result);
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      res.status(401).json({ message: "Refresh token is required" });
      return;
    }

    const result = await refreshToken(token);
    res.status(200).json(result);
  })
);

export default router;
