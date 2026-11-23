import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seConnecter } from "./outils";

const SIMULE = "http://127.0.0.1:54321";

const reponseTally = {
  eventId: "evt-1",
  eventType: "FORM_RESPONSE",
  createdAt: new Date().toISOString(),
  data: {
    responseId: "rep-e2e-1",
    formName: "Inscription coaching",
    fields: [
      { key: "q1", label: "Ton prénom", type: "INPUT_TEXT", value: "Léa" },
      { key: "q2", label: "Ton nom", type: "INPUT_TEXT", value: "Fictive" },
      { key: "q3", label: "Ton email", type: "INPUT_EMAIL", value: "lea.fictive@exemple.fr" },
      { key: "q4", label: "Ton objectif", type: "INPUT_TEXT", value: "Perdre 6 kilos sans me priver" },
      { key: "q5", label: "Allergies ou aliments que tu évites", type: "INPUT_TEXT", value: "Intolérante au gluten, pas de cacahuètes" },
      { key: "q6", label: "Ton rythme de travail", type: "INPUT_TEXT", value: "Horaires de bureau, 2 jours de télétravail" },
    ],
  },
};

test("formulaire Tally : la demande arrive « à valider », jamais invitée toute seule", async ({ page, request }) => {
  const corps = JSON.stringify(reponseTally);
  const faux = await request.post("/api/tally", { data: corps, headers: { "content-type": "application/json", "tally-signature": "fausse" } });
  expect(faux.status()).toBe(401);
  const signature = createHmac("sha256", "tally-test").update(corps).digest("base64");
  const ok = await request.post("/api/tally", { data: corps, headers: { "content-type": "application/json", "tally-signature": signature } });
  expect(ok.status()).toBe(200);
  // Tally renvoie parfois la même réponse : une seule demande.
  await request.post("/api/tally", { data: corps, headers: { "content-type": "application/json", "tally-signature": signature } });
  expect(await (await request.get(`${SIMULE}/__test/demandes`)).json()).toHaveLength(1);

  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/clientes");
  const section = page.locator("#a-valider");
  await expect(section.getByRole("heading", { name: /Fiches à valider/ })).toContainText("(1)");
  await expect(section).toContainText("Léa Fictive");
  await expect(section).toContainText("Perdre 6 kilos sans me priver");
  await expect(section).toContainText("Gluten");
  await expect(section).toContainText("Arachide");
  await section.screenshot({ path: "test-results/fiches-a-valider.png" });
  await section.getByRole("link", { name: "Vérifier et inviter" }).click();
  await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue("lea.fictive@exemple.fr");
  await expect(page.getByRole("textbox", { name: "Prénom" })).toHaveValue("Léa");
  await expect(page.getByText("Exclusions ajoutées : Gluten, Arachide")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer sa fiche et l’inviter" })).toBeVisible();
  await page.screenshot({ path: "test-results/verifier-et-inviter.png", fullPage: true });
});

test("Réglages : la coach colle son contrat avec un numéro de version", async ({ page, request }) => {
  try {
    await seConnecter(page, "coach@exemple.fr");
    await page.goto("/coach/reglages");
    await page.getByLabel("Numéro de version").fill("1");
    await page.getByLabel("Texte de ton contrat").fill("Contrat de test, article 1…");
    await page.getByLabel(/Phrase de la case/).fill("Phrase de renonciation fournie par la coach.");
    await page.getByRole("button", { name: "Enregistrer le contrat" }).click();
    await expect(page.getByText(/Contrat version « 1 » enregistré/)).toBeVisible();
  } finally {
    await request.post(`${SIMULE}/__test/contrat`, { data: { actif: false } });
  }
});

test("brouillon Claude : seul le texte anonymisé part, et rien n'est envoyé sans le clic de la coach", async ({ page, request }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/bilans/b0000000-0000-0000-0000-000000000003");
  const zone = page.getByLabel("Ton retour à Sophie");
  await zone.fill("");
  await page.getByRole("button", { name: /Proposer un brouillon/ }).click();
  await expect(zone).toHaveValue(/^Coucou Sophie ! Bravo pour tes 3 séances/);
  await expect(page.getByText(/Brouillon prêt : relis-le/)).toBeVisible();
  await page.locator("form").filter({ has: zone }).screenshot({ path: "test-results/brouillon-claude.png" });

  const envoye = await (await request.get(`${SIMULE}/__test/claude`)).json();
  expect(envoye.model).toBe("claude-opus-5-5");
  expect(envoye.fallbacks).toBe("default");
  const texte = JSON.stringify(envoye.messages);
  expect(texte).toContain("[prénom]");
  for (const interdit of ["Sophie", "Martin", "sophie@exemple.fr", ".jpg", "2026-"]) expect(texte).not.toContain(interdit);
});

test("Réglages : la coach modifie les questions du questionnaire d'arrivée", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/reglages");
  await page.getByRole("link", { name: "Modifier les questions" }).click();
  await expect(page.getByRole("heading", { name: "Questionnaire d’arrivée", level: 1 })).toBeVisible();
  const ajout = page.locator("form").filter({ hasText: "Ajouter la question" });
  await ajout.getByLabel("Question", { exact: true }).fill("Tes plats préférés ?");
  await ajout.getByLabel("Section (titre du groupe)").fill("Ton alimentation");
  await ajout.getByRole("button", { name: "Ajouter la question" }).click();
  await expect(page.getByText("Question ajoutée.")).toBeVisible();
  await page.screenshot({ path: "test-results/questionnaire-coach.png", fullPage: true });
});
