import dotenv from "dotenv";
import { createApp } from "./app";

// Prefer repo-root .env (../.env from server/), fallback to local server/.env
dotenv.config({ path: "../.env" });
dotenv.config();

const PORT = process.env.PORT || 3000;

// Validate required environment variables at startup
const requiredEnvVars = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = createApp();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
