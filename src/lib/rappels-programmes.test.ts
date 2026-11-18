import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/envoi-rappels", () => ({ configurationRappels: () => ({ push: false, email: false }) }));
vi.mock("@/lib/notifications-coach", () => ({ envoyerALaCoach: vi.fn(), lirePrefsNotifCoach: vi.fn() }));

const { contenuRappelProgrammes } = await import("./rappels-programmes");

describe("rappel de changement de programme", () => {
  it("une cliente, une semaine avant", () => {
    const c = contenuRappelProgrammes([{ clienteId: "c1", prenom: "Léa", date: "2026-11-25", type: "bientot" }], "2026-11-18");
    expect(c.texte).toBe("Le programme sportif de Léa est à changer le mercredi 25 novembre (dans 7 j).");
    expect(c.url).toBe("/coach/clientes/c1/programme-sportif");
  });
  it("une cliente, le jour même", () => {
    const c = contenuRappelProgrammes([{ clienteId: "c1", prenom: "Léa", date: "2026-11-18", type: "jour" }], "2026-11-18");
    expect(c.texte).toMatch(/arrive au bout de ses 6 semaines/);
  });
  it("plusieurs clientes : un seul message", () => {
    const c = contenuRappelProgrammes(
      [
        { clienteId: "c1", prenom: "Léa", date: "2026-11-18", type: "jour" },
        { clienteId: "c2", prenom: "Zoé", date: "2026-11-25", type: "bientot" },
      ],
      "2026-11-18",
    );
    expect(c.texte).toBe("2 programmes sportifs à changer : Léa (aujourd’hui), Zoé (dans 7 j).");
    expect(c.url).toBe("/coach");
  });
});
