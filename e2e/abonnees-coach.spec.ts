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
