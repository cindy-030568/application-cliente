import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

test("menus des abonnées : l'appli propose, la coach retouche, écrit le batch cooking et publie", async ({ page, request }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/menus");
  await expect(page.getByRole("heading", { name: "Menus de la semaine" })).toBeVisible();
  // La semaine suivante (pas celle des tests côté abonnée).
  const semaines = page.getByRole("link", { name: /Semaine du/ });
  await semaines.nth(3).click();
  await page.waitForURL(/\/coach\/menus\/\d{4}-\d{2}-\d{2}$/);
  const lundi = page.url().split("/").pop()!;
  await expect(page.getByText("Brouillon : invisible pour tes abonnées")).toBeVisible();

  // Publier un menu vide : refusé.
  await page.getByRole("button", { name: "Publier le menu" }).click();
  await expect(page.getByText(/Prépare d’abord le menu|Le menu est vide/)).toBeVisible();

  await page.getByRole("button", { name: /Proposer le menu/ }).click();
  await expect(page.getByText("Cases vides complétées ✓")).toBeVisible();
  await expect(page.getByText(/2\d repas sur 28/)).toBeVisible();
  // Elle change le dîner du mercredi, puis vide le goûter du dimanche.
  const mercredi = page.getByLabel("Mercredi, Dîner");
  const option = await mercredi.locator("option").nth(2).getAttribute("value");
  await mercredi.selectOption(option!);
  await page.getByLabel("Dimanche, Goûter").selectOption("");
  await expect(async () => {
    const { menus, repas } = await (await request.get(`${SIMULE}/__test/menus`)).json();
    const id = menus.find((m: { lundi: string }) => m.lundi === lundi).id;
    expect(repas.find((r: { menu_id: string; jour: number; repas: string }) => r.menu_id === id && r.jour === 3 && r.repas === "diner")?.recette_id).toBe(option);
    expect(repas.some((r: { menu_id: string; jour: number; repas: string }) => r.menu_id === id && r.jour === 7 && r.repas === "collation")).toBe(false);
  }).toPass();

  // Batch cooking : l'appli propose les étapes, elle les retouche.
  await page.getByRole("button", { name: /Proposer les étapes/ }).click();
  await expect(page.getByLabel("Une étape par ligne")).toHaveValue(/Faire les courses avec la liste du menu/);
  await page.getByLabel("Une étape par ligne").press("End");
  await page.getByLabel("Une étape par ligne").pressSequentially("\nPréparer ma vinaigrette maison pour la semaine.");
  await page.getByLabel("Ce que tu veux leur dire (facultatif)").fill("Une semaine pleine de couleurs 🌈");
  await page.getByRole("button", { name: "Enregistrer le mot et le batch" }).click();
  await expect(page.getByText("Enregistré ✓")).toBeVisible();
  await page.screenshot({ path: "test-results/menus-coach.png", fullPage: true });

  await page.getByRole("button", { name: "Publier le menu" }).click();
  await expect(page.getByText("Publié ✓ Tes abonnées le voient.")).toBeVisible();
  const { menus } = await (await request.get(`${SIMULE}/__test/menus`)).json();
  expect(menus.find((m: { lundi: string }) => m.lundi === lundi)).toMatchObject({ publie: true, mot: "Une semaine pleine de couleurs 🌈" });
  expect(menus.find((m: { lundi: string }) => m.lundi === lundi).batch).toMatch(/vinaigrette maison/);
  await page.goto("/coach/menus");
  await expect(page.getByRole("link", { name: /Semaine du/ }).nth(3)).toContainText("Publié");
});
