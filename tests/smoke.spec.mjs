import { expect, test } from "@playwright/test";

test("homepage renders main sections", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toHaveText("Shanor");
  await expect(page.locator(".panel-discord h2")).toHaveText("Discord");
  await expect(page.locator(".panel-projects h2")).toHaveText("Projects");
});

test("discord invite link is visible and correct", async ({ page }) => {
  await page.goto("/");

  const inviteLink = page.getByRole("link", { name: "Join ZCatch Community" });
  await expect(inviteLink).toBeVisible();
  await expect(inviteLink).toHaveAttribute("href", "https://discord.gg/7YV9u5r5BZ");
});

test("clicking launcher spawns a grenade projectile", async ({ page }) => {
  await page.goto("/");

  await page.locator(".tee-weapon-button").click({ force: true });
  await expect(page.locator(".grenade-projectile")).toHaveCount(1);
});
