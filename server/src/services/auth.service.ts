import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { JwtService } from "../auth/jwt.service";
import { z } from "zod";

const prisma = new PrismaClient();

const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const RegisterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: PasswordSchema,
});

const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  // Validate input
  const validation = RegisterSchema.safeParse({ name, email, password });
  if (!validation.success) {
    const errors = validation.error.issues.map((e) => e.message).join(", ");
    throw new Error(`Validation error: ${errors}`);
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error(`User with email ${email} already exists`);
  }

  // Hash password with bcrypt cost factor 12
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: Role.EMPLOYEE,
    },
  });

  // Generate tokens
  const accessToken = JwtService.signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = JwtService.signRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  // Validate input
  const validation = LoginSchema.safeParse({ email, password });
  if (!validation.success) {
    const errors = validation.error.issues.map((e) => e.message).join(", ");
    throw new Error(`Validation error: ${errors}`);
  }

  // Find user — fetch passwordHash only for verification, not included in AuthResponse
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, passwordHash: true },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatch) {
    throw new Error("Invalid email or password");
  }

  // Generate tokens
  const accessToken = JwtService.signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = JwtService.signRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function refreshToken(token: string): Promise<AuthResponse> {
  try {
    const payload = JwtService.verifyRefreshToken(token);

    // Fetch fresh user data — passwordHash excluded (not needed for token refresh)
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Generate new tokens
    const accessToken = JwtService.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshToken = JwtService.signRefreshToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
}
