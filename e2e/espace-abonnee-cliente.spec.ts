import { expect, test, type Page } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

/** Une nouvelle abonnée (paiement Stripe simulé), connectée. */
async function nouvelleAbonnee(page: Page, prenom: string, email: string) {
  await page.goto("/abonnement");
  await page.getByLabel("Ton prénom").fill(prenom);
  await page.getByLabel("Ton adresse email").fill(email);
  await page.getByLabel("J’accepte les conditions de vente").check();
  await page.getByLabel("Je veux accéder à mon espace tout de suite").check();
  await page.getByRole("button", { name: "Continuer vers le paiement sécurisé" }).click();
  await page.waitForURL(/\/stripe\/paiement\//);
  await page.getByRole("button", { name: "Payer" }).click();
  await page.waitForURL(/\/abonnement\/merci/);
  await seConnecter(page, email);
  await page.waitForURL(/\/espace$/);
  await fermerMotDuJour(page);
}

test.describe.serial("espace abonnée", () => {
  test("accueil, métabolisme, recettes, bouger, journal, fiches et profil", async ({ page, request }) => {
    await nouvelleAbonnee(page, "Jade", "jade@exemple.fr");

    // Accueil : son journal, une idée recette, son métabolisme, le défi coché pour elle.
    await expect(page.getByRole("heading", { name: /Bonjour/ })).toContainText("Jade");
    await expect(page.getByRole("link", { name: /Mon journal du jour/ })).toBeVisible();
    await expect(page.getByText("L’idée recette du jour")).toBeVisible();
    await expect(page.getByRole("link", { name: /Passer au coaching/ })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    for (const onglet of ["Accueil", "Recettes", "Bouger", "Journal"]) await expect(nav.getByRole("link", { name: onglet })).toBeVisible();
    await page.screenshot({ path: "test-results/espace-accueil.png", fullPage: true });

    // Mon métabolisme : métabolisme de base et besoins du quotidien, sans objectif de perte.
    await page.getByRole("link", { name: /Mon métabolisme/ }).click();
    await page.getByLabel("Née en").fill("1990");
    await page.getByLabel("Taille (cm)").fill("165");
    await page.getByLabel("Poids (kg)").fill("64");
    await page.getByRole("button", { name: "Voir mes repères" }).click();
    await expect(page.getByText("Ton métabolisme de base")).toBeVisible();
    await expect(page.getByText(/environ .*kcal/)).toBeVisible();
    await page.screenshot({ path: "test-results/espace-metabolisme.png", fullPage: true });
    const etat = await (await request.get(`${SIMULE}/__test/espace`)).json();
    expect(etat.metabolismes).toHaveLength(1);
    await page.goto("/espace");
    await expect(page.getByRole("link", { name: /Mon métabolisme/ })).toContainText(/Au repos .*kcal/);

    // Recettes : telles quelles (1 portion) + l'assiette.
    await nav.getByRole("link", { name: "Recettes" }).click();
    await expect(page.getByRole("heading", { name: "Mes recettes" })).toBeVisible();
    await page.locator("main a[href^='/espace/recettes/'], a[href^='/espace/recettes/']").first().click();
    await expect(page.getByRole("heading", { name: "Ton assiette" })).toBeVisible();
    await page.screenshot({ path: "test-results/espace-recette.png", fullPage: true });

    // Bouger : le défi coché « pour les abonnées », pas celui du coaching ; les séances express.
    await nav.getByRole("link", { name: "Bouger" }).click();
    const defi = page.getByRole("article", { name: /Mon journal, mon rituel/ });
    await expect(defi).toBeVisible();
    await expect(page.getByText("Bouger un peu plus chaque jour")).toHaveCount(0);
    await defi.getByRole("button", { name: "Je relève le défi 💪" }).click();
    await expect(defi.getByText("Ma progression")).toBeVisible();
    await expect(page.getByText("Cardio salon sans matériel")).toBeVisible();
    await page.screenshot({ path: "test-results/espace-bouger.png", fullPage: true });

    // Journal : énergie, sommeil, pas… et le poids est facultatif.
    await nav.getByRole("link", { name: "Journal" }).click();
    await expect(page.getByText("Poids (facultatif)")).toBeVisible();
    await page.getByRole("group", { name: "Mon énergie" }).getByText("4", { exact: true }).click();
    await page.getByLabel("Sommeil").fill("7h30");
    await page.getByLabel("Pas", { exact: true }).fill("8200");
    await page.getByRole("button", { name: "Enregistrer ma journée" }).click();
    await expect(page.getByText("Journée enregistrée ✓")).toBeVisible();
    const apres = await (await request.get(`${SIMULE}/__test/espace`)).json();
    const ligne = apres.journal.find((j: { energie?: number; pas?: number }) => j.pas === 8200);
    expect(ligne).toMatchObject({ energie: 4, sommeil: 7.5 });
    await page.screenshot({ path: "test-results/espace-journal.png", fullPage: true });
    await page.goto("/espace");
    await expect(page.getByRole("link", { name: /Mon journal du jour ✓/ })).toBeVisible();

    // Fiches et audios : seulement ce que j'ai coché pour les abonnées.
    await page.getByRole("link", { name: /Fiches & audios/ }).click();
    await expect(page.getByText("Respirer avant de manger")).toBeVisible();
    await expect(page.getByText("Guide : bien démarrer")).toHaveCount(0);
    await expect(page.getByText("Liste de courses de base")).toHaveCount(0);

    // Profil : abonnement, mode sans chiffres.
    await page.goto("/espace/profil");
    await expect(page.getByText(/Abonnement (au mois|à l’année), prochain renouvellement le/)).toBeVisible();
    const sansChiffres = page.getByRole("switch", { name: /Mode sans chiffres/ });
    await sansChiffres.check();
    await expect(sansChiffres).toBeChecked();
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("switch", { name: /Mode sans chiffres/ })).toBeChecked({ timeout: 1000 });
    }).toPass();
    await page.goto("/espace/journal");
    await expect(page.getByText("Poids (facultatif)")).toHaveCount(0);

    // Les pages du coaching restent fermées.
    for (const chemin of ["/", "/suivi", "/nutrition"]) {
      await page.goto(chemin);
      await expect(page).toHaveURL(/\/espace$/);
    }
  });

  test("communauté : l'abonnée est dans l'espace commun, le salon des coachées lui reste fermé", async ({ page, browser }) => {
    await seConnecter(page, "jade@exemple.fr");
    await fermerMotDuJour(page);
    await page.goto("/espace/communaute");
    await fermerMotDuJour(page);
    await page.getByLabel(/J’ai lu la charte/).check();
    await page.getByRole("button", { name: "Rejoindre la communauté" }).click();
    await expect(page.getByPlaceholder(/Partage une victoire/)).toBeVisible();
    // Les messages du salon des coachées ne sont pas là.
    await expect(page.getByText(/idée de collation salée/)).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Salons" })).toHaveCount(0);
    await page.getByPlaceholder(/Partage une victoire/).fill("Coucou tout le monde, je suis Jade !");
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByPlaceholder(/Partage une victoire/)).toHaveValue("");
    await expect(page.locator("p", { hasText: "Coucou tout le monde, je suis Jade !" })).toBeVisible();
    await page.screenshot({ path: "test-results/espace-communaute.png", fullPage: true });

    // Une cliente coachée : deux salons ; le message de Jade est dans « Tout le monde ».
    const contexte = await browser.newContext({ ...test.info().project.use });
    const sophie = await contexte.newPage();
    await seConnecter(sophie, "sophie@exemple.fr");
    await fermerMotDuJour(sophie);
    await sophie.goto("/communaute");
    await fermerMotDuJour(sophie);
    const salons = sophie.getByRole("navigation", { name: "Salons" });
    await expect(salons.getByRole("link", { name: "Entre coachées" })).toHaveAttribute("aria-current", "page");
    await expect(sophie.getByText(/idée de collation salée/)).toBeVisible();
    await expect(sophie.getByText("Coucou tout le monde, je suis Jade !")).toHaveCount(0);
    await salons.getByRole("link", { name: "Tout le monde" }).click();
    await expect(sophie.getByText("Coucou tout le monde, je suis Jade !")).toBeVisible();
    await expect(sophie.getByText(/idée de collation salée/)).toHaveCount(0);
    await sophie.screenshot({ path: "test-results/communaute-salons.png", fullPage: true });
    await contexte.close();
  });
});
