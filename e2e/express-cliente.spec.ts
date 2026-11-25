import { expect, test, type Page } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";
const SOPHIE = "sophie@exemple.fr";
const CARDIO = "e5000000-0000-4000-8000-000000000001";

async function allerAuBout(page: Page) {
  for (let i = 0; i < 30; i++) {
    if (await page.getByRole("button", { name: "Valider ma séance" }).isVisible().catch(() => false)) return;
    const bouton = page.getByRole("button", { name: /^(Commencer|C’est parti|Démarrer|Fait ✓|Série faite|Passer le repos|Passer|Terminer|Suivant|Exercice suivant)/ }).first();
    await bouton.click();
  }
}

test("séances express : « Pas le temps aujourd'hui ? », filtres, favori et séance libre enregistrée à part", async ({ page, request }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.getByRole("link", { name: /Pas le temps aujourd’hui \?/ }).click();
  await expect(page.getByRole("heading", { name: "Séances express" })).toBeVisible();
  await expect(page.getByText("Cardio salon sans matériel")).toBeVisible();
  await expect(page.getByText("Brouillon pas prêt")).toHaveCount(0);
  // Filtres : 15 min, puis sans matériel.
  await page.getByRole("link", { name: "15 min" }).click();
  await expect(page.getByText("Mobilité du dos au tapis")).toBeVisible();
  await expect(page.getByText("Cardio salon sans matériel")).toHaveCount(0);
  await page.getByRole("link", { name: "Toutes" }).click();
  await page.getByRole("link", { name: "Sans matériel" }).click();
  await expect(page.getByText("Cardio salon sans matériel")).toBeVisible();
  await expect(page.getByText("Mobilité du dos au tapis")).toHaveCount(0);
  // Favori.
  await page.getByRole("button", { name: "Ajouter « Cardio salon sans matériel » à mes favoris" }).click();
  await expect(page.getByRole("button", { name: "Retirer « Cardio salon sans matériel » de mes favoris" })).toBeVisible();
  await page.goto("/seances-express?favoris=1");
  await expect(page.getByText("Cardio salon sans matériel")).toBeVisible();
  await expect(page.getByText("Mobilité du dos au tapis")).toHaveCount(0);
  await page.goto("/seances-express");
  await page.screenshot({ path: "test-results/express-liste.png", fullPage: true });

  // La séance en mode guidé, enregistrée comme séance libre.
  const avant = (await (await request.get(`${SIMULE}/__test/seances`)).json()).length;
  await page.locator("li", { hasText: "Cardio salon sans matériel" }).getByRole("link", { name: /C’est parti/ }).click();
  await page.waitForURL(`**/seance/express/${CARDIO}`);
  await allerAuBout(page);
  await page.getByRole("button", { name: "Valider ma séance" }).click();
  await expect(page.getByText(/Séance express enregistrée/)).toBeVisible();
  const seances = await (await request.get(`${SIMULE}/__test/seances`)).json();
  expect(seances.length).toBe(avant + 1);
  expect(seances.at(-1)).toMatchObject({ seance_nom: "Cardio salon sans matériel", seance_express_id: CARDIO, programme_id: null });
});

test("exercice au temps : le chrono d'effort compte puis lance le repos tout seul", async ({ page }) => {
  await page.clock.install();
  await seConnecter(page, SOPHIE);
  await page.goto(`/seance/express/${CARDIO}`);
  for (let i = 0; i < 10 && !(await page.getByRole("heading", { name: "Jumping jacks" }).isVisible().catch(() => false)); i++) {
    await page.getByRole("button", { name: /^(Commencer|C’est parti|Démarrer|Fait ✓|Passer le repos|Passer|Suivant)/ }).first().click();
  }
  await expect(page.getByText("30 s", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "▶ Lancer le chrono (0:30)" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.screenshot({ path: "test-results/express-chrono-effort.png" });
  await page.clock.runFor(31_000);
  await expect(page.getByText("Repos", { exact: true })).toBeVisible();
});

test("séances express hors connexion : une séance ouverte une fois marche sans réseau", async ({ page, context, request }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto(`/seance/express/${CARDIO}`, { waitUntil: "networkidle" });
  await expect
    .poll(() => page.evaluate(async (id) => Boolean(await (await caches.open("fitw-sport-v1")).match(`/seance/express/${id}`)), CARDIO), { timeout: 20_000 })
    .toBe(true);
  const avant = (await (await request.get(`${SIMULE}/__test/seances`)).json()).length;
  await context.setOffline(true);
  await page.goto(`/seance/express/${CARDIO}`);
  await expect(page.getByRole("status")).toContainText("Hors connexion");
  await allerAuBout(page);
  await page.getByRole("button", { name: "Valider ma séance" }).click();
  await expect(page.getByText(/Pas de réseau : ta séance est gardée sur ton téléphone/)).toBeVisible();
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fitw_hors_connexion_file")), { timeout: 15_000 }).toBeNull();
  const seances = await (await request.get(`${SIMULE}/__test/seances`)).json();
  expect(seances.length).toBe(avant + 1);
  expect(seances.at(-1)).toMatchObject({ seance_express_id: CARDIO, programme_id: null });
});
