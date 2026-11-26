import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

test("cuisine de l'abonnée : menu du jour, menu de la semaine, batch cooking, liste de courses et « Avec ce que j'ai »", async ({ page, request }) => {
  await request.get(`${SIMULE}/__test/menus?demo=1`);
  // Une nouvelle abonnée (paiement Stripe simulé).
  await page.goto("/abonnement");
  await page.getByLabel("Ton prénom").fill("Inès");
  await page.getByLabel("Ton adresse email").fill("ines@exemple.fr");
  await page.getByLabel("J’accepte les conditions de vente").check();
  await page.getByLabel("Je veux accéder à mon espace tout de suite").check();
  await page.getByRole("button", { name: "Continuer vers le paiement sécurisé" }).click();
  await page.getByRole("button", { name: "Payer" }).click();
  await page.waitForURL(/\/abonnement\/merci/);
  await seConnecter(page, "ines@exemple.fr");
  await page.waitForURL(/\/espace$/);
  await fermerMotDuJour(page);

  // Accueil : ce qu'il y a au menu aujourd'hui.
  await expect(page.getByRole("link", { name: /Au menu aujourd’hui/ })).toContainText("Déjeuner");

  // Recettes → Mon menu.
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Recettes" }).click();
  await page.getByRole("navigation", { name: "Ma cuisine" }).getByRole("link", { name: /Mon menu/ }).click();
  await expect(page.getByRole("heading", { name: "Mon menu de la semaine" })).toBeVisible();
  await expect(page.getByText("Cette semaine, on mise sur les légumes de saison 🥕")).toBeVisible();
  await expect(page.getByText("Aujourd’hui", { exact: true })).toBeVisible();
  // Batch cooking : les étapes se cochent.
  const etape = page.getByRole("checkbox", { name: /Cuire le riz et le quinoa/ });
  await etape.check();
  await expect(etape).toBeChecked();
  await page.screenshot({ path: "test-results/menu-abonnee.png", fullPage: true });

  // Liste de courses du menu, pour 2 personnes.
  await page.getByRole("button", { name: "Une personne de plus" }).click();
  await expect(page.getByText("2 personnes")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter le menu à ma liste de courses" }).click();
  await expect(page.getByText(/articles? ajoutés? à ta liste de courses ✓/)).toBeVisible();
  await page.getByRole("link", { name: "Voir ma liste" }).click();
  await expect(page.getByRole("heading", { name: "Ma liste de courses" })).toBeVisible();
  await expect(page.getByText("Fruits & légumes")).toBeVisible();
  await expect(page.getByText(/Menu de la semaine du/)).toBeVisible();
  await page.screenshot({ path: "test-results/courses-abonnee.png", fullPage: true });

  // Avec ce que j'ai : rien coché, puis tout coché → des recettes faisables.
  await page.goto("/espace/recettes/frigo");
  await expect(page.getByText("Coche quelques ingrédients pour voir mes idées.")).toBeVisible();
  await expect(page.getByText("Sel blanc", { exact: true })).toHaveCount(0);
  await page.locator("fieldset input[type=checkbox]").first().check({ force: true });
  await expect(page.getByText(/\(1\)/)).toBeVisible();
  await page.locator("fieldset input[type=checkbox]").evaluateAll((cases) => cases.forEach((c) => !(c as HTMLInputElement).checked && (c as HTMLInputElement).click()));
  await expect(page.getByRole("heading", { name: /Tu as tout ✓/ })).toBeVisible();
  await page.screenshot({ path: "test-results/frigo-abonnee.png", fullPage: true });
  // Ses cases restent cochées au retour.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Tu as tout ✓/ })).toBeVisible();
});
