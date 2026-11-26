import { describe, expect, it } from "vitest";
import {
  conservationAbonneeDepassee,
  dateParisDe,
  etatDepuisStripe,
  lireInscription,
  signatureStripeValide,
  signerCommeStripe,
  textePrix,
  texteMonAbonnement,
} from "./abonnement";

const SECRET = "whsec_test";

describe("abonnement : messages de Stripe", () => {
  it("accepte un message signé par Stripe, refuse le reste", () => {
    const corps = '{"type":"customer.subscription.updated"}';
    const t = 1_800_000_000;
    const entete = signerCommeStripe(corps, SECRET, t);
    expect(signatureStripeValide(corps, entete, SECRET, t + 10)).toBe(true);
    expect(signatureStripeValide(corps + " ", entete, SECRET, t + 10)).toBe(false); // corps modifié
    expect(signatureStripeValide(corps, entete, "whsec_autre", t + 10)).toBe(false); // mauvais secret
    expect(signatureStripeValide(corps, entete, SECRET, t + 3600)).toBe(false); // trop vieux (rejeu)
    expect(signatureStripeValide(corps, null, SECRET, t)).toBe(false);
    expect(signatureStripeValide(corps, "t=abc,v1=", SECRET, t)).toBe(false);
  });

  it("traduit un abonnement en accès", () => {
    const fin = Date.UTC(2026, 11, 26, 10) / 1000;
    const base = { id: "sub_1", customer: "cus_1", items: { data: [{ current_period_end: fin, price: { id: "price_m", recurring: { interval: "month" } } }] } };
    expect(etatDepuisStripe({ ...base, status: "active" })).toEqual({ statut: "active", abonnement_statut: "active", abonnement_formule: "mensuel", abonnement_fin_periode: "2026-12-26", abonnement_resilie: false });
    // Paiement en échec : Stripe réessaie, elle garde l'accès en attendant.
    expect(etatDepuisStripe({ ...base, status: "past_due" })?.statut).toBe("active");
    expect(etatDepuisStripe({ ...base, status: "canceled" })?.statut).toBe("fermee");
    expect(etatDepuisStripe({ ...base, status: "incomplete" })).toBeNull();
    // Ancien format : la fin de période est sur l'abonnement ; formule annuelle ; résiliation programmée.
    const annuel = etatDepuisStripe({ id: "sub_2", customer: "cus_2", status: "active", current_period_end: fin, cancel_at_period_end: true, items: { data: [{ price: { recurring: { interval: "year" } } }] } });
    expect(annuel).toMatchObject({ abonnement_formule: "annuel", abonnement_fin_periode: "2026-12-26", abonnement_resilie: true });
  });

  it("donne les dates à l'heure de Paris", () => {
    expect(dateParisDe(Date.UTC(2026, 11, 31, 23, 30) / 1000)).toBe("2027-01-01");
  });
});

describe("abonnement : page publique et espace", () => {
  it("affiche les prix", () => {
    expect(textePrix({ unit_amount: 990, currency: "eur", recurring: { interval: "month" } })).toBe("9,90 € / mois");
    expect(textePrix({ unit_amount: 9900, currency: "eur", recurring: { interval: "year" } })).toBe("99,00 € / an");
    expect(textePrix(null)).toBeNull();
  });

  it("vérifie le formulaire d'inscription", () => {
    const ok = { prenom: " Léa ", email: "Lea@Exemple.FR ", formule: "annuel", cgv: "on", renonciation: "on" };
    expect(lireInscription(ok).valeurs).toEqual({ prenom: "Léa", email: "lea@exemple.fr", formule: "annuel" });
    expect(lireInscription({ ...ok, email: "lea@" }).erreur).toMatch(/email/);
    expect(lireInscription({ ...ok, formule: "hebdo" }).erreur).toMatch(/formule/);
    expect(lireInscription({ ...ok, cgv: null }).erreur).toMatch(/conditions de vente/);
    expect(lireInscription({ ...ok, renonciation: null }).erreur).toMatch(/accès immédiat/);
    expect(lireInscription({ ...ok, prenom: "" }).erreur).toMatch(/prénom/);
  });

  it("efface les données 6 mois après l'arrêt", () => {
    expect(conservationAbonneeDepassee("2026-05-26", "2026-11-25")).toBe(false);
    expect(conservationAbonneeDepassee("2026-05-26", "2026-11-26")).toBe(true);
    expect(conservationAbonneeDepassee(null, "2030-01-01")).toBe(false);
  });

  it("explique son abonnement", () => {
    const f = (d: string) => d;
    const base = { statut: "active", abonnement_formule: "mensuel", abonnement_fin_periode: "2026-12-26", abonnement_resilie: false, abonnement_statut: "active" };
    expect(texteMonAbonnement(base, f)).toBe("Abonnement au mois, prochain renouvellement le 2026-12-26.");
    expect(texteMonAbonnement({ ...base, abonnement_resilie: true }, f)).toMatch(/tu gardes ton accès jusqu’au 2026-12-26/);
    expect(texteMonAbonnement({ ...base, abonnement_statut: "past_due" }, f)).toMatch(/carte/);
    expect(texteMonAbonnement({ ...base, statut: "fermee" }, f)).toBe("Ton abonnement est terminé.");
  });
});
