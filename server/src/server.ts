import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import logger from "./lib/logger";

// Prefer repo-root .env (../.env from server/), fallback to local server/.env
dotenv.config({ path: "../.env" });
dotenv.config();

const PORT = process.env.PORT || 3000;

// Validate required environment variables at startup
const requiredEnvVars = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.fatal(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const prisma = new PrismaClient();
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info("Server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
