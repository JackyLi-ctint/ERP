import { Page } from "@playwright/test";

export const TEST_USERS = {
  employee: { email: "diana@company.com", password: "SecurePass012", name: "Diana Employee" },
  employee2: { email: "eve@company.com", password: "SecurePass345", name: "Eve Employee" },
  manager: { email: "charlie@company.com", password: "SecurePass789", name: "Charlie Manager" },
  hrAdmin: { email: "alice@company.com", password: "SecurePass123", name: "Alice HR Admin" },
};

/**
 * Log in via the UI and wait for the dashboard to load.
 */
export async function loginAs(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  await page.goto("/login");
  await page.fill("#email-address", user.email);
  await page.fill("#password", user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");
}

/**
 * Log out by navigating to /login (the app redirects unauthenticated users
 * automatically; this clears localStorage to force that path).
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("refreshToken");
  });
  await page.goto("/login");
  await page.waitForURL("**/login");
}
