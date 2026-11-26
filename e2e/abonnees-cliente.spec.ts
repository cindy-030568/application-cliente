import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

test("abonnée : inscription, paiement Stripe, compte créé, son espace (rien du coaching), arrêt puis fin d'abonnement", async ({ page, request }) => {
  // Page publique, sans être connectée.
  await page.goto("/abonnement");
  await expect(page.getByRole("heading", { name: "Mon appli bien-être, sans coaching" })).toBeVisible();
  await expect(page.getByText("9,90 € / mois")).toBeVisible();
  await expect(page.getByText("99,00 € / an")).toBeVisible();
  await expect(page.getByRole("link", { name: /Découvrir mon coaching/ })).toHaveAttribute("href", "https://tally.so/r/EkdN0A");
  await page.screenshot({ path: "test-results/abonnement-public.png", fullPage: true });

  // Un email déjà utilisé (cliente coachée) : refusé.
  await page.getByLabel("Ton prénom").fill("Sophie");
  await page.getByLabel("Ton adresse email").fill("sophie@exemple.fr");
  await page.getByLabel("J’accepte les conditions de vente").check();
  await page.getByLabel("Je veux accéder à mon espace tout de suite").check();
  await page.getByRole("button", { name: "Continuer vers le paiement sécurisé" }).click();
  await expect(page.getByText(/Un compte existe déjà avec cette adresse email/)).toBeVisible();

  // Nouvelle abonnée, formule à l'année.
  await page.getByLabel("Ton prénom").fill("Léa");
  await page.getByLabel("Ton adresse email").fill("lea@exemple.fr");
  await page.getByText("À l’année").click();
  await page.getByRole("button", { name: "Continuer vers le paiement sécurisé" }).click();
  await page.waitForURL(/\/stripe\/paiement\//);
  await page.getByRole("button", { name: "Payer" }).click();
  await page.waitForURL(/\/abonnement\/merci/);
  await expect(page.getByRole("heading", { name: /Bienvenue/ })).toBeVisible();
  const etat = await (await request.get(`${SIMULE}/__test/abonnees`)).json();
  const lea = etat.abonnees.find((a: { email: string }) => a.email === "lea@exemple.fr");
  expect(lea).toMatchObject({ formule: "abonnement", statut: "active", abonnement_formule: "annuel", abonnement_statut: "active", renonciation_retractation: true });
  expect(lea.stripe_customer_id).toMatch(/^cus_/);

  // Connexion : son espace, jamais les pages du coaching.
  await seConnecter(page, "lea@exemple.fr");
  await page.waitForURL(/\/espace$/);
  await expect(page.getByRole("heading", { name: /Bonjour/ })).toContainText("Léa");
  await expect(page.getByText(/Abonnement à l’année, prochain renouvellement le/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Passer au coaching/ })).toBeVisible();
  await page.screenshot({ path: "test-results/abonnee-espace.png", fullPage: true });
  for (const chemin of ["/", "/ressources", "/suivi", "/seances-express"]) {
    await page.goto(chemin);
    await expect(page).toHaveURL(/\/espace$/);
  }

  // Elle arrête son abonnement (espace de gestion Stripe) : accès gardé jusqu'à la fin de la période.
  await page.getByRole("button", { name: "Gérer mon abonnement" }).click();
  await page.waitForURL(/\/stripe\/portail\//);
  await page.getByRole("button", { name: "Annuler l'abonnement" }).click();
  await page.waitForURL(/\/espace$/);
  await expect(page.getByText(/Abonnement à l’année arrêté : tu gardes ton accès jusqu’au/)).toBeVisible();

  // L'abonnement se termine : espace fermé, données gardées 6 mois, reprise possible.
  await page.getByRole("button", { name: "Gérer mon abonnement" }).click();
  await page.waitForURL(/\/stripe\/portail\//);
  await page.getByRole("button", { name: "Terminer maintenant" }).click();
  await page.goto("/espace");
  await expect(page).toHaveURL(/\/acces-ferme$/);
  await expect(page.getByRole("heading", { name: "Ton abonnement est terminé" })).toBeVisible();
  await expect(page.getByText(/sont gardées jusqu’au/)).toBeVisible();
  await page.screenshot({ path: "test-results/abonnee-terminee.png", fullPage: true });
  await page.getByRole("link", { name: "Reprendre mon abonnement" }).click();
  await expect(page.getByRole("heading", { name: /Contente de te revoir, Léa/ })).toBeVisible();
  await expect(page.getByLabel("Ton adresse email")).toHaveValue("lea@exemple.fr");
});

test("un faux message « Stripe » (mauvaise signature) est refusé", async ({ request }) => {
  const r = await request.post("/api/stripe/webhook", {
    headers: { "stripe-signature": "t=1,v1=faux", "content-type": "application/json" },
    data: { type: "checkout.session.completed", data: { object: { mode: "subscription", customer: "cus_x", subscription: "sub_x", customer_email: "pirate@exemple.fr" } } },
  });
  expect(r.status()).toBe(400);
  const etat = await (await request.get(`${SIMULE}/__test/abonnees`)).json();
  expect(etat.abonnees.some((a: { email: string }) => a.email === "pirate@exemple.fr")).toBe(false);
});

test("une cliente coachée connectée garde son accueil habituel", async ({ page }) => {
  await seConnecter(page, "sophie@exemple.fr");
  await fermerMotDuJour(page);
  await expect(page).toHaveURL(/localhost:3100\/$/);
  await page.goto("/abonnement");
  await expect(page.getByRole("heading", { name: "Tu as déjà ton espace 💛" })).toBeVisible();
});
