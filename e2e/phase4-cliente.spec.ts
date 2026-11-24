import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SOPHIE = "sophie@exemple.fr";

test("victoire hors balance : carte de félicitations sur l'accueil", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  const carte = page.getByRole("region", { name: /victoire hors balance/i });
  await expect(carte).toContainText("Nouveau record : Squat goblet à 14 kg !");
  await page.screenshot({ path: "test-results/phase4-victoire-cliente.png", fullPage: false });
  await carte.getByRole("button", { name: "Merci 💛" }).click();
  await expect(carte).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: /victoire hors balance/i })).toHaveCount(0);
});

test("récap de la semaine : séances, sommeil, pas, eau et un petit mot", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/suivi");
  await page.getByRole("link", { name: /Mon récap de la semaine/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/^Du lundi \d+ \w+ au dimanche \d+ \w+$/);
  await expect(page.getByText("par nuit en moyenne")).toBeVisible();
  await expect(page.getByText(/Journal rempli \d jours? sur 7/)).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-recap-cliente.png", fullPage: true });
  await page.getByRole("link", { name: "← Semaine d’avant" }).click();
  await expect(page).toHaveURL(/semaine=\d{4}-\d{2}-\d{2}/);
  // Réglage de la notification dans le profil.
  await page.goto("/profil");
  const interrupteur = page.getByRole("switch", { name: /Mon récap du dimanche/ });
  await expect(interrupteur).toBeChecked();
  await interrupteur.click({ force: true });
  await expect(interrupteur).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: /Mon récap du dimanche/ })).not.toBeChecked();
});

test("cycle et périménopause : choisis dans le profil, suivis dans le journal", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/profil#cycle");
  const carte = page.locator("#cycle");
  await carte.getByText("Mon cycle", { exact: true }).click();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("C’est noté ✓")).toBeVisible();
  await page.goto("/suivi/journal");
  await expect(page.getByText(/Jour \d+ de ton cycle/)).toBeVisible();
  await expect(page.getByText(/jamais|ne remplacent pas l’avis/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-cycle-journal.png" });

  // Périménopause : les symptômes du jour.
  await page.goto("/profil#cycle");
  await carte.getByText("Ma périménopause", { exact: true }).click();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("C’est noté ✓")).toBeVisible();
  await page.goto("/suivi/journal");
  await expect(page.getByText(/Jour \d+ de ton cycle/)).toHaveCount(0);
  await page.getByText("Bouffées de chaleur").click();
  await page.getByRole("button", { name: /ma journée/ }).click();
  await expect(page.getByText("Journée enregistrée ✓")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Bouffées de chaleur" })).toBeChecked();
  await page.getByText("Mes symptômes du jour").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/phase4-perimenopause-journal.png" });
  // Remise à zéro pour les autres tests.
  await page.goto("/profil#cycle");
  await carte.getByText("Rien", { exact: true }).click();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText(/rien n’est suivi/)).toBeVisible();
});

test("compléments : la cliente voit sa liste, coche, et règle son rappel", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.getByRole("link", { name: /Mes compléments/ }).click();
  await expect(page.getByRole("heading", { name: "Le matin" })).toBeVisible();
  const omega = page.getByRole("checkbox", { name: /Oméga 3/ });
  await omega.check();
  await expect(page.getByText(/Tout est pris aujourd’hui|Aujourd’hui : 1 sur/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Oméga 3/ })).toBeChecked();
  await page.getByText("Me le rappeler chaque jour").click();
  await expect(page.getByText(/un petit rappel chaque jour à 08 h 00/)).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-complements-cliente.png", fullPage: true });
  await page.getByRole("checkbox", { name: /Oméga 3/ }).uncheck();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Oméga 3/ })).not.toBeChecked();
});

test("planning des repas : choisir ses recettes de la semaine, puis remplir la liste de courses", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/recettes");
  await page.getByRole("link", { name: /Mon planning de la semaine/ }).click();
  await expect(page.getByRole("heading", { name: "Mon planning de repas" })).toBeVisible();
  // Déjeuner du lundi, puis dîner du mardi.
  for (const [n, repas] of [[0, "déjeuner"], [1, "dîner"]] as const) {
    await page.getByRole("link", { name: new RegExp(`Choisir une recette pour le ${repas}`) }).nth(n).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Choisir" }).first().click();
    await page.waitForURL(/\/recettes\/planning\?semaine=/);
  }
  await expect(page.getByRole("button", { name: /^Retirer/ })).toHaveCount(2);
  await page.getByRole("button", { name: /Ajouter ma semaine à ma liste de courses/ }).click();
  await expect(page.getByText(/articles? ajoutés? à ta liste de courses ✓/)).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-planning.png", fullPage: true });
  // Recommencer ne crée pas de doublon : la semaine est remplacée (on attend la fin de l'envoi).
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/recettes/planning")),
    page.getByRole("button", { name: /Ajouter ma semaine à ma liste de courses/ }).click(),
  ]);
  await expect(page.getByRole("button", { name: /Ajouter ma semaine à ma liste de courses/ })).toBeEnabled();
  await page.goto("/recettes/courses");
  await expect(page.getByText(/Planning de la semaine du/).first()).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-planning-courses.png", fullPage: true });
});

test("fiche « Je mange dehors » : invisible en brouillon, lisible une fois publiée", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/ressources");
  await expect(page.getByText("Guide : bien démarrer")).toBeVisible();
  await expect(page.getByText("Je mange dehors")).toHaveCount(0);
  await page.goto("/ressources/eeeeeeee-0000-0000-0000-000000000004");
  await expect(page.getByRole("heading", { name: "Au restaurant" })).toHaveCount(0);
});

test("bilan de fin de suivi : sa transformation, le PDF et « Continuer avec moi »", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.getByRole("link", { name: /Ton bilan de fin de suivi est prêt/ }).click();
  await expect(page.getByRole("heading", { name: /Sophie, regarde ton chemin/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avant / après" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tes mesures" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Courbe : Tour de taille" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Tu es devenue plus forte/ })).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-bilan-fin.png", fullPage: true });
  // PDF à garder.
  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Télécharger mon bilan (PDF)" }).click()]);
  expect(pdf.suggestedFilename()).toBe("mon-bilan-de-fin-de-suivi.pdf");
  const chemin = await pdf.path();
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(chemin).subarray(0, 5).toString()).toBe("%PDF-");
  await pdf.saveAs("test-results/phase4-bilan-fin.pdf");
  // Continuer avec moi.
  const offre = page.locator("li", { hasText: "Continuer mon accompagnement" });
  await offre.getByRole("button", { name: "Ça m’intéresse" }).click();
  await expect(page.getByText("C’est noté ! Je reviens vers toi très vite 💛")).toBeVisible();
  await expect(offre).toContainText("Demande bien reçue ✓");
  await page.reload();
  await expect(page.locator("li", { hasText: "Continuer mon accompagnement" })).toContainText("Demande bien reçue ✓");
});

test("avis et parrainage : un témoignage avec sa case de publication, et son code à partager", async ({ page }) => {
  await seConnecter(page, SOPHIE);
  await fermerMotDuJour(page);
  await page.goto("/avis?de=fin");
  await page.getByLabel("Ton témoignage").fill("Grâce à Cindy, j’ai retrouvé de l’énergie et confiance en moi, sans me priver.");
  // La publication est une case à part : sans elle, le nom n'est même pas demandé.
  await expect(page.getByText("Sous quel nom ?")).toHaveCount(0);
  await page.getByText("Oui, tu peux publier mon témoignage").click();
  await page.getByText("Mon initiale").click();
  await page.screenshot({ path: "test-results/phase4-avis-cliente.png", fullPage: true });
  await page.getByRole("button", { name: "Envoyer mon témoignage" }).click();
  await expect(page.getByText(/Merci infiniment pour ton témoignage/)).toBeVisible();
  await page.reload();
  const envoye = page.locator("li", { hasText: "Grâce à Cindy" });
  await expect(envoye.getByRole("checkbox", { name: "Tu m’autorises à le publier" })).toBeChecked();

  // Parrainage : son code et son lien dans le profil.
  await page.goto("/profil#parrainage");
  const carte = page.locator("#parrainage");
  await expect(carte).toContainText("CODE0A");
  await expect(carte.getByRole("button", { name: "Copier mon lien" })).toBeVisible();
  await carte.screenshot({ path: "test-results/phase4-parrainage-cliente.png" });
});
