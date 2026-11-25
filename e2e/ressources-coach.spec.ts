import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

test("ressources : la coach dépose un audio (stockage privé), le publie et l'écoute en aperçu", async ({ page, request }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/ressources");
  await page.getByRole("button", { name: "Nouvelle ressource" }).click();
  await page.getByLabel("Titre").fill("Méditation du matin");
  await page.getByText("🎧 Un audio").click();
  // Sans audio : refusé.
  await page.getByRole("button", { name: "Ajouter la ressource" }).click();
  await expect(page.getByText("Ajoute le fichier audio (m4a ou mp3), ou enregistre-le ici.")).toBeVisible();
  // Un fichier qui n'est pas un audio : refusé avant l'envoi.
  await page.getByLabel("Fichier audio").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("pas un audio") });
  await expect(page.getByText(/n’est pas un audio accepté/)).toBeVisible();
  await page.getByLabel("Fichier audio").setInputFiles("e2e/audio/essai.mp3");
  await expect(page.getByText(/✓ Audio prêt : essai\.mp3/)).toBeVisible();
  await page.getByLabel("Courte description (facultatif)").fill("5 minutes pour bien commencer la journée.");
  await page.screenshot({ path: "test-results/ressources-coach-audio.png", fullPage: true });
  await page.getByRole("button", { name: "Ajouter la ressource" }).click();
  await expect(page.getByText("Ressource ajoutée.")).toBeVisible();
  const ligne = page.locator("li", { hasText: "Méditation du matin" });
  await expect(ligne).toContainText("🎧 Audio");
  const etat = await (await request.get(`${SIMULE}/__test/ressources`)).json();
  const r = etat.ressources.find((x: { titre: string }) => x.titre === "Méditation du matin");
  expect(r.audio_path).toMatch(/^[0-9a-f-]{36}\.mp3$/);
  expect(etat.audios).toContain(r.audio_path);
  // Aperçu : le lecteur, tel que la cliente l'écoutera.
  await ligne.getByRole("link", { name: /Méditation du matin/ }).click();
  await expect(page.getByRole("group", { name: "Lecteur audio : Méditation du matin" })).toBeVisible();
  await expect(page.getByText(/Écouté par 0 cliente/)).toBeVisible();

  // Suppression : l'audio part aussi du stockage.
  await page.goto("/coach/ressources");
  page.once("dialog", (d) => d.accept());
  await page.locator("li", { hasText: "Méditation du matin" }).getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Ressource supprimée.")).toBeVisible();
  expect((await (await request.get(`${SIMULE}/__test/ressources`)).json()).audios).not.toContain(r.audio_path);
});
