/**
 * Génère docs/MOTEUR-CAS.md (cas concrets à valider par Cindy).
 * Lancement : ECRIRE_CAS=1 npx vitest run src/lib/__tests__/rapport-cas.test.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { recettesPourRepas, type ResultatMoteur } from "../moteur";
import { RECETTES, type RecetteTest } from "./donnees-reelles";
import { PROFILS, SANS_EXCLUSION, TOLERANCE } from "./profils";

const ROLES: Record<string, string> = { proteine: "protéine", glucide: "glucide", lipide: "lipide", fruit: "fruit", fixe: "fixe" };
const nf = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
const signe = (n: number) => (n >= 0 ? "+" : "") + nf(n);

function qte(r: RecetteTest, k: number, v: number) {
  const i = r.ingredients[k];
  if (i.unite === "unite") return `${nf(v)} unité${v > 1 ? "s" : ""} (${nf(v * (i.aliment.poids_unite_g ?? 0))} g)`;
  return `${nf(v)} g`;
}

function fiche(r: RecetteTest, res: ResultatMoteur, cible: { proteines: number; glucides: number; lipides: number }) {
  const lignes = r.ingredients.map(
    (i, k) => `| ${r.noms[k]} | ${ROLES[i.role]} | ${qte(r, k, i.base)} | **${qte(r, k, res.quantites[k].quantite)}** |`,
  );
  return [
    `**${r.titre}** — ${res.compatible ? "✅ proposée" : "⚠️ approximative"}`,
    "",
    "| Ingrédient | Rôle | Recette de base | Pour cette cliente |",
    "|---|---|---|---|",
    ...lignes,
    "",
    `Obtenu : P ${nf(res.macros.proteines)} g (${signe(res.ecarts.proteines)}) · G ${nf(res.macros.glucides)} g (${signe(res.ecarts.glucides)}) · L ${nf(res.macros.lipides)} g (${signe(res.ecarts.lipides)}) · ${Math.round(res.macros.kcal)} kcal — cible P ${cible.proteines} / G ${cible.glucides} / L ${cible.lipides}`,
    "",
  ].join("\n");
}

it.runIf(process.env.ECRIRE_CAS === "1")("rapport des cas concrets", () => {
  const out: string[] = [
    "# Moteur de recettes : cas concrets à valider",
    "",
    "> Généré automatiquement à partir des 50 recettes de départ et de la table Ciqual.",
    `> Tolérance : ±${TOLERANCE.pct} % par macro, ou ±${TOLERANCE.g} g si c'est plus large. Réglage « masquer » : une recette hors tolérance n'est pas proposée.`,
    "",
    "## 1. Combien de recettes sont proposées ?",
    "",
    "| Profil | Repas | Cible (P / G / L) | Proposées | Non proposées |",
    "|---|---|---|---|---|",
  ];
  for (const p of PROFILS) {
    for (const rp of p.repas) {
      const s = recettesPourRepas(RECETTES, rp.type, rp.cible, TOLERANCE, SANS_EXCLUSION, true);
      out.push(
        `| ${p.nom} (${p.description}) | ${rp.libelle} | ${rp.cible.proteines} / ${rp.cible.glucides} / ${rp.cible.lipides} | ${s.compatibles.length} | ${s.approximatives.length ? s.approximatives.map((a) => a.recette.titre).join(", ") : "—"} |`,
      );
    }
  }
  const a = PROFILS[0];
  out.push("", `## 2. Exemples détaillés — ${a.nom} (${a.description})`, "");
  out.push("Pour chaque repas : les 3 recettes qui collent le mieux, avec les quantités de base et celles calculées pour la cliente.", "");
  for (const rp of a.repas) {
    const s = recettesPourRepas(RECETTES, rp.type, rp.cible, TOLERANCE, SANS_EXCLUSION, true);
    out.push(`### ${rp.libelle} — cible P ${rp.cible.proteines} g / G ${rp.cible.glucides} g / L ${rp.cible.lipides} g`, "");
    for (const x of s.compatibles.slice(0, 3)) out.push(fiche(x.recette, x.resultat, rp.cible));
    if (s.approximatives[0]) {
      out.push("Exemple de recette **non proposée** (hors tolérance) :", "");
      out.push(fiche(s.approximatives[0].recette, s.approximatives[0].resultat, rp.cible));
    }
  }
  out.push(
    "## 3. Ce que j'aimerais que tu vérifies",
    "",
    "1. Les quantités « Pour cette cliente » te semblent-elles **réalistes et appétissantes** (ni trop, ni trop peu) ?",
    "2. La tolérance de ±10 % (ou ±3 g) te convient-elle ? Plus large = plus de recettes proposées, moins précises.",
    "3. Les recettes non proposées pour un repas : est-ce logique pour toi (ex. un smoothie trop copieux pour une petite collation) ?",
    "",
  );
  writeFileSync(join(__dirname, "..", "..", "..", "docs", "MOTEUR-CAS.md"), out.join("\n"));
});
