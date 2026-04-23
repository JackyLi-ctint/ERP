import { test, expect } from "@playwright/test";
import { TEST_USERS, loginAs } from "./helpers";

test.describe("Bulk Approval (Manager)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.manager);
  });

  test("manager can navigate to Pending Approvals page", async ({ page }) => {
    await page.click("text=Pending Approvals");
    await page.waitForURL("**/manager/pending-approvals");
    await expect(page.getByRole("heading", { name: "Pending Approvals" })).toBeVisible();
  });

  test("Pending Approvals page shows empty state or list", async ({ page }) => {
    await page.goto("/manager/pending-approvals");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("Pending Approvals")
    ).toBeVisible();
    // Either a table with requests or an empty state message
    await expect(
      page.getByRole("table")
        .or(page.getByText("No pending approvals"))
        .or(page.getByText("no pending"))
    ).toBeVisible({ timeout: 10000 });
  });

  test("employee cannot access Pending Approvals page", async ({ page }) => {
    await loginAs(page, TEST_USERS.employee);
    await page.goto("/manager/pending-approvals");
    // Should redirect away (employee role is blocked by requireRole guard)
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/manager/pending-approvals");
  });

  test("HR Admin can access Pending Approvals page", async ({ page }) => {
    await loginAs(page, TEST_USERS.hrAdmin);
    await page.goto("/manager/pending-approvals");
    await expect(page.getByRole("heading", { name: "Pending Approvals" })).toBeVisible();
  });

  test("select-all checkbox toggles all row checkboxes", async ({ page }) => {
    await page.goto("/manager/pending-approvals");
    await page.waitForLoadState("networkidle");

    // Count visible request rows
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip(); // No requests to test with
      return;
    }

    // Click the header checkbox (select all)
    await page.locator('thead input[type="checkbox"]').check();

    // All row checkboxes should now be checked
    const rowCheckboxes = page.locator('tbody input[type="checkbox"]');
    const allCount = await rowCheckboxes.count();
    for (let i = 0; i < allCount; i++) {
      await expect(rowCheckboxes.nth(i)).toBeChecked();
    }

    // The "Approve Selected" button should appear
    await expect(page.getByRole("button", { name: "Approve Selected" })).toBeVisible();
  });

  test("Approve Selected button appears when rows are selected", async ({ page }) => {
    await page.goto("/manager/pending-approvals");
    await page.waitForLoadState("networkidle");

    const firstRowCheckbox = page.locator('tbody input[type="checkbox"]').first();
    const rowCount = await page.locator('tbody tr').count();
    if (rowCount === 0) {
      test.skip(); // No requests to test with
      return;
    }

    // Initially no bulk action bar
    await expect(page.getByRole("button", { name: "Approve Selected" })).not.toBeVisible();

    // Check one row
    await firstRowCheckbox.check();

    // "Approve Selected" should now be visible
    await expect(page.getByRole("button", { name: "Approve Selected" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject Selected" })).toBeVisible();
  });

  test("unchecking all hides the bulk action bar", async ({ page }) => {
    await page.goto("/manager/pending-approvals");
    await page.waitForLoadState("networkidle");

    const rowCount = await page.locator('tbody tr').count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const firstRowCheckbox = page.locator('tbody input[type="checkbox"]').first();
    await firstRowCheckbox.check();
    await expect(page.getByRole("button", { name: "Approve Selected" })).toBeVisible();

    // Uncheck it
    await firstRowCheckbox.uncheck();
    await expect(page.getByRole("button", { name: "Approve Selected" })).not.toBeVisible();
  });
});
