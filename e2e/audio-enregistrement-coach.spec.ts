import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

// Faux micro de Chromium : un son de test, sans demander la permission.
test.use({ permissions: ["microphone"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });

test("la coach s'enregistre ici : le micro n'est autorisé que sur sa page Ressources", async ({ page, request }) => {
  await seConnecter(page, "coach@exemple.fr");
  const reponse = await page.goto("/coach/ressources");
  expect(reponse?.headers()["permissions-policy"]).toContain("microphone=(self)");
  expect((await request.get("/")).headers()["permissions-policy"]).toContain("microphone=()");
  await page.getByRole("button", { name: "Nouvelle ressource" }).click();
  await page.getByLabel("Titre").fill("Mon conseil du jour");
  await page.getByText("Une fiche écrite ici").click();
  await page.getByLabel("Contenu de la fiche").fill("Bois un grand verre d’eau au réveil.");
  await page.getByRole("button", { name: "🎙 M’enregistrer ici" }).click();
  await expect(page.getByText(/Enregistrement… 0:0[1-9]/)).toBeVisible();
  await page.getByRole("button", { name: "■ Arrêter" }).click();
  await expect(page.getByText(/✓ Audio prêt : enregistrement\.(m4a|webm)/)).toBeVisible();
  await page.getByRole("button", { name: "Ajouter la ressource" }).click();
  await expect(page.getByText("Ressource ajoutée.")).toBeVisible();
  await expect(page.locator("li", { hasText: "Mon conseil du jour" })).toContainText("fiche + audio");
  const etat = await (await request.get(`${SIMULE}/__test/ressources`)).json();
  expect(etat.ressources.find((x: { titre: string }) => x.titre === "Mon conseil du jour").audio_path).toMatch(/\.(m4a|webm)$/);
});
