import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
const envois = vi.hoisted(() => ({ matin: vi.fn(), planifies: vi.fn(), programmes: vi.fn() }));
vi.mock("@/lib/envoi-rappels", () => ({ executerTachesDuMatin: envois.matin }));
vi.mock("@/lib/rappels-programmes", () => ({ executerProgrammesPlanifies: envois.planifies, executerRappelsProgrammes: envois.programmes }));

const { lancerTacheDuMatin, sourceAppelPlanifie } = await import("./tache-du-matin");

/** Base simulée : mêmes règles que les fonctions SQL de la mise à jour 0025. */
function baseSimulee(options: { sans0025?: boolean; jetonCoffre?: string } = {}) {
  const taches = new Map<string, { statut: string }>();
  const rpc = vi.fn(async (nom: string, args: Record<string, unknown>) => {
    if (nom === "jeton_horloge_valide") return { data: args.p_jeton === options.jetonCoffre, error: null };
    if (options.sans0025) return { data: null, error: { code: "PGRST202", message: "fonction introuvable" } };
    const jour = String(args.p_jour);
    if (nom === "reserver_tache_du_matin") {
      const t = taches.get(jour);
      if (t && t.statut !== "echec") return { data: false, error: null };
      taches.set(jour, { statut: "en_cours" });
      return { data: true, error: null };
    }
    if (nom === "terminer_tache_du_matin") taches.set(jour, { statut: args.p_statut === "ok" ? "ok" : "echec" });
    return { data: null, error: null };
  });
  return { admin: { rpc } as unknown as SupabaseClient, taches };
}

beforeEach(() => {
  envois.matin.mockReset().mockResolvedValue({ examinees: 3, rappels: 1, emails: 1, notifications: 0, erreurs: 0, actifs: true });
  envois.planifies.mockReset().mockResolvedValue({ misEnLigne: 0, annonces: 0, notifications: 0 });
  envois.programmes.mockReset().mockResolvedValue({ rappels: 0, notifications: 0, emails: 0 });
});

describe("tâche du matin", () => {
  it("Supabase puis Vercel le même jour : les rappels ne partent qu'une fois", async () => {
    const { admin, taches } = baseSimulee();
    const premier = await lancerTacheDuMatin(admin, "supabase", "2026-11-23");
    const second = await lancerTacheDuMatin(admin, "hebergeur", "2026-11-23");
    expect(premier).toMatchObject({ dejaFaite: false, source: "supabase", rappels: 1 });
    expect(second).toEqual({ dejaFaite: true, jour: "2026-11-23" });
    expect(envois.matin).toHaveBeenCalledTimes(1);
    expect(envois.planifies).toHaveBeenCalledTimes(1);
    expect(envois.programmes).toHaveBeenCalledTimes(1);
    expect(taches.get("2026-11-23")).toEqual({ statut: "ok" });
  });
  it("le lendemain, elle repart", async () => {
    const { admin } = baseSimulee();
    await lancerTacheDuMatin(admin, "supabase", "2026-11-23");
    await lancerTacheDuMatin(admin, "supabase", "2026-11-24");
    expect(envois.matin).toHaveBeenCalledTimes(2);
  });
  it("si le premier passage plante, le suivant la relance", async () => {
    const { admin, taches } = baseSimulee();
    envois.matin.mockRejectedValueOnce(new Error("Brevo indisponible"));
    await expect(lancerTacheDuMatin(admin, "supabase", "2026-11-23")).rejects.toThrow();
    expect(taches.get("2026-11-23")).toEqual({ statut: "echec" });
    expect(await lancerTacheDuMatin(admin, "hebergeur", "2026-11-23")).toMatchObject({ dejaFaite: false });
    expect(envois.matin).toHaveBeenCalledTimes(2);
  });
  it("avant la mise à jour 0025 : elle tourne quand même", async () => {
    const { admin } = baseSimulee({ sans0025: true });
    expect(await lancerTacheDuMatin(admin, "hebergeur", "2026-11-23")).toMatchObject({ dejaFaite: false });
    expect(envois.matin).toHaveBeenCalledTimes(1);
  });
});

describe("qui a le droit de lancer la tâche", () => {
  it("CRON_SECRET (Vercel / Netlify), la clé du coffre Supabase, sinon personne", async () => {
    vi.stubEnv("CRON_SECRET", "secret-hebergeur");
    const { admin } = baseSimulee({ jetonCoffre: "cle-du-coffre" });
    expect(await sourceAppelPlanifie("Bearer secret-hebergeur", admin)).toBe("hebergeur");
    expect(await sourceAppelPlanifie("Bearer cle-du-coffre", admin)).toBe("supabase");
    expect(await sourceAppelPlanifie("Bearer mauvaise-cle", admin)).toBeNull();
    expect(await sourceAppelPlanifie(null, admin)).toBeNull();
    vi.unstubAllEnvs();
  });
});
