import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import config from "./config";
import { AppError } from "./lib/AppError";
import logger from "./lib/logger";

export function createApp() {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  // HTTP request logging
  app.use(pinoHttp({ logger }));

  // Body parsing middleware
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Rate limiting for auth endpoints (OWASP A07)
  const authLimiter = rateLimit({
    windowMs: config.rateLimitAuth.windowMs,
    max: config.rateLimitAuth.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });
  app.use("/api/auth", authLimiter);

  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: config.rateLimitApi.windowMs,
    max: config.rateLimitApi.max,
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

  // Global JSON error handler — must be last; catches errors forwarded via next(err)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError && err.statusCode < 500) {
      logger.warn({ err }, err.message);
    } else {
      logger.error({ err }, err.message);
    }
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ message: err.message });
    } else {
      res.status(500).json({ message: "An unexpected error occurred." });
    }
  });

  return app;
}

// Default export for convenience (e.g., in tests)
export default createApp();
