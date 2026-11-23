import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SOPHIE = "sophie@exemple.fr";

test("connexion d'une cliente avec le code reçu par email", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await expect(page.getByRole("dialog")).toContainText("Ton petit mot du jour");
  await fermerMotDuJour(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour Sophie");
});

test("un mauvais code est refusé", async ({ page }) => {
  await page.goto("/connexion", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Recevoir un code par email" }).click();
  // Le formulaire « code » remplace celui du mot de passe : on attend qu'il soit là avant de taper.
  await expect(page.getByRole("button", { name: "Recevoir mon code" })).toBeVisible();
  await page.getByLabel("Ton adresse email").fill(SOPHIE);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByLabel("Code reçu par email")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Code reçu par email").fill("000000");
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page.getByText("Ce code ne fonctionne pas ou a expiré")).toBeVisible();
});

test("envoi d'un bilan", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/suivi/bilan");
  await page.getByLabel(/^Poids/).fill("67,4");
  await page.getByLabel("2 ou 3 victoires que tu veux célébrer").fill("3 séances faites et de belles nuits");
  // Pas de photos : l'app demande confirmation avant d'envoyer.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Envoyer mon bilan/ }).click();
  await page.waitForURL(/\/suivi\/[0-9a-f-]{36}\?envoye=1/);
  await expect(page.getByText("3 séances faites et de belles nuits")).toBeVisible();
});

test("consultation d'une recette adaptée à ses cibles", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/recettes");
  await page.getByRole("link", { name: /Déjeuner/ }).first().click();
  const recette = page.locator("a[href^='/recettes/'][href*='repas=']").first();
  await expect(recette).toBeVisible();
  await recette.click();
  await expect(page.getByText("Quantités crues, à peser avant cuisson.")).toBeVisible();
  await expect(page.getByText(/\d+\s?g\b/).first()).toBeVisible();
});
