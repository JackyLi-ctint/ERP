import { test, expect } from "@playwright/test";
import { TEST_USERS, loginAs } from "./helpers";

test.describe("Leave Request Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.employee);
  });

  test("employee can navigate to Apply for Leave page", async ({ page }) => {
    await page.click("text=Apply Leave");
    await page.waitForURL("**/apply-leave");
    await expect(page.getByRole("heading", { name: "Apply for Leave" })).toBeVisible();
  });

  test("leave application form has required fields", async ({ page }) => {
    await page.goto("/apply-leave");
    await expect(page.getByText("Leave Type *")).toBeVisible();
    await expect(page.getByText("Start Date *")).toBeVisible();
    await expect(page.getByText("End Date *")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit Leave Request" })).toBeVisible();
  });

  test("submitting without leave type shows validation error or blocked", async ({ page }) => {
    await page.goto("/apply-leave");
    // Set dates but leave the leave type empty
    const futureDate = getFutureDate(7);
    await page.getByLabel("Start Date *").fill(futureDate);
    await page.getByLabel("End Date *").fill(futureDate);
    await page.getByRole("button", { name: "Submit Leave Request" }).click();
    // Should not navigate away — validation should block submission
    expect(page.url()).toContain("/apply-leave");
  });

  test("employee can submit a leave request successfully", async ({ page }) => {
    await page.goto("/apply-leave");

    // Wait for leave types to load
    await page.waitForFunction(
      () =>
        document.querySelector("select")?.options?.length > 1,
      { timeout: 10000 }
    );

    // Select first available leave type
    const select = page.locator("select").first();
    const options = await select.locator("option").all();
    // Find first option that is not the placeholder
    const nonEmpty = options.find(async (o) => {
      const val = await o.getAttribute("value");
      return val && val !== "";
    });
    if (!nonEmpty) {
      test.skip();
      return;
    }
    await select.selectOption({ index: 1 });

    // Set dates 14 days in future
    const startDate = getFutureDate(14);
    const endDate = getFutureDate(14);
    await page.locator('input[type="date"]').first().fill(startDate);
    await page.locator('input[type="date"]').last().fill(endDate);

    await page.getByRole("button", { name: "Submit Leave Request" }).click();

    // Expect success message or the request to appear in the list
    await expect(
      page.getByText("Leave request submitted successfully!")
        .or(page.getByText("PENDING"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("leave history shows existing requests with status", async ({ page }) => {
    await page.goto("/apply-leave");
    await page.waitForLoadState("networkidle");
    // The table or empty state should be visible
    await expect(
      page.getByText("My Leave Requests")
        .or(page.getByText("No leave requests"))
        .or(page.getByText("No leave requests match the filters."))
    ).toBeVisible({ timeout: 10000 });
  });

  test("half day checkbox reveals AM/PM period selector", async ({ page }) => {
    await page.goto("/apply-leave");
    // AM/PM radios should NOT be visible initially
    await expect(page.getByText("Morning (AM)")).not.toBeVisible();
    // Check the half day checkbox
    await page.locator("#halfDay").check();
    // Now AM/PM should be visible
    await expect(page.getByText("Morning (AM)")).toBeVisible();
    await expect(page.getByText("Afternoon (PM)")).toBeVisible();
  });
});

// Helper: returns a 'YYYY-MM-DD' date N days from today
function getFutureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}
