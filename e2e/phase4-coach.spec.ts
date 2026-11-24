import { devices, expect, test } from "@playwright/test";
import { fermerMotDuJour, seConnecter } from "./outils";

test("victoire hors balance : ligne dans le tableau de bord, avec un mot prêt à envoyer", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach");
  const ligne = page.locator("li", { hasText: "Victoire 🏆" }).first();
  await expect(ligne).toContainText("Nouveau record : Squat goblet à 14 kg");
  await expect(ligne).toContainText("Squat goblet : 14 kg (avant 10 kg)");
  await expect(ligne.getByRole("textbox")).toHaveValue(/Bravo Sophie ! Nouveau record sur Squat goblet \(14 kg\)/);
  await ligne.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/phase4-victoire-coach.png", fullPage: false });
});

test("périménopause : la coach voit les symptômes notés par sa cliente", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/clientes/00000000-0000-0000-0000-0000000000b2/suivi");
  const bloc = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Sa périménopause" }) }).last();
  await expect(bloc).toContainText("Bouffées de chaleur · 2 jours");
  await expect(bloc).toContainText("Sueurs nocturnes · 1 jour");
});

test("compléments : la coach ajoute un complément sur la fiche de sa cliente", async ({ page }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/clientes/00000000-0000-0000-0000-00000000000a");
  await page.getByText("Compléments", { exact: true }).click();
  await page.getByLabel("Complément", { exact: true }).fill("Magnésium bisglycinate");
  await page.getByLabel("Combien").fill("2 gélules");
  await page.getByLabel("Quand").selectOption("coucher");
  await page.getByLabel("Précision (facultatif)").fill("avec un grand verre d’eau");
  await page.getByRole("button", { name: "Ajouter à sa liste" }).click();
  await expect(page.getByText("Ajouté à la liste de Sophie ✓")).toBeVisible();
  await expect(page.getByText("Magnésium bisglycinate").first()).toBeVisible();
  await page.getByLabel("Complément", { exact: true }).fill("Vitamine D3");
  await page.getByLabel("Combien").fill("1 goutte");
  await page.getByRole("button", { name: "Ajouter à sa liste" }).click();
  await expect(page.getByText("Vitamine D3").first()).toBeVisible();
  await page.getByText("Vitamine D3").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/phase4-complements-coach.png" });
});

test("fiche « Je mange dehors » : brouillon relu puis publié par la coach", async ({ page, browser }) => {
  await seConnecter(page, "coach@exemple.fr");
  await page.goto("/coach/ressources");
  const ligne = page.locator("li", { hasText: "Je mange dehors" });
  await expect(ligne).toContainText("Brouillon : invisible pour tes clientes");
  await ligne.getByRole("link", { name: /Je mange dehors/ }).click();
  await expect(page.getByRole("heading", { name: "Au restaurant" })).toBeVisible();
  await page.screenshot({ path: "test-results/phase4-fiche-apercu.png", fullPage: true });
  await page.goto("/coach/ressources");
  await page.locator("li", { hasText: "Je mange dehors" }).getByRole("button", { name: "Modifier" }).click();
  await expect(page.getByLabel("Contenu de la fiche")).toHaveValue(/## Au restaurant/);
  await page.getByLabel(/Publiée : visible par tes clientes/).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Ressource modifiée.")).toBeVisible();
  await expect(page.locator("li", { hasText: "Je mange dehors" })).not.toContainText("Brouillon");

  // Une fois publiée, la cliente la lit dans ses ressources (sur son téléphone).
  const tel = await browser.newContext({ ...devices["iPhone 13"], baseURL: "http://localhost:3100", locale: "fr-FR", timezoneId: "Europe/Paris" });
  const cliente = await tel.newPage();
  await seConnecter(cliente, "sophie@exemple.fr");
  await fermerMotDuJour(cliente);
  await cliente.goto("/ressources");
  await cliente.getByRole("link", { name: /Je mange dehors/ }).click();
  await expect(cliente.getByRole("heading", { name: "Chez des amis ou en famille" })).toBeVisible();
  await cliente.screenshot({ path: "test-results/phase4-fiche-cliente.png" });
  await tel.close();
});
