import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import type { Role } from "@prisma/client";

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
}

const getAccessSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_ACCESS_SECRET is not set or is too short (minimum 32 characters)"
    );
  }
  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_REFRESH_SECRET is not set or is too short (minimum 32 characters)"
    );
  }
  return secret;
};

const getAccessExpiry = (): StringValue => {
  return (process.env.JWT_ACCESS_EXPIRY || "15m") as StringValue;
};

const getRefreshExpiry = (): StringValue => {
  return (process.env.JWT_REFRESH_EXPIRY || "7d") as StringValue;
};

export const JwtService = {
  signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, getAccessSecret(), {
      expiresIn: getAccessExpiry(),
      algorithm: "HS256",
    });
  },

  signRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, getRefreshSecret(), {
      expiresIn: getRefreshExpiry(),
      algorithm: "HS256",
    });
  },

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, getAccessSecret(), {
        algorithms: ["HS256"],
      }) as JwtPayload;
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  },

  verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, getRefreshSecret(), {
        algorithms: ["HS256"],
      }) as JwtPayload;
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  },
};
