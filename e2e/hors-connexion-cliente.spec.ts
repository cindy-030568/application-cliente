import { expect, test, type Page } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

/** Clique sur le bouton qui fait avancer la séance jusqu'à l'écran de fin. */
async function allerAuBout(page: Page) {
  for (let i = 0; i < 30; i++) {
    if (await page.getByRole("button", { name: "Valider ma séance" }).isVisible().catch(() => false)) return;
    const bouton = page.getByRole("button", { name: /^(Commencer|C’est parti|Démarrer|Fait ✓|Série faite|Passer le repos|Passer|Terminer|Suivant|Exercice suivant)/ }).first();
    await bouton.click();
  }
}

test("séance sans réseau : elle marche, puis part toute seule au retour du réseau, sans doublon", async ({ page, context, request }) => {
  await seConnecter(page, "sophie@exemple.fr");
  await fermerMotDuJour(page);
  await page.goto("/sport", { waitUntil: "networkidle" });
  await expect(page.getByText("Squat goblet").first()).toBeVisible();
  // Le service worker garde la séance sur le téléphone.
  await expect
    .poll(() => page.evaluate(async () => Boolean(await (await caches.open("fitw-sport-v1")).match("/seance/0"))), { timeout: 20_000 })
    .toBe(true);
  const avant = (await (await request.get(`${SIMULE}/__test/seances`)).json()).length;

  // Dans la salle, plus de réseau.
  await context.setOffline(true);
  await page.goto("/seance/0");
  await expect(page.getByRole("status")).toContainText("Hors connexion");
  await allerAuBout(page);
  await page.getByRole("button", { name: "Valider ma séance" }).click();
  await expect(page.getByText(/Pas de réseau : ta séance est gardée sur ton téléphone/)).toBeVisible();
  await page.screenshot({ path: "test-results/seance-hors-connexion.png", fullPage: true });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fitw_hors_connexion_file") ?? "[]").length)).toBeGreaterThan(0);

  // Le réseau revient : la séance part toute seule.
  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("fitw_hors_connexion_file")), { timeout: 15_000 }).toBeNull();
  const seances = await (await request.get(`${SIMULE}/__test/seances`)).json();
  expect(seances.length).toBe(avant + 1);
  const envoyee = seances.at(-1);
  expect(envoyee.seance_nom).toBe("Bas du corps");
  expect(envoyee.ref_locale).toMatch(/^[0-9a-f-]{36}$/);

  // Renvoyée (réseau coupé pendant la réponse) : toujours une seule séance.
  const r = await page.evaluate(async (s) => {
    const rep = await fetch("/api/sport/synchroniser", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elements: [{ id: "x", type: "seance", programmeId: s.programme_id, seance: 0, nom: "Bas du corps", infos: { dureeMinutes: 20, ressenti: 3, commentaire: "" }, ref: s.ref_locale, faiteLe: s.faite_le }] }),
    });
    return rep.json();
  }, envoyee);
  expect(r.enregistres).toEqual(["x"]);
  expect((await (await request.get(`${SIMULE}/__test/seances`)).json()).length).toBe(avant + 1);
});

test("rien n'est gardé hors de l'onglet Sport, et tout est effacé à la déconnexion", async ({ page }) => {
  await seConnecter(page, "sophie@exemple.fr");
  await fermerMotDuJour(page);
  await page.goto("/sport", { waitUntil: "networkidle" });
  await expect
    .poll(() => page.evaluate(async () => Boolean(await (await caches.open("fitw-sport-v1")).match("/seance/0"))), { timeout: 20_000 })
    .toBe(true);
  await page.goto("/suivi", { waitUntil: "networkidle" });
  const gardees = await page.evaluate(async () => (await (await caches.open("fitw-sport-v1")).keys()).map((r) => new URL(r.url).pathname));
  expect(gardees.every((p) => p === "/sport" || /^\/seance\/\d+$/.test(p))).toBe(true);
  expect(gardees).not.toContain("/suivi");

  await page.goto("/profil");
  await page.getByRole("button", { name: /Me déconnecter/ }).click();
  await page.waitForURL(/\/connexion/);
  expect(await page.evaluate(async () => (await caches.keys()).filter((c) => c.startsWith("fitw-")))).toEqual([]);
});
