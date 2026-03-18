// jest.global-setup.js
// Runs once before all test suites.
// Resets and pushes the Prisma schema to the PostgreSQL test database.
const { execSync } = require("child_process");
const path = require("path");

module.exports = async function globalSetup() {
  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/leave_management_test";

  execSync("npx prisma db push --force-reset --accept-data-loss", {
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
    },
    cwd: path.resolve(__dirname),
    stdio: "inherit",
  });
};
