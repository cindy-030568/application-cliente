import { defineConfig, devices } from "@playwright/test";

/**
 * Tests des parcours principaux (connexion, bilan, recette, bilan côté coach).
 * Ils tournent UNIQUEMENT sur un Supabase simulé, en mémoire, sur cet ordinateur
 * (e2e/supabase-simule.mjs) : jamais sur la vraie base. Les clés ci-dessous sont factices.
 * Lancer : npm run test:e2e
 */
const PORT = 3100;
const SIMULE = "http://127.0.0.1:54321";
const ENV_TEST = {
  NEXT_PUBLIC_SUPABASE_URL: SIMULE,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  // Aucun envoi réel pendant les tests : ni email, ni notification.
  BREVO_API_KEY: "",
  VAPID_PRIVATE_KEY: "",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
  CRON_SECRET: "secret-de-test",
  ANTHROPIC_API_KEY: "",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", locale: "fr-FR", timezoneId: "Europe/Paris" },
  projects: [
    { name: "telephone", use: { ...devices["iPhone 13"], browserName: "chromium" }, testMatch: /cliente\.spec\.ts/ },
    { name: "ordinateur", use: { viewport: { width: 1440, height: 1000 } }, testMatch: /coach\.spec\.ts/ },
  ],
  webServer: [
    { command: "node e2e/supabase-simule.mjs", url: `${SIMULE}/rest/v1/reglages`, reuseExistingServer: false, timeout: 30_000 },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/connexion`,
      env: ENV_TEST,
      reuseExistingServer: false,
      timeout: 400_000,
    },
  ],
});
