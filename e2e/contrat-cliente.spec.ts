import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

test("première connexion : la cliente lit et accepte le contrat avant d'entrer", async ({ page, request }) => {
  await request.post(`${SIMULE}/__test/contrat`, { data: { actif: true } });
  try {
    await seConnecter(page, "sophie@exemple.fr");
    await page.waitForURL(/\/contrat/);
    await expect(page.getByRole("heading", { name: "Ton contrat d’accompagnement" })).toBeVisible();
    await expect(page.getByLabel("Texte du contrat")).toContainText("Article 1 - Objet");
    // Les deux cases sont obligatoires.
    await page.getByLabel(/J’ai lu et j’accepte le contrat ci-dessus \(version 1\)/).check();
    await page.getByRole("button", { name: /J’accepte et je commence/ }).click();
    await expect(page).toHaveURL(/\/contrat/);
    await page.getByLabel(/Je demande que mon accompagnement commence immédiatement/).check();
    await page.screenshot({ path: "test-results/contrat-cliente.png", fullPage: true });
    await page.getByRole("button", { name: /J’accepte et je commence/ }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await fermerMotDuJour(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour Sophie");
    // Une fois accepté, plus de détour par le contrat.
    await page.goto("/suivi");
    await expect(page).toHaveURL(/\/suivi$/);
  } finally {
    await request.post(`${SIMULE}/__test/contrat`, { data: { actif: false } });
  }
});
