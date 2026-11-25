import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

test("défi du mois : carte sur l'accueil, je relève le défi, ma progression et celle du groupe, puis j'abandonne", async ({ page }) => {
  await seConnecter(page, "sophie@exemple.fr");
  await fermerMotDuJour(page);
  const carte = page.getByRole("link", { name: /Défi du mois.*Bouger un peu plus chaque jour/ });
  await expect(carte).toBeVisible();
  await expect(carte).toContainText("Tu le relèves avec moi ?");
  await carte.click();
  await expect(page.getByRole("heading", { name: "Défis du mois", level: 1 })).toBeVisible();
  await expect(page.getByText("Brouillon sommeil")).toHaveCount(0);
  const defi = page.getByRole("article", { name: /Bouger un peu plus chaque jour/ });
  await expect(defi.getByText(/8 000 pas ou plus, au moins 15 jours/)).toBeVisible();
  await defi.getByRole("button", { name: "Je relève le défi 💪" }).click();
  await expect(defi.getByText("Ma progression")).toBeVisible();
  await expect(defi.getByText(/\d+ jours? réussis? sur 15/)).toBeVisible();
  // Seule participante : pas de pourcentage du groupe (on pourrait deviner ses chiffres).
  await expect(defi.getByText(/Le groupe se forme/)).toBeVisible();
  await page.screenshot({ path: "test-results/defis-cliente.png", fullPage: true });

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Défi du mois.*Bouger un peu plus chaque jour/ })).toContainText(/réussis? sur 15/);

  // Notifications : l'interrupteur des défis est dans le profil.
  await page.goto("/profil");
  await expect(page.getByRole("switch", { name: /Mes défis du mois/ })).toBeChecked();

  // Abandon : le bouton « Je relève le défi » revient.
  await page.goto("/defis");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("article", { name: /Bouger un peu plus chaque jour/ }).getByRole("button", { name: "Quitter le défi" }).click();
  await expect(page.getByRole("article", { name: /Bouger un peu plus chaque jour/ }).getByRole("button", { name: "Je relève le défi 💪" })).toBeVisible();
});

test("défi réussi : la base le marque, mon prénom est fêté dans la communauté (je l'ai choisi) et c'est une victoire", async ({ page, request }) => {
  await seConnecter(page, "sophie@exemple.fr");
  await page.goto("/defis");
  await fermerMotDuJour(page);
  const defi = page.getByRole("article", { name: /Mon journal, mon rituel/ });
  await defi.getByLabel(/Afficher mon prénom dans la communauté/).check();
  await defi.getByRole("button", { name: "Je relève le défi 💪" }).click();
  await expect(defi.getByText("Défi relevé : bravo 🏆")).toBeVisible();
  await expect(defi.getByRole("button", { name: "Quitter le défi" })).toHaveCount(0);
  const etat = await (await request.get(`${SIMULE}/__test/defis`)).json();
  expect(etat.messages.filter((m: { texte: string }) => m.texte.includes("Bravo Sophie") && m.texte.includes("Mon journal, mon rituel"))).toHaveLength(1);
  await page.screenshot({ path: "test-results/defis-reussi.png", fullPage: true });
  await page.goto("/");
  await expect(page.getByText("Défi « Mon journal, mon rituel » relevé : bravo !")).toBeVisible();
  await page.goto("/communaute");
  await expect(page.getByText(/Bravo Sophie : défi « Mon journal, mon rituel » relevé/)).toBeVisible();
});
