import { test, expect } from "@playwright/test";
import { TEST_USERS, loginAs, logout } from "./helpers";

test.describe("Authentication", () => {
  test("shows login page at root when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });

  test("shows login page at /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email-address")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("shows Sign in with Microsoft button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in with Microsoft")).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email-address", "nobody@example.com");
    await page.fill("#password", "wrongpassword");
    await page.click('button[type="submit"]');
    // Error message should appear without navigating away
    await expect(page.locator("text=Invalid email or password").or(
      page.locator("[class*='red']")
    )).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain("/login");
  });

  test("employee can log in and see dashboard", async ({ page }) => {
    await loginAs(page, TEST_USERS.employee);
    await expect(page.getByText(`Welcome, ${TEST_USERS.employee.name}`)).toBeVisible();
  });

  test("manager can log in and see dashboard", async ({ page }) => {
    await loginAs(page, TEST_USERS.manager);
    await expect(page.getByText(`Welcome, ${TEST_USERS.manager.name}`)).toBeVisible();
  });

  test("HR admin can log in and see dashboard", async ({ page }) => {
    await loginAs(page, TEST_USERS.hrAdmin);
    await expect(page.getByText(`Welcome, ${TEST_USERS.hrAdmin.name}`)).toBeVisible();
  });

  test("protected routes redirect to /login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
  });

  test("user can log out and is redirected to login", async ({ page }) => {
    await loginAs(page, TEST_USERS.employee);
    await logout(page);
    await expect(page.locator("#email-address")).toBeVisible();
  });
});
