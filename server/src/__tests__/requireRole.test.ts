import { requireRole } from "../middleware/requireRole";
import { Request, Response, NextFunction } from "express";

describe("requireRole middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      user: undefined,
    };
    res = {};
    next = jest.fn();
  });

  test("should allow HR_ADMIN to access any role-restricted route", () => {
    req.user = { id: "user-1", role: "HR_ADMIN" };

    const middleware = requireRole("EMPLOYEE", "MANAGER");
    expect(() => {
      middleware(req as Request, res as Response, next);
    }).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  test("should allow MANAGER to access MANAGER-only route", () => {
    req.user = { id: "user-1", role: "MANAGER" };

    const middleware = requireRole("MANAGER");
    expect(() => {
      middleware(req as Request, res as Response, next);
    }).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  test("should reject EMPLOYEE from MANAGER-only route with 403 error", () => {
    req.user = { id: "user-1", role: "EMPLOYEE" };

    const middleware = requireRole("MANAGER");
    expect(() => {
      middleware(req as Request, res as Response, next);
    }).toThrow("Forbidden");
  });

  test("should reject unauthenticated request with 401 error", () => {
    req.user = undefined;

    const middleware = requireRole("MANAGER");
    expect(() => {
      middleware(req as Request, res as Response, next);
    }).toThrow("Unauthorized");
  });

  test("should allow EMPLOYEE to access EMPLOYEE-only route", () => {
    req.user = { id: "user-1", role: "EMPLOYEE" };

    const middleware = requireRole("EMPLOYEE");
    expect(() => {
      middleware(req as Request, res as Response, next);
    }).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});
