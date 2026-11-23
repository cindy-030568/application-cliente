import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/envoi-rappels", () => ({ configurationRappels: () => ({ push: false, email: false }), envoyerEmail: vi.fn(), envoyerPush: vi.fn() }));

const { contenuNotifCoach, PAR_DEFAUT } = await import("./notifications-coach");

describe("notifications de la coach", () => {
  it("tout est coché par défaut", () => {
    expect(Object.values(PAR_DEFAUT).every(Boolean)).toBe(true);
  });
  it("journée remplie et séance faite", () => {
    expect(contenuNotifCoach({ type: "journal", clienteId: "c1" }, "Léa").texte).toBe("Léa a rempli sa journée.");
    const s = contenuNotifCoach({ type: "seance", clienteId: "c1", nom: "Haut du corps" }, "Léa");
    expect(s.texte).toBe("Léa a terminé sa séance « Haut du corps ».");
    expect(s.url).toBe("/coach/clientes/c1/programme-sportif");
  });
  it("note à lire vite : le motif, jamais le texte de la cliente", () => {
    const a = contenuNotifCoach({ type: "alerte", clienteId: "c1", motif: "douleur", source: "journal" }, "Léa");
    expect(a.titre).toBe("À lire vite ⚠️");
    expect(a.texte).toBe("Léa a écrit dans les notes de sa journée quelque chose qui concerne une douleur ou une blessure.");
    expect(a.url).toBe("/coach/clientes/c1/suivi");
    const b = contenuNotifCoach({ type: "alerte", clienteId: "c1", motif: "moral", source: "seance" }, "");
    expect(b.texte).toMatch(/^Une cliente a écrit en commentaire de sa séance/);
  });
});
