import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { categoriesDepuis, lireReponseTally, objectifDepuis, roleQuestion, signatureTallyValide } from "./tally";

const CATS = ["Viande", "Porc", "Volaille", "Poisson", "Fruits de mer", "Œuf", "Produits laitiers", "Gluten", "Fruits à coque", "Arachide", "Soja", "Sésame"].map((nom, i) => ({ id: `c${i}`, nom }));
const id = (nom: string) => CATS.find((c) => c.nom === nom)!.id;

const envoi = {
  eventId: "e1",
  eventType: "FORM_RESPONSE",
  createdAt: "2026-11-23T10:00:00Z",
  data: {
    responseId: "rep-42",
    formName: "Inscription",
    fields: [
      { key: "q1", label: "Ton prénom", type: "INPUT_TEXT", value: "Léa" },
      { key: "q2", label: "Ton nom", type: "INPUT_TEXT", value: "Durand" },
      { key: "q3", label: "Ton adresse email", type: "INPUT_EMAIL", value: " Lea.Durand@Exemple.fr " },
      { key: "q4", label: "Ton objectif principal", type: "MULTIPLE_CHOICE", value: ["o2"], options: [{ id: "o1", text: "Prendre du muscle" }, { id: "o2", text: "Perdre du poids durablement" }] },
      { key: "q5", label: "Allergies ou aliments que tu évites ?", type: "CHECKBOXES", value: ["a1", "a3"], options: [{ id: "a1", text: "Gluten" }, { id: "a2", text: "Lactose" }, { id: "a3", text: "Noix et amandes" }] },
      { key: "q6", label: "Combien de séances de sport par semaine ?", type: "INPUT_NUMBER", value: 3 },
      { key: "q7", label: "Photo", type: "FILE_UPLOAD", value: [{ id: "f", name: "photo.jpg", url: "https://storage.tally.so/x" }] },
      { key: "q8", label: "Question vide", type: "INPUT_TEXT", value: null },
    ],
  },
};

describe("formulaire Tally", () => {
  it("signature : HMAC SHA256 en base64 (ou hexadécimal) avec la clé secrète", () => {
    const corps = JSON.stringify(envoi);
    const b64 = createHmac("sha256", "secret").update(corps).digest("base64");
    const hex = createHmac("sha256", "secret").update(corps).digest("hex");
    expect(signatureTallyValide(corps, b64, "secret")).toBe(true);
    expect(signatureTallyValide(corps, hex, "secret")).toBe(true);
    expect(signatureTallyValide(corps, b64, "autre-secret")).toBe(false);
    expect(signatureTallyValide(corps.replace("Léa", "Eve"), b64, "secret")).toBe(false);
    expect(signatureTallyValide(corps, null, "secret")).toBe(false);
    expect(signatureTallyValide(corps, b64, "")).toBe(false);
  });
  it("lit prénom, nom, email, objectif et exclusions ; garde les autres réponses", () => {
    const r = lireReponseTally(envoi, CATS);
    expect(r).toEqual({
      reference: "rep-42",
      prenom: "Léa",
      nom: "Durand",
      email: "lea.durand@exemple.fr",
      objectif: "Perdre du poids durablement",
      objectifCode: "perte",
      exclusionsTexte: "Gluten, Noix et amandes",
      categoriesExclues: [id("Gluten"), id("Fruits à coque")],
      reponses: [
        { question: "Ton objectif principal", reponse: "Perdre du poids durablement" },
        { question: "Allergies ou aliments que tu évites ?", reponse: "Gluten, Noix et amandes" },
        { question: "Combien de séances de sport par semaine ?", reponse: "3" },
        { question: "Photo", reponse: "(fichier joint : à voir dans Tally)" },
      ],
    });
  });
  it("refuse une réponse sans email ou sans prénom, ou un autre événement", () => {
    const sansEmail = { ...envoi, data: { ...envoi.data, fields: envoi.data.fields.filter((f) => f.key !== "q3") } };
    expect(lireReponseTally(sansEmail, CATS)).toMatchObject({ erreur: expect.stringContaining("email") });
    const sansPrenom = { ...envoi, data: { ...envoi.data, fields: envoi.data.fields.filter((f) => f.key !== "q1") } };
    expect(lireReponseTally(sansPrenom, CATS)).toMatchObject({ erreur: expect.stringContaining("prénom") });
    expect(lireReponseTally({ eventType: "OTHER" }, CATS)).toHaveProperty("erreur");
    expect(lireReponseTally(null, CATS)).toHaveProperty("erreur");
  });
  it("reconnaît les questions par leur intitulé", () => {
    expect(roleQuestion({ label: "Prénom" })).toBe("prenom");
    expect(roleQuestion({ label: "Nom" })).toBe("nom");
    expect(roleQuestion({ label: "Nom de famille" })).toBe("nom");
    expect(roleQuestion({ label: "E-mail" })).toBe("email");
    expect(roleQuestion({ label: "Quel est ton objectif ?" })).toBe("objectif");
    expect(roleQuestion({ label: "As-tu des intolérances ?" })).toBe("exclusions");
    expect(roleQuestion({ label: "Ton métier" })).toBeNull();
  });
  it("objectif : seulement quand c'est clair", () => {
    expect(objectifDepuis("Perdre 5 kilos")).toBe("perte");
    expect(objectifDepuis("Me tonifier")).toBe("recompo");
    expect(objectifDepuis("Prise de masse")).toBe("prise");
    expect(objectifDepuis("Stabiliser mon poids")).toBe("maintien");
    expect(objectifDepuis("Être en forme")).toBeNull();
  });
  it("exclusions : catégories et synonymes, rien si « non »", () => {
    expect(categoriesDepuis("Je suis végétarienne", CATS)).toEqual(["Viande", "Porc", "Volaille", "Poisson", "Fruits de mer"].map(id));
    expect(categoriesDepuis("intolérante au lactose, pas de porc", CATS)).toEqual([id("Porc"), id("Produits laitiers")]);
    expect(categoriesDepuis("allergie aux cacahuètes et aux crevettes", CATS)).toEqual([id("Fruits de mer"), id("Arachide")]);
    expect(categoriesDepuis("œufs", CATS)).toEqual([id("Œuf")]);
    expect(categoriesDepuis("Non", CATS)).toEqual([]);
    expect(categoriesDepuis("aucune", CATS)).toEqual([]);
  });
});
