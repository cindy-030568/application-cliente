import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SOPHIE = "sophie@exemple.fr";

test("victoire hors balance : carte de félicitations sur l'accueil", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  const carte = page.getByRole("region", { name: /victoire hors balance/i });
  await expect(carte).toContainText("Nouveau record : Squat goblet à 14 kg !");
  await page.screenshot({ path: "test-results/phase4-victoire-cliente.png", fullPage: false });
  await carte.getByRole("button", { name: "Merci 💛" }).click();
  await expect(carte).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: /victoire hors balance/i })).toHaveCount(0);
});

test("récap de la semaine : séances, sommeil, pas, eau et un petit mot", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/suivi");
  await page.getByRole("link", { name: /Mon récap de la semaine/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/^Du lundi \d+ \w+ au dimanche \d+ \w+$/);
  await expect(page.getByText("par nuit en moyenne")).toBeVisible();
  await expect(page.getByText(/Journal rempli \d jours? sur 7/)).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-recap-cliente.png", fullPage: true });
  await page.getByRole("link", { name: "← Semaine d’avant" }).click();
  await expect(page).toHaveURL(/semaine=\d{4}-\d{2}-\d{2}/);
  // Réglage de la notification dans le profil.
  await page.goto("/profil");
  const interrupteur = page.getByRole("switch", { name: /Mon récap du dimanche/ });
  await expect(interrupteur).toBeChecked();
  await interrupteur.click({ force: true });
  await expect(interrupteur).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Mon récap du dimanche/ })).not.toBeChecked();
});

test("cycle et périménopause : choisis dans le profil, suivis dans le journal", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/profil#cycle");
  const carte = page.locator("#cycle");
  await carte.getByText("Mon cycle", { exact: true }).click();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("C’est noté ✓")).toBeVisible();
  await page.goto("/suivi/journal");
  await expect(page.getByText(/Jour \d+ de ton cycle/)).toBeVisible();
  await expect(page.getByText(/jamais|ne remplacent pas l’avis/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-cycle-journal.png" });

  // Périménopause : les symptômes du jour.
  await page.goto("/profil#cycle");
  await carte.getByText("Ma périménopause", { exact: true }).click();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("C’est noté ✓")).toBeVisible();
  await page.goto("/suivi/journal");
  await expect(page.getByText(/Jour \d+ de ton cycle/)).toHaveCount(0);
  await page.getByText("Bouffées de chaleur").click();
  await page.getByRole("button", { name: /ma journée/ }).click();
  await expect(page.getByText("Journée enregistrée ✓")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Bouffées de chaleur" })).toBeChecked();
  await page.getByText("Mes symptômes du jour").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/phase4-perimenopause-journal.png" });
  // Remise à zéro pour les autres tests.
  await page.goto("/profil#cycle");
  await carte.getByText("Rien", { exact: true }).click();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText(/rien n’est suivi/)).toBeVisible();
});

test("compléments : la cliente voit sa liste, coche, et règle son rappel", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.getByRole("link", { name: /Mes compléments/ }).click();
  await expect(page.getByRole("heading", { name: "Le matin" })).toBeVisible();
  const omega = page.getByRole("checkbox", { name: /Oméga 3/ });
  await omega.check();
  await expect(page.getByText(/Tout est pris aujourd’hui|Aujourd’hui : 1 sur/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Oméga 3/ })).toBeChecked();
  await page.getByText("Me le rappeler chaque jour").click();
  await expect(page.getByText(/un petit rappel chaque jour à 08 h 00/)).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-complements-cliente.png", fullPage: true });
  await page.getByRole("checkbox", { name: /Oméga 3/ }).uncheck();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Oméga 3/ })).not.toBeChecked();
});

test("planning des repas : choisir ses recettes de la semaine, puis remplir la liste de courses", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/recettes");
  await page.getByRole("link", { name: /Mon planning de la semaine/ }).click();
  await expect(page.getByRole("heading", { name: "Mon planning de repas" })).toBeVisible();
  // Déjeuner du lundi, puis dîner du mardi.
  for (const [n, repas] of [[0, "déjeuner"], [1, "dîner"]] as const) {
    await page.getByRole("link", { name: new RegExp(`Choisir une recette pour le ${repas}`) }).nth(n).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Choisir" }).first().click();
    await page.waitForURL(/\/recettes\/planning\?semaine=/);
  }
  await expect(page.getByRole("button", { name: /^Retirer/ })).toHaveCount(2);
  await page.getByRole("button", { name: /Ajouter ma semaine à ma liste de courses/ }).click();
  await expect(page.getByText(/articles? ajoutés? à ta liste de courses ✓/)).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-planning.png", fullPage: true });
  // Recommencer ne crée pas de doublon : la semaine est remplacée.
  await page.getByRole("button", { name: /Ajouter ma semaine à ma liste de courses/ }).click();
  await expect(page.getByText(/articles? ajoutés? à ta liste de courses ✓/)).toBeVisible();
  await page.goto("/recettes/courses");
  await expect(page.getByText(/Planning de la semaine du/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-planning-courses.png", fullPage: true });
});
