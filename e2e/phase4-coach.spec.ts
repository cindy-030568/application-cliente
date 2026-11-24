import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

test("victoire hors balance : ligne dans le tableau de bord, avec un mot prêt à envoyer", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach");
  const ligne = page.locator("li", { hasText: "Victoire 🏆" }).first();
  await expect(ligne).toContainText("Nouveau record : Squat goblet à 14 kg");
  await expect(ligne).toContainText("Squat goblet : 14 kg (avant 10 kg)");
  await expect(ligne.getByRole("textbox")).toHaveValue(/Bravo Sophie ! Nouveau record sur Squat goblet \(14 kg\)/);
  await ligne.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/phase4-victoire-coach.png", fullPage: false });
});
