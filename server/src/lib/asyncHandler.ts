import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError";
import logger from "./logger";

/**
 * Wraps an async route handler and forwards AppError instances to the global
 * error handler. All unhandled errors fall back to a 500 response.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      logger.error({ err: error }, "Unhandled route error");
      res.status(500).json({ message: "An unexpected error occurred." });
    });
  };

export { AppError };
