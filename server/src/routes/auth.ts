import { Router, Request, Response, NextFunction } from "express";
import { register, login, refreshToken } from "../services/auth.service";
import {
  isAzureConfigured,
  getAuthCodeUrl,
  acquireTokenByCode,
  generateState,
  consumeState,
} from "../services/azureAd.service";
import prisma from "../lib/prisma";
import { JwtService } from "../auth/jwt.service";

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

// GET /api/auth/azure/initiate
router.get(
  "/azure/initiate",
  asyncHandler(async (_req: Request, res: Response) => {
    if (!isAzureConfigured()) {
      res.status(503).json({ message: "Azure AD is not configured on this server" });
      return;
    }
    const state = generateState();
    const url = await getAuthCodeUrl(state);
    res.redirect(url);
  })
);

// GET /api/auth/azure/callback
router.get(
  "/azure/callback",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isAzureConfigured()) {
      res.status(503).json({ message: "Azure AD is not configured on this server" });
      return;
    }

    const code = req.query.code as string;
    const state = req.query.state as string | undefined;
    if (!code) {
      res.status(400).json({ message: "Missing authorization code" });
      return;
    }

    // Verify OAuth state to prevent CSRF / authorization-code injection
    if (!state || !consumeState(state)) {
      res.status(400).json({ message: "Invalid or missing OAuth state parameter" });
      return;
    }

    const { oid, name, email } = await acquireTokenByCode(code);

    // Find or create user by msEntraOid
    let user = await prisma.user.findFirst({ where: { msEntraOid: oid } });
    if (!user) {
      // Try by email
      user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        // Link existing user to AD
        user = await prisma.user.update({ where: { id: user.id }, data: { msEntraOid: oid } });
      } else {
        // Create new user from AD claims
        const crypto = await import("crypto");
        const bcryptModule = await import("bcryptjs");
        const tempHash = await bcryptModule.hash(crypto.randomUUID(), 12);
        user = await prisma.user.create({
          data: {
            name,
            email,
            passwordHash: tempHash,
            msEntraOid: oid,
            role: "EMPLOYEE",
          },
        });
      }
    }

    // Issue JWT as normal
    const accessToken = JwtService.signAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshTokenValue = JwtService.signRefreshToken({ id: user.id, email: user.email, role: user.role });

    // Redirect to frontend with tokens (use URL query)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshTokenValue)}`
    );
  })
);

export default router;
