import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";
const AUDIO = "eeeeeeee-0000-0000-0000-000000000005";

test("ressources : recherche sans accents, jamais une ressource qui n'est pas pour elle, filtres et favoris", async ({ page }) => {
  await seConnecter(page, "sophie@exemple.fr");
  await page.goto("/ressources");
  await fermerMotDuJour(page);
  const recherche = page.getByRole("searchbox", { name: "Chercher dans mes ressources" });
  // Accents et majuscules : « MAGNESIUM » trouve « Magnésium » (dans la description).
  await recherche.fill("MAGNESIUM");
  await recherche.press("Enter");
  await expect(page.getByText("1 ressource pour « MAGNESIUM »")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ebook compléments/ })).toBeVisible();
  // Une ressource réservée à une autre cliente n'est jamais trouvée.
  await recherche.fill("perimenopause");
  await recherche.press("Enter");
  await expect(page.getByText("Rien trouvé pour « perimenopause ». Essaie un autre mot.")).toBeVisible();
  await expect(page.getByText("Guide périménopause")).toHaveCount(0);

  // Filtres : « À écouter », puis une catégorie.
  await page.getByRole("link", { name: "Toutes" }).click();
  await expect(page).toHaveURL(/\/ressources$/);
  await page.getByRole("link", { name: "🎧 À écouter" }).click();
  await expect(page).toHaveURL(/ecouter=1/);
  await expect(page.getByRole("link", { name: /Respirer avant de manger/ })).toContainText("Audio · 1 min");
  await expect(page.getByText("Guide : bien démarrer")).toHaveCount(0);
  await page.getByRole("link", { name: "Toutes" }).click();
  await expect(page).toHaveURL(/\/ressources$/);
  await page.getByRole("link", { name: "Listes de courses" }).click();
  await expect(page).toHaveURL(/categorie=/);
  await expect(page.getByRole("link", { name: /Liste de courses de base/ })).toBeVisible();
  await expect(page.getByText("Respirer avant de manger")).toHaveCount(0);

  // Favoris.
  await page.getByRole("link", { name: "Toutes" }).click();
  await expect(page).toHaveURL(/\/ressources$/);
  await page.getByRole("button", { name: "Ajouter « Guide : bien démarrer » à mes favoris" }).click();
  await expect(page.getByRole("button", { name: "Retirer « Guide : bien démarrer » de mes favoris" })).toBeVisible();
  await page.getByRole("link", { name: "♥ Mes favoris" }).click();
  await expect(page).toHaveURL(/favoris=1/);
  await expect(page.getByRole("link", { name: /Guide : bien démarrer/ })).toBeVisible();
  await expect(page.getByText("Respirer avant de manger")).toHaveCount(0);
  await page.screenshot({ path: "test-results/ressources-favoris.png", fullPage: true });
  await page.getByRole("button", { name: "Retirer « Guide : bien démarrer » de mes favoris" }).click();
  await page.goto("/ressources");
  await page.screenshot({ path: "test-results/ressources-cliente.png", fullPage: true });
});

test("audio : lecture, ±15 s, vitesse, et reprise là où elle s'est arrêtée (sur son compte)", async ({ page, request }) => {
  await seConnecter(page, "sophie@exemple.fr");
  await page.goto(`/ressources/${AUDIO}`);
  await fermerMotDuJour(page);
  const lecteur = page.getByRole("group", { name: "Lecteur audio : Respirer avant de manger" });
  await expect(lecteur).toBeVisible();
  await lecteur.getByRole("button", { name: /Vitesse de lecture : 1 fois/ }).click();
  await expect(lecteur.getByRole("button", { name: /Vitesse de lecture : 1,25 fois/ })).toBeVisible();
  await lecteur.getByRole("button", { name: /Vitesse de lecture/ }).click();
  await expect(lecteur.getByRole("button", { name: /Vitesse de lecture : 1,5 fois/ })).toBeVisible();
  await lecteur.getByRole("button", { name: "Lecture", exact: true }).click();
  await expect(lecteur.getByRole("button", { name: "Pause" })).toBeVisible();
  await lecteur.getByRole("button", { name: "Avancer de 15 secondes" }).click();
  await expect(lecteur.getByText(/^0:1[5-9]$/)).toBeVisible();
  await lecteur.getByRole("button", { name: "Reculer de 15 secondes" }).click();
  await expect(lecteur.getByText(/^0:0\d$/).first()).toBeVisible();
  await lecteur.getByRole("slider", { name: "Position dans l’audio" }).fill("8");
  await lecteur.getByRole("button", { name: "Pause" }).click();
  await page.screenshot({ path: "test-results/ressources-audio.png", fullPage: true });
  // La position est gardée sur son compte : elle reprend au même endroit, même ailleurs.
  await expect
    .poll(async () => (await (await request.get(`${SIMULE}/__test/ressources`)).json()).ecoutes.find((e: { ressource_id: string }) => e.ressource_id === AUDIO)?.position_s ?? 0)
    .toBeGreaterThanOrEqual(8);
  await page.reload();
  await expect(page.getByText(/Tu reprends où tu t’étais arrêtée \(0:\d\d\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reprendre la lecture" })).toBeVisible();
  await page.goto("/ressources");
  await expect(page.getByRole("link", { name: /Respirer avant de manger/ })).toContainText(/reprendre à 0:\d\d/);
});
