import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Preuve d'acceptation du contrat (PDF A4) : qui, quelle version, quand, les deux cases et le texte exact accepté. */

const CHOCOLAT = rgb(0x3b / 255, 0x23 / 255, 0x14 / 255);
const TEXTE_2 = rgb(0x6e / 255, 0x54 / 255, 0x40 / 255);
const SABLE = rgb(0xe9 / 255, 0xd7 / 255, 0xb5 / 255);
const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 48;
const UTILE = LARGEUR - 2 * MARGE;

export async function genererPreuveContrat(o: {
  prenom: string;
  nom: string;
  email: string;
  version: string;
  accepteLe: string;
  texte: string;
  texteRenonciation: string | null;
  genereLe: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Preuve d'acceptation du contrat - version ${o.version}`);
  doc.setAuthor("fitw_cindy");
  doc.setCreator("fitw_cindy");
  const normale = await doc.embedFont(StandardFonts.Helvetica);
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold);

  // Seulement les caractères que les polices standard savent écrire.
  const permis = new Map<string, boolean>();
  const propre = (s: string) =>
    Array.from(s.replace(/[  \t]/g, " ").replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"'))
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
      .join("");

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
          // Mot plus long que la ligne : coupé en morceaux.
          let reste = mot;
          while (police.widthOfTextAtSize(reste, taille) > largeur && reste.length > 1) {
            let n = reste.length;
            while (n > 1 && police.widthOfTextAtSize(reste.slice(0, n), taille) > largeur) n--;
            lignes.push(reste.slice(0, n));
            reste = reste.slice(n);
          }
          ligne = reste;
        }
      }
      lignes.push(ligne);
    }
    return lignes;
  };
  const ecrire = (texte: string, police = normale, taille = 10.5, couleur = CHOCOLAT) => {
    const pas = taille * 1.4;
    for (const l of couper(texte, police, taille, UTILE)) {
      place(pas);
      y -= pas;
      page.drawText(l, { x: MARGE, y, size: taille, font: police, color: couleur });
    }
  };

  ecrire("fitw_cindy", grasse, 14);
  y -= 8;
  ecrire("Preuve d'acceptation du contrat d'accompagnement", grasse, 18);
  y -= 6;
  page.drawRectangle({ x: MARGE, y: y - 112, width: UTILE, height: 104, color: SABLE });
  y -= 14;
  ecrire(`Cliente : ${o.prenom} ${o.nom}`.trim());
  ecrire(`Email du compte : ${o.email}`);
  ecrire(`Version du contrat : ${o.version}`);
  ecrire(`Acceptée le : ${o.accepteLe} (heure de Paris), depuis son compte personnel dans l'app`);
  ecrire(`Document généré le : ${o.genereLe}`, normale, 9.5, TEXTE_2);
  y -= 22;
  ecrire("Cases cochées par la cliente (toutes deux obligatoires)", grasse, 12);
  y -= 2;
  ecrire(`[x] J'ai lu et j'accepte le contrat ci-dessus (version ${o.version}).`);
  ecrire(`[x] ${o.texteRenonciation ?? "Renonciation au droit de rétractation (début immédiat de la prestation)."}`);
  y -= 16;
  ecrire(`Texte exact du contrat accepté (version ${o.version})`, grasse, 12);
  y -= 4;
  ecrire(o.texte, normale, 9.5);
  return doc.save();
}
