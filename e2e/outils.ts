import { expect, type Page } from "@playwright/test";

/** Code de connexion du Supabase simulé (e2e/supabase-simule.mjs). */
export const CODE_TEST = "123456";

/** Connexion par code, comme une vraie cliente (ou la coach). */
export async function seConnecter(page: Page, email: string) {
  await page.goto("/connexion", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Recevoir un code par email" }).click();
  // Le formulaire « code » remplace celui du mot de passe : on attend qu'il soit là avant de taper.
  await expect(page.getByRole("button", { name: "Recevoir mon code" })).toBeVisible();
  await page.getByLabel("Ton adresse email").fill(email);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  await expect(page.getByLabel("Code reçu par email")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Code reçu par email").fill(CODE_TEST);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
}

/** Ferme le petit mot du jour s'il s'affiche (première ouverture de la journée). */
export async function fermerMotDuJour(page: Page) {
  const merci = page.getByRole("button", { name: /Merci, belle journée/ });
  if (await merci.isVisible().catch(() => false)) await merci.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
