import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

const SEANCE = {
  nom: "Renfo express",
  duree: "20 min",
  echauffement: "2 min de marche sur place",
  blocs: [
    { titre: "Circuit", format: "3 tours – repos 1 min entre les tours", exercices: [{ nom: "Squats", series: null, repetitions: "15", charge: null, repos: null, tempo: null, consignes: null }, { nom: "Pompes sur les genoux", series: null, repetitions: "10", charge: null, repos: null, tempo: null, consignes: null }] },
    { titre: "Finisher", format: "Tabata", exercices: [{ nom: "Gainage", series: null, repetitions: "20 s", charge: null, repos: null, tempo: null, consignes: null }] },
  ],
  retour_au_calme: "Étirements 3 min",
  notes: null,
};

test("séances express : la coach colle une séance de Claude, la règle, la teste et la publie", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/seances-express");
  await expect(page.getByRole("button", { name: "Copier la consigne" })).toBeVisible();
  await page.getByRole("link", { name: /Nouvelle séance/ }).click();
  await page.getByLabel("Titre").fill("Renfo express 20 min");
  await page.getByLabel("Durée").selectOption("20");
  await page.getByLabel("Type").selectOption("Renfo");
  await page.getByLabel("Niveau").selectOption("intermediaire");
  await page.getByText("Tapis", { exact: true }).click();
  await page.getByLabel("La séance, collée depuis Claude").fill("Voici la séance :\n```json\n" + JSON.stringify(SEANCE) + "\n```");
  await page.getByRole("button", { name: "Créer la séance" }).click();
  await page.waitForURL(/\/coach\/seances-express\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Renfo express 20 min");
  await expect(page.getByText("Brouillon : invisible pour tes clientes")).toBeVisible();
  await expect(page.getByText("Pompes sur les genoux").first()).toBeVisible();
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText("Publiée ✓")).toBeVisible();
  // Modifier la description ensuite ne la repasse pas en brouillon.
  await page.getByLabel("Petite description (facultatif)").fill("20 minutes pour tout le corps, à la maison.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Séance enregistrée ✓")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Brouillon : invisible pour tes clientes")).toHaveCount(0);
  await page.screenshot({ path: "test-results/express-coach.png", fullPage: true });
  await page.getByRole("link", { name: /Tester le mode séance/ }).click();
  await expect(page.getByText("Aperçu : ta cliente voit exactement cet écran")).toBeVisible();
});

test("séances express : listes de matériel dans Réglages, et accès à vie après le suivi sur la fiche", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/reglages#seances-express");
  const carte = page.locator("#seances-express");
  await expect(carte.getByLabel("Matériel (un par ligne)")).toHaveValue(/Kettlebell/);
  await carte.getByLabel("Matériel (un par ligne)").fill("Aucun\nTapis\nÉlastique\nBouteilles d’eau");
  await carte.getByRole("button", { name: "Enregistrer les listes" }).click();
  await expect(carte.getByText("Listes enregistrées ✓")).toBeVisible();
  // Isabelle a terminé son suivi : accès à vie, sans date à remplir.
  await page.goto("/coach/clientes/00000000-0000-0000-0000-0000000000b4");
  await expect(page.getByRole("main").getByText(/accès à vie/)).toBeVisible();
  await page.getByRole("main").getByText("Séances express", { exact: true }).click();
  await expect(page.getByText(/pendant son suivi et à vie ensuite/)).toBeVisible();
  await expect(page.getByLabel(/Accès après la fin de son suivi/)).toHaveCount(0);
});
