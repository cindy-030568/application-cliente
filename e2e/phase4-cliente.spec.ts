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
