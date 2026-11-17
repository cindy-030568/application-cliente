import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { apportsPlan, apportsRepas, repasRemplis, texteChoix, type ContenuPlan } from "./plan-alimentaire";

/** PDF du plan alimentaire (A4), aux couleurs de l'app. Polices standard : les emojis sont retirés. */

const CHOCOLAT = rgb(0x3b / 255, 0x23 / 255, 0x14 / 255);
const TEXTE_2 = rgb(0x6e / 255, 0x54 / 255, 0x40 / 255);
const CARAMEL = rgb(0x94 / 255, 0x58 / 255, 0x1c / 255);
const SABLE = rgb(0xe9 / 255, 0xd7 / 255, 0xb5 / 255);
const CREME = rgb(0xff / 255, 0xfa / 255, 0xf0 / 255);
const ACCENT = rgb(0xd6 / 255, 0x33 / 255, 0x6c / 255);

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 48;
const UTILE = LARGEUR - 2 * MARGE;

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export async function genererPdfPlan(o: {
  titre: string;
  prenom: string;
  contenu: ContenuPlan;
  recommandations: string;
  sansChiffres: boolean;
  date: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(o.titre);
  doc.setAuthor("fitw_cindy");
  doc.setCreator("fitw_cindy");
  const normale = await doc.embedFont(StandardFonts.Helvetica);
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold);
  const italique = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Ne garde que les caractères que les polices standard savent écrire.
  const permis = new Map<string, boolean>();
  const propre = (s: string) =>
    Array.from(s.replace(/[  \t]/g, " ").replace(/[–—]/g, "-"))
      .filter((ch) => {
        if (ch === "\n") return true;
        if (!permis.has(ch)) {
          try {
            normale.encodeText(ch);
            permis.set(ch, true);
          } catch {
            permis.set(ch, false);
          }
        }
        return permis.get(ch);
      })
      .join("")
      .replace(/ {2,}/g, " ");

  let page: PDFPage = doc.addPage([LARGEUR, HAUTEUR]);
  let y = HAUTEUR - MARGE;
  const nouvellePage = () => {
    page = doc.addPage([LARGEUR, HAUTEUR]);
    y = HAUTEUR - MARGE;
  };
  const place = (h: number) => {
    if (y - h < MARGE + 20) nouvellePage();
  };

  /** Coupe un texte en lignes qui tiennent dans `largeur`. */
  const couper = (texte: string, police: PDFFont, taille: number, largeur: number): string[] => {
    const lignes: string[] = [];
    for (const paragraphe of propre(texte).split("\n")) {
      let ligne = "";
      for (const mot of paragraphe.split(" ")) {
        const essai = ligne ? `${ligne} ${mot}` : mot;
        if (police.widthOfTextAtSize(essai, taille) <= largeur) ligne = essai;
        else {
          if (ligne) lignes.push(ligne);
          ligne = mot;
        }
      }
      lignes.push(ligne);
    }
    return lignes;
  };
  const ecrire = (texte: string, o2: { police?: PDFFont; taille?: number; couleur?: ReturnType<typeof rgb>; x?: number; largeur?: number; interligne?: number }) => {
    const police = o2.police ?? normale;
    const taille = o2.taille ?? 10.5;
    const x = o2.x ?? MARGE;
    const pas = taille * (o2.interligne ?? 1.35);
    for (const l of couper(texte, police, taille, o2.largeur ?? UTILE - (x - MARGE))) {
      place(pas);
      y -= pas;
      page.drawText(l, { x, y, size: taille, font: police, color: o2.couleur ?? CHOCOLAT });
    }
  };

  // En-tête
  page.drawText("fitw", { x: MARGE, y: y - 14, size: 14, font: grasse, color: CHOCOLAT });
  page.drawText("_", { x: MARGE + grasse.widthOfTextAtSize("fitw", 14), y: y - 14, size: 14, font: grasse, color: rgb(0xc1 / 255, 0x7f / 255, 0x3a / 255) });
  page.drawText("cindy", { x: MARGE + grasse.widthOfTextAtSize("fitw_", 14), y: y - 14, size: 14, font: grasse, color: CHOCOLAT });
  y -= 30;
  ecrire(o.titre, { police: grasse, taille: 22 });
  y -= 4;
  const total = apportsPlan(o.contenu);
  const sousTitre = [`Pour ${o.prenom}`, o.date, !o.sansChiffres && total.kcal > 0 ? `environ ${nf.format(total.kcal)} kcal par jour` : null]
    .filter(Boolean)
    .join(" · ");
  ecrire(sousTitre, { taille: 10.5, couleur: TEXTE_2 });
  y -= 6;
  ecrire("Pour chaque aliment, les propositions « ou » sont des équivalences : choisis celle qui te fait envie.", {
    police: italique,
    taille: 9.5,
    couleur: TEXTE_2,
  });
  y -= 10;

  for (const r of repasRemplis(o.contenu)) {
    place(60);
    // Bandeau du repas
    y -= 24;
    page.drawRectangle({ x: MARGE, y: y - 6, width: UTILE, height: 24, color: SABLE });
    const entete = propre(`${r.heure ? `${r.heure}  ·  ` : ""}${r.libelle}`);
    page.drawText(entete, { x: MARGE + 10, y: y + 1, size: 12.5, font: grasse, color: CHOCOLAT });
    if (!o.sansChiffres && r.lignes.length) {
      const k = `${nf.format(apportsRepas(r).kcal)} kcal`;
      page.drawText(propre(k), { x: MARGE + UTILE - 10 - normale.widthOfTextAtSize(k, 10), y: y + 2, size: 10, font: normale, color: TEXTE_2 });
    }
    y -= 10;

    for (const l of r.lignes) {
      place(18 + l.alternatives.length * 14);
      y -= 4;
      page.drawCircle({ x: MARGE + 8, y: y - 9, size: 2.2, color: ACCENT });
      ecrire(texteChoix(l.principal), { police: grasse, taille: 10.5, x: MARGE + 16 });
      for (const a of l.alternatives) ecrire(`ou  ${texteChoix(a)}`, { taille: 9.8, x: MARGE + 28, couleur: TEXTE_2 });
    }
    if (r.note.trim()) {
      y -= 6;
      ecrire(r.note.trim(), { police: italique, taille: 9.8, x: MARGE + 10, couleur: TEXTE_2 });
    }
    y -= 12;
  }

  if (o.recommandations.trim()) {
    place(60);
    y -= 10;
    page.drawLine({ start: { x: MARGE, y }, end: { x: MARGE + UTILE, y }, thickness: 0.8, color: SABLE });
    y -= 8;
    ecrire("Recommandations", { police: grasse, taille: 14, couleur: CARAMEL });
    y -= 4;
    ecrire(o.recommandations.trim(), { taille: 10.2 });
  }

  // Pied de page : numéros
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: 26, color: CREME });
    const t = propre(`fitw_cindy · ${o.titre} · ${i + 1}/${pages.length}`);
    p.drawText(t, { x: MARGE, y: 10, size: 8, font: normale, color: TEXTE_2 });
  });

  return doc.save();
}
