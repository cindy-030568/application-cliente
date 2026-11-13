import { describe, expect, it } from "vitest";
import { momentRelatif, nettoyerTexte, notificationPermise, ordonner, photoDe, regrouperReactions } from "./communaute";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";

describe("communauté", () => {
  it("regroupe les réactions et repère les miennes", () => {
    const r = regrouperReactions(
      [
        { message_id: "m1", auteur_id: U1, emoji: "coeur" },
        { message_id: "m1", auteur_id: U2, emoji: "coeur" },
        { message_id: "m1", auteur_id: U1, emoji: "bravo" },
        { message_id: "m2", auteur_id: U2, emoji: "inconnue" },
      ],
      U1,
    );
    expect(r.get("m1")?.reactions).toEqual({ coeur: 2, bravo: 1, force: 0, rire: 0 });
    expect(r.get("m1")?.miennes).toEqual(["coeur", "bravo"]);
    expect(r.has("m2")).toBe(false);
  });

  it("n'accepte que les photos rangées dans le dossier de l'autrice", () => {
    expect(photoDe(`${U1}/${F}.jpg`, U1)).toBe(true);
    expect(photoDe(`${U2}/${F}.jpg`, U1)).toBe(false);
    expect(photoDe(`${U1}/../${F}.jpg`, U1)).toBe(false);
    expect(photoDe(`${U1}/${F}.png`, U1)).toBe(false);
  });

  it("nettoie le texte", () => {
    expect(nettoyerTexte("  Coucou\r\n\n\n\n\nça va ?\u0007  ")).toBe("Coucou\n\n\nça va ?");
    expect(nettoyerTexte("x".repeat(3000))).toHaveLength(2000);
  });

  it("affiche un moment lisible (heure de Paris)", () => {
    const m = new Date("2026-11-13T15:00:00Z"); // 16:00 à Paris
    expect(momentRelatif("2026-11-13T14:59:30Z", m)).toBe("à l’instant");
    expect(momentRelatif("2026-11-13T14:35:00Z", m)).toBe("il y a 25 min");
    expect(momentRelatif("2026-11-13T12:00:00Z", m)).toBe("il y a 3 h");
    expect(momentRelatif("2026-11-13T06:10:00Z", m)).toBe("aujourd’hui à 07:10");
    expect(momentRelatif("2026-11-12T17:02:00Z", m)).toBe("hier à 18:02");
    expect(momentRelatif("2026-11-02T08:30:00Z", m)).toBe("2 nov. à 09:30");
    expect(momentRelatif("2025-12-24T19:00:00Z", m)).toBe("24 déc. 2025 à 20:00");
  });

  it("limite les notifications à une par heure", () => {
    const m = new Date("2026-11-13T15:00:00Z");
    const base = { notifications: true, derniere_notif: null, dernier_vu: "2026-11-13T10:00:00Z" };
    expect(notificationPermise(base, m)).toBe(true);
    expect(notificationPermise({ ...base, notifications: false }, m)).toBe(false);
    expect(notificationPermise({ ...base, derniere_notif: "2026-11-13T14:30:00Z" }, m)).toBe(false);
    expect(notificationPermise({ ...base, derniere_notif: "2026-11-13T13:59:00Z" }, m)).toBe(true);
    expect(notificationPermise({ ...base, dernier_vu: "2026-11-13T14:59:00Z" }, m)).toBe(false);
  });

  it("met les messages épinglés en tête", () => {
    const o = ordonner([
      { id: "a", epingle: false, creeLe: "2026-11-13T10:00:00Z" },
      { id: "b", epingle: true, creeLe: "2026-11-01T10:00:00Z" },
      { id: "c", epingle: false, creeLe: "2026-11-13T12:00:00Z" },
    ]);
    expect(o.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });
});
