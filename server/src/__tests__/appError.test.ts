import { AppError } from '../lib/AppError';
import { asyncHandler } from '../lib/asyncHandler';
import express, { Request, Response } from 'express';
import request from 'supertest';

describe('AppError', () => {
  test('carries statusCode and code fields', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('stack trace is captured', () => {
    const err = new AppError('oops', 500, 'SERVER_ERROR');
    expect(err.stack).toBeDefined();
  });
});

describe('asyncHandler', () => {
  function makeApp(handler: (req: Request, res: Response) => Promise<void>) {
    const app = express();
    app.get('/test', asyncHandler(handler));
    // minimal error handler
    app.use((err: Error, _req: Request, res: Response, _next: any) => {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ message: err.message });
      } else {
        res.status(500).json({ message: 'An unexpected error occurred.' });
      }
    });
    return app;
  }

  test('forwards AppError.statusCode to response', async () => {
    const app = makeApp(async () => {
      throw new AppError('Resource not found', 404, 'NOT_FOUND');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resource not found');
  });

  test('returns 500 for unexpected errors', async () => {
    const app = makeApp(async () => {
      throw new Error('something broke');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
  });

  test('forwards AppError 401', async () => {
    const app = makeApp(async () => {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  test('forwards AppError 403', async () => {
    const app = makeApp(async () => {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
  });

  test('error with "Unauthorized" in message is not misclassified as 401 by global handler', async () => {
    // Plain Error (not AppError) with "Unauthorized" in message → asyncHandler passes to next(err)
    // The global handler should NOT do string-matching; this verifies asyncHandler passes it correctly
    const app = makeApp(async () => {
      throw new Error('Unauthorized access happened');
    });
    const res = await request(app).get('/test');
    // Should be 500 because it is NOT an AppError
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('An unexpected error occurred.');
  });
});
