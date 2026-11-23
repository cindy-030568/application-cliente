import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/envoi-rappels", () => ({ configurationRappels: () => ({ push: false, email: false }) }));
vi.mock("@/lib/notifications-coach", () => ({ envoyerALaCoach: vi.fn(), lirePrefsNotifCoach: vi.fn() }));
vi.mock("@/lib/programme-sportif-serveur", () => ({ activerProgrammesPlanifies: vi.fn(), clientesAvecSuitePlanifiee: vi.fn() }));

const { contenuRappelProgrammes, texteAnnonceProgramme } = await import("./rappels-programmes");

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
  it("une cliente, 3 jours avant : le suivant n'est pas dans l'appli", () => {
    const c = contenuRappelProgrammes([{ clienteId: "c1", prenom: "Léa", date: "2026-11-21", type: "relance" }], "2026-11-18");
    expect(c.texte).toBe("Le programme sportif de Léa se termine le samedi 21 novembre (dans 3 j) et le suivant n’est pas encore dans l’appli.");
  });
  it("une cliente, en retard : relance", () => {
    const c = contenuRappelProgrammes([{ clienteId: "c1", prenom: "Léa", date: "2026-11-15", type: "retard" }], "2026-11-18");
    expect(c.titre).toMatch(/^Relance/);
    expect(c.texte).toBe("Relance : le programme sportif de Léa est terminé depuis 3 jours et le suivant n’est pas encore dans l’appli.");
    expect(c.sujet).toBe("Relance : programme sportif de Léa à changer");
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

describe("annonce du nouveau programme à la cliente", () => {
  it("3 jours avant, puis la veille", () => {
    expect(texteAnnonceProgramme("2026-11-21", "2026-11-18")).toBe("Ton nouveau programme sportif arrive samedi 21 novembre (dans 3 jours). Termine bien celui-ci, tu y es presque !");
    expect(texteAnnonceProgramme("2026-11-19", "2026-11-18")).toMatch(/arrive demain\./);
  });
});
