import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async route handler and maps thrown errors to HTTP status codes.
 * Shared across all route files to ensure consistent error→status mapping.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      if (error.message.match(/overlap|already exists/i)) {
        res.status(409).json({ message: error.message });
      } else if (
        error.message.match(
          /Insufficient balance|working day|halfDay|start date|end date|Balance not found|Semantic validation/i
        )
      ) {
        res.status(422).json({ message: error.message });
      } else if (error.message.match(/Forbidden/)) {
        res.status(403).json({ message: error.message });
      } else if (error.message.match(/not found|Not found/)) {
        res.status(404).json({ message: error.message });
      } else if (
        error.message.match(
          /Cannot approve your own|Cannot approve|Cannot reject|required for rejection|Cannot cancel/
        )
      ) {
        res.status(422).json({ message: error.message });
      } else if (error.message.match(/Validation error/)) {
        res.status(400).json({ message: error.message });
      } else {
        console.error("Unhandled route error:", error);
        res.status(500).json({ message: "An unexpected error occurred." });
      }
    });
  };
