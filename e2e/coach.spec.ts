import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

test("la coach consulte le bilan d'une cliente", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await expect(page).toHaveURL(/\/coach/);
  await page.goto("/coach/bilans");
  await page.locator("a[href^='/coach/bilans/']").first().click();
  await expect(page).toHaveURL(/\/coach\/bilans\/[0-9a-f-]{36}/);
  await expect(page.getByText(/Nathalie|Sophie/).first()).toBeVisible();
  await expect(page.getByText("Ton niveau d’énergie").first()).toBeVisible();
});

test("la sauvegarde contient toutes les tables prévues", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  const reponse = await page.request.get("/coach/sauvegarde");
  expect(reponse.ok()).toBe(true);
  expect(reponse.headers()["content-disposition"]).toMatch(/sauvegarde-fitw-cindy-\d{4}-\d{2}-\d{2}\.json/);
  const fichier = await reponse.json();
  for (const table of ["plans_alimentaires", "programmes_sportifs", "seances_faites", "messages_communaute", "revenus_divers"]) {
    expect(Object.keys(fichier.donnees)).toContain(table);
  }
  expect(Object.keys(fichier.tables_exclues)).toEqual(["courses", "metabolisme", "abonnements_push", "abonnements_coach"]);
  expect(Object.keys(fichier.donnees)).not.toContain("courses");
});

test("Réglages : la coach voit quand la tâche du matin a tourné", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/reglages");
  const ligne = page.getByText(/Tâche du matin : dernier passage/);
  await expect(ligne).toContainText("horloge Supabase");
  await expect(ligne).toContainText("✓ terminée");
  await ligne.screenshot({ path: "test-results/tache-du-matin.png" });
});
