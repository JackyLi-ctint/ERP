import { config } from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";

// Load .env from workspace root (three levels up from server/src/__tests__/)
config({ path: path.resolve(__dirname, "../../../.env") });

// Override DATABASE_URL to use dedicated PostgreSQL test database
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/leave_management_test";

// Suppress Prisma logs during tests
export const prisma = new PrismaClient({
  log: [],
});

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
