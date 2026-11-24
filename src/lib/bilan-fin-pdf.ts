import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { ecartSigne } from "./bilan-fin";
import type { DonneesBilanFin } from "./bilan-fin-serveur";

/** Bilan de fin de suivi en PDF (A4), aux couleurs de l'app : à garder. Respecte le mode sans chiffres. */

const CHOCOLAT = rgb(0x3b / 255, 0x23 / 255, 0x14 / 255);
const TEXTE_2 = rgb(0x6e / 255, 0x54 / 255, 0x40 / 255);
const ACCENT = rgb(0xd6 / 255, 0x33 / 255, 0x6c / 255);
const SABLE = rgb(0xe9 / 255, 0xd7 / 255, 0xb5 / 255);
const CREME = rgb(0xff / 255, 0xfa / 255, 0xf0 / 255);
const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 48;
const UTILE = LARGEUR - 2 * MARGE;

const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const date = (j: string) => dateLongue.format(new Date(`${j}T12:00:00Z`));
const nombre = (n: number) => n.toLocaleString("fr-FR").replace(/\s/g, " ");

export async function genererPdfBilanFin(d: DonneesBilanFin, photos: { avant: Uint8Array; apres: Uint8Array } | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Mon bilan de fin de suivi");
  doc.setAuthor("fitw_cindy");
  doc.setCreator("fitw_cindy");
  const normale = await doc.embedFont(StandardFonts.Helvetica);
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold);

  // Seulement les caractères que les polices standard savent écrire (les emojis sont retirés).
  const permis = new Map<string, boolean>();
  const propre = (s: string) =>
    Array.from(s.replace(/[  \t]/g, " ").replace(/[–—−]/g, "-").replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"'))
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
      .replace(/ +/g, " ");

  let page: PDFPage = doc.addPage([LARGEUR, HAUTEUR]);
  let y = HAUTEUR - MARGE;
  const place = (h: number) => {
    if (y - h < MARGE + 20) {
      page = doc.addPage([LARGEUR, HAUTEUR]);
      y = HAUTEUR - MARGE;
    }
  };
  const couper = (texte: string, police: PDFFont, taille: number, largeur: number) => {
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
  const ecrire = (texte: string, police = normale, taille = 11, couleur = CHOCOLAT, x = MARGE, largeur = UTILE) => {
    const pas = taille * 1.45;
    for (const l of couper(texte, police, taille, largeur)) {
      place(pas);
      y -= pas;
      page.drawText(l, { x, y, size: taille, font: police, color: couleur });
    }
  };
  const titre = (t: string) => {
    place(50);
    y -= 18;
    ecrire(t, grasse, 15);
    y -= 4;
  };

  // En-tête
  page.drawRectangle({ x: 0, y: HAUTEUR - 150, width: LARGEUR, height: 150, color: CHOCOLAT });
  y = HAUTEUR - MARGE;
  ecrire("fitw_cindy", grasse, 13, CREME);
  y -= 10;
  ecrire(d.prenom ? `${d.prenom}, ton bilan de fin de suivi` : "Ton bilan de fin de suivi", grasse, 22, CREME);
  if (d.debut) ecrire(`Depuis le ${date(d.debut)}${d.fin ? ` jusqu'au ${date(d.fin)}` : ""}`, normale, 11.5, SABLE);
  y = HAUTEUR - 180;

  // Chiffres du parcours
  const cases = (
    [
      [d.chiffres.seances, d.chiffres.seances > 1 ? "séances faites" : "séance faite"],
      [d.chiffres.bilans, d.chiffres.bilans > 1 ? "bilans envoyés" : "bilan envoyé"],
      [d.chiffres.joursJournal, d.chiffres.joursJournal > 1 ? "jours de journal" : "jour de journal"],
    ] as const
  ).filter(([n]) => n > 0);
  const l = (UTILE - Math.max(0, cases.length - 1) * 12) / Math.max(1, cases.length);
  cases.forEach(([n, libelle], i) => {
    const x = MARGE + i * (l + 12);
    page.drawRectangle({ x, y: y - 58, width: l, height: 58, color: SABLE });
    page.drawText(propre(String(n)), { x: x + 14, y: y - 30, size: 20, font: grasse, color: CHOCOLAT });
    page.drawText(propre(libelle), { x: x + 14, y: y - 48, size: 10, font: normale, color: TEXTE_2 });
  });
  if (cases.length) y -= 70;

  // Avant / après
  if (photos) {
    const images: PDFImage[] = [];
    for (const octets of [photos.avant, photos.apres]) {
      const png = octets[0] === 0x89 && octets[1] === 0x50;
      images.push(png ? await doc.embedPng(octets) : await doc.embedJpg(octets));
    }
    titre("Avant / après");
    const largeur = (UTILE - 16) / 2;
    const hauteur = Math.min(260, largeur * 1.33);
    place(hauteur + 24);
    images.forEach((img, i) => {
      const echelle = Math.min(largeur / img.width, hauteur / img.height);
      const w = img.width * echelle;
      const h = img.height * echelle;
      const x = MARGE + i * (largeur + 16) + (largeur - w) / 2;
      page.drawImage(img, { x, y: y - h, width: w, height: h });
      const legende = propre(`${i === 0 ? "Avant" : "Après"} - ${date(i === 0 ? d.photos!.avant.date : d.photos!.apres.date)}`);
      page.drawText(legende, { x: MARGE + i * (largeur + 16), y: y - hauteur - 16, size: 10, font: normale, color: TEXTE_2 });
    });
    y -= hauteur + 24;
  }

  // Mesures avec une petite courbe
  if (d.evolutions.length) {
    titre("Tes mesures");
    for (const e of d.evolutions) {
      place(70);
      const unite = e.unite ? ` ${e.unite}` : "";
      page.drawText(propre(e.libelle), { x: MARGE, y: y - 16, size: 11.5, font: grasse, color: CHOCOLAT });
      page.drawText(propre(`${nombre(e.depart)} -> ${nombre(e.actuel)}${unite}  (${ecartSigne(e.ecart)}${unite})`), { x: MARGE, y: y - 32, size: 10.5, font: normale, color: TEXTE_2 });
      const cx = MARGE + UTILE * 0.55;
      const cl = UTILE * 0.45;
      const valeurs = e.points.map((p) => p.valeur);
      const min = Math.min(...valeurs);
      const max = Math.max(...valeurs);
      const pts = e.points.map((p, i) => ({ x: cx + (i * cl) / Math.max(1, e.points.length - 1), y: y - 46 + ((p.valeur - min) / (max - min || 1)) * 36 }));
      for (let i = 1; i < pts.length; i++) page.drawLine({ start: pts[i - 1], end: pts[i], thickness: 2, color: ACCENT });
      for (const p of pts) page.drawCircle({ x: p.x, y: p.y, size: 2.6, color: ACCENT });
      y -= 60;
    }
  }

  // Charges
  if (d.progression.length) {
    titre("Tu es devenue plus forte");
    for (const x of d.progression) ecrire(d.sansChiffres ? `- ${x.nom}` : `- ${x.nom} : ${nombre(x.depart)} kg -> ${nombre(x.meilleur)} kg`);
  }

  y -= 20;
  ecrire("Tout ce chemin, c'est toi qui l'as fait. Garde ces habitudes avec toi : elles t'appartiennent.", grasse, 12.5, ACCENT);
  y -= 6;
  ecrire("Cindy", normale, 11, TEXTE_2);
  return doc.save();
}
