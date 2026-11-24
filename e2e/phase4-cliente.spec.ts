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
