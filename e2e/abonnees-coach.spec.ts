import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

test("abonnées : la coach règle son offre (prix Stripe vérifiés, conditions de vente) et voit la liste", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/abonnees");
  await expect(page.getByRole("heading", { name: "Mes abonnées" })).toBeVisible();
  await expect(page.getByText("✓ Clé Stripe enregistrée dans Vercel (mode test)")).toBeVisible();
  await expect(page.getByText("✓ Secret des messages Stripe enregistré")).toBeVisible();
  await expect(page.getByText("✓ 9,90 € / mois")).toBeVisible();
  await expect(page.getByText("✓ 99,00 € / an")).toBeVisible();
  await expect(page.getByText(/\/api\/stripe\/webhook/)).toBeVisible();
  await page.screenshot({ path: "test-results/abonnees-coach.png", fullPage: true });

  // Un mauvais identifiant de prix : refusé.
  await page.getByLabel("Prix mensuel (identifiant Stripe)").fill("9,90");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/Les prix Stripe commencent par « price_ »/)).toBeVisible();
  await page.getByLabel("Prix mensuel (identifiant Stripe)").fill("price_Mensuel");
  // Fermer les inscriptions : la page publique l'annonce.
  await page.getByLabel(/Inscriptions ouvertes/).uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré ✓ (inscriptions fermées)")).toBeVisible();
  // La coach voit quand même la page (aperçu).
  await page.goto("/abonnement");
  await expect(page.getByText(/Aperçu coach : la page n’est pas encore ouverte/)).toBeVisible();
  // On rouvre.
  await page.goto("/coach/abonnees");
  await page.getByLabel(/Inscriptions ouvertes/).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré ✓ Les inscriptions sont ouvertes.")).toBeVisible();

  // Les abonnées n'apparaissent jamais dans « Clientes ».
  await page.goto("/coach/clientes");
  await expect(page.getByText("lea@exemple.fr")).toHaveCount(0);
});

test("espace abonnées : la coach coche « aussi pour les abonnées » (fiche, défi) et voit les deux salons", async ({ page, request }) => {
  const SIMULE = "http://127.0.0.1:54321";
  await seConnecter(page, "coach@exemple.fr");

  // Une ressource, aussi pour les abonnées.
  await page.goto("/coach/ressources");
  await expect(page.locator("li", { hasText: "Respirer avant de manger" })).toContainText("+ abonnées");
  await page.getByRole("button", { name: "Nouvelle ressource" }).click();
  await page.getByLabel("Titre").fill("Mon rituel du dimanche");
  await page.getByLabel("Lien (Google Drive ou autre)").fill("https://drive.google.com/rituel");
  await page.getByLabel("Aussi pour les abonnées de l’appli").check();
  await page.getByRole("button", { name: "Ajouter la ressource" }).click();
  await expect(page.getByText("Ressource ajoutée.")).toBeVisible();
  const etat = await (await request.get(`${SIMULE}/__test/ressources`)).json();
  expect(etat.ressources.find((r: { titre: string }) => r.titre === "Mon rituel du dimanche")).toMatchObject({ pour_abonnees: true });

  // Un défi : la case est là, cochée pour « Mon journal, mon rituel ».
  await page.goto("/coach/defis");
  await expect(page.getByRole("link", { name: /Mon journal, mon rituel/ })).toContainText("+ abonnées");
  await page.goto("/coach/defis/d3f10000-0000-4000-8000-000000000003");
  await expect(page.getByLabel("Aussi pour les abonnées de l’appli")).toBeChecked();
  await page.goto("/coach/defis/d3f10000-0000-4000-8000-000000000001");
  await page.getByLabel("Aussi pour les abonnées de l’appli").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Défi enregistré ✓")).toBeVisible();
  const defis = (await (await request.get(`${SIMULE}/__test/espace`)).json()).defis;
  expect(defis.find((d: { id: string }) => d.id === "d3f10000-0000-4000-8000-000000000001")).toMatchObject({ pour_abonnees: true });
  // On remet comme avant (les autres tests en dépendent).
  await page.getByLabel("Aussi pour les abonnées de l’appli").uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Défi enregistré ✓")).toBeVisible();

  // Communauté : le salon des coachées et l'espace commun.
  await page.goto("/coach/communaute");
  const salons = page.getByRole("navigation", { name: "Salons" });
  const fil = page.locator("section", { has: page.getByRole("heading", { name: "Le fil" }) });
  await expect(salons.getByRole("link", { name: "Salon des coachées" })).toHaveAttribute("aria-current", "page");
  await expect(fil.getByText(/idée de collation salée/)).toBeVisible();
  await salons.getByRole("link", { name: "Espace commun" }).click();
  await expect(page.getByText(/tes clientes coachées et les abonnées de l’appli le voient/)).toBeVisible();
  await expect(fil.getByText(/idée de collation salée/)).toHaveCount(0);
  await page.getByPlaceholder("Un mot pour tout le monde…").fill("Bienvenue à toutes 💛");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByPlaceholder("Un mot pour tout le monde…")).toHaveValue("");
  await expect(fil.locator("p", { hasText: "Bienvenue à toutes 💛" })).toBeVisible();
  const messages = (await (await request.get(`${SIMULE}/__test/espace`)).json()).messages;
  expect(messages.find((m: { texte: string }) => m.texte === "Bienvenue à toutes 💛")).toMatchObject({ salon: "commun", auteur_coach: true });
  await page.screenshot({ path: "test-results/communaute-coach-salons.png", fullPage: true });
});
