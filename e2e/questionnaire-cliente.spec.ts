import { expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

test("première connexion : la cliente remplit son questionnaire d'arrivée", async ({ page, request }) => {
  await request.post(`${SIMULE}/__test/questionnaire`, { data: { actif: true } });
  try {
    await seConnecter(page, "sophie@exemple.fr");
    await page.waitForURL(/\/questionnaire/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Faisons connaissance, Sophie");
    // Une question obligatoire manque : rien ne part.
    await page.getByText("Me tonifier : perdre du gras et gagner du muscle").click();
    await page.getByText("Gluten", { exact: true }).click();
    await page.getByPlaceholder(/Autres aliments/).fill("champignons");
    await page.getByText("3", { exact: true }).click();
    await page.getByLabel(/Dans 3 mois/).fill("Avoir de l’énergie toute la journée");
    await page.getByLabel("Ta taille (en cm)").fill("165");
    // Aliments du plan : tout est déjà coché, elle décoche ce qu'elle ne veut pas et ajoute.
    await page.getByText("Pâtes", { exact: true }).click();
    await page.getByPlaceholder("Aliments à ajouter (facultatif)").fill("Polenta");
    // Sophie a le suivi sportif : la question salle / maison lui est posée.
    await expect(page.getByText("T'entraînes-tu en salle ou chez toi ?")).toBeVisible();
    await page.screenshot({ path: "test-results/questionnaire-cliente.png", fullPage: true });
    await page.getByRole("button", { name: /Envoyer mes réponses/ }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await fermerMotDuJour(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour Sophie");

    const etat = await (await request.get(`${SIMULE}/__test/questionnaire`)).json();
    const envoi = etat.reponses[0];
    expect(envoi.objectif).toBe("recompo");
    expect(envoi.besoins).toEqual({ taille_cm: "165" });
    expect(envoi.reponses).toContainEqual({ question: "Féculents", reponse: ["Garde : Riz, Quinoa", "Retire : Pâtes", "Ajoute : Polenta"] });
    expect(envoi.reponses).toContainEqual({ question: "Allergies, intolérances ou aliments que tu ne manges pas", reponse: ["Gluten", "Autres : champignons"] });
    // Gluten ajouté à ses exclusions de recettes.
    expect(etat.exclusions.filter((e: { cliente_id: string }) => e.cliente_id === "00000000-0000-0000-0000-00000000000a").length).toBeGreaterThan(2);

    // Une fois rempli, plus de détour.
    await page.goto("/suivi");
    await expect(page).toHaveURL(/\/suivi$/);
  } finally {
    await request.post(`${SIMULE}/__test/questionnaire`, { data: { actif: false } });
  }
});
