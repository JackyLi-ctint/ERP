import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import routes from "./routes";

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Rate limiting for auth endpoints (OWASP A07)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });
  app.use("/api/auth", authLimiter);

  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });
  app.use("/api", apiLimiter);

  // API routes
  app.use("/api", routes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ message: "Not Found" });
  });

  // Global JSON error handler — must be last; catches synchronous throws from middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (err.message.includes("Unauthorized")) {
      res.status(401).json({ message: err.message });
    } else if (err.message.includes("Forbidden")) {
      res.status(403).json({ message: err.message });
    } else if (err.message.includes("Not found") || err.message.includes("Not Found")) {
      res.status(404).json({ message: err.message });
    } else if (err.message.includes("Validation error") || err.message.includes("validation")) {
      res.status(400).json({ message: err.message });
    } else {
      res.status(500).json({ message: "An unexpected error occurred." });
    }
  });

  return app;
}

// Default export for convenience (e.g., in tests)
export default createApp();
