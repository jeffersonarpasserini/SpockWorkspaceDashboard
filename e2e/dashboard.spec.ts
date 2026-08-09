import { expect, test } from "@playwright/test";

test("discovers projects and opens the real project board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Projects, agents and evidence/i })).toBeVisible();
  const qualitas = page.getByRole("article").filter({ hasText: "QualitasSystem" });
  await expect(qualitas).toBeVisible();
  await expect(qualitas.locator(".source-chip", { hasText: "OpenSpec" })).toBeVisible();
  await qualitas.getByRole("link", { name: "Open QualitasSystem" }).click();

  await expect(page.getByRole("heading", { name: "QualitasSystem", exact: true })).toBeVisible();
  await expect(page.getByLabel("Project Kanban board")).toBeVisible();
  await expect(page.locator(".kanban-column")).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "Talk to Spock" })).toBeVisible();
  await expect(page.getByText(/not an execution sandbox/i)).toBeVisible();
  await expect(page.getByLabel("Message to Spock")).toBeVisible();
});

test("keeps the mobile page inside the viewport while the board scrolls independently", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "mobile assertion");
  await page.goto("/");
  await page.getByRole("link", { name: "Open QualitasSystem" }).click();
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  const board = page.getByLabel("Project Kanban board");
  await expect(board).toBeVisible();
  expect(await board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
