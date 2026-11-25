import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

test("défis du mois : la coach crée un défi avec l'aperçu de la règle, le publie et suit les participantes", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/defis");
  await expect(page.getByRole("heading", { name: "Mes défis" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Bouger un peu plus chaque jour/ })).toContainText("En cours");
  await expect(page.getByRole("link", { name: /Brouillon sommeil/ })).toContainText("Brouillon");

  await page.getByRole("link", { name: /Nouveau défi/ }).click();
  await page.getByLabel("Titre").fill("Des nuits qui font du bien");
  await page.getByText("😴 Sommeil").click();
  await expect(page.getByLabel("Heures de sommeil par nuit")).toHaveValue("7");
  await page.getByLabel("Heures de sommeil par nuit").fill("7,5");
  await expect(page.getByText(/^😴 7 h 30 de sommeil ou plus, au moins \d+ nuits, du /)).toBeVisible();
  await page.getByLabel("Nombre de nuits à réussir").fill("12");
  await expect(page.getByText(/au moins 12 nuits/)).toBeVisible();
  await page.getByText("Les membres de la communauté").click();
  await page.getByLabel(/Publié tout de suite/).check();
  await page.screenshot({ path: "test-results/defis-coach-nouveau.png", fullPage: true });
  await page.getByRole("button", { name: "Créer le défi" }).click();
  await page.waitForURL(/\/coach\/defis\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Des nuits qui font du bien");
  await expect(page.getByText("Publié", { exact: true })).toBeVisible();

  // Un défi existant : la liste des participantes et sa modification.
  await page.goto("/coach/defis/d3f10000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: "Participantes" })).toBeVisible();
  await page.getByLabel("Nombre de jours à réussir").fill("99");
  await page.getByRole("button", { name: "Enregistrer" }).evaluate((b: HTMLButtonElement) => b.form?.setAttribute("novalidate", ""));
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/Ce défi compte 31 jours : l’objectif ne peut pas être plus grand/)).toBeVisible();
  await page.screenshot({ path: "test-results/defis-coach.png", fullPage: true });
});
