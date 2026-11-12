import Link from "next/link";
import { Etiquette, Surtitre } from "@/components/ui";
import { libelleChamp } from "@/lib/champs";
import type { Bilan, ChampMesure } from "@/lib/types";
import { ComparatifPhotos, type PhotoDatee } from "./comparatif-photos";
import { GraphiqueSuivi } from "./graphique";

const formatDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatNombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function valeurAffichee(champ: ChampMesure, bilan: Bilan): string | null {
  const v = bilan.valeurs.find((x) => x.champ_id === champ.id);
  if (!v) return null;
  if (v.valeur_texte !== null) return v.valeur_texte;
  if (v.valeur_num === null) return null;
  return `${formatNombre.format(v.valeur_num)}${champ.unite ? ` ${champ.unite}` : champ.type === "echelle" ? "/10" : ""}`;
}

/** Graphiques (un par indicateur, tous à égalité), photos et historique. */
export function VueSuivi({
  champs,
  bilans,
  photos,
  masquerPoids,
  sansChiffres,
  lienBilan,
  jours,
  vueCoach = false,
}: {
  champs: ChampMesure[];
  bilans: Bilan[];
  photos: PhotoDatee[];
  masquerPoids: boolean;
  sansChiffres: boolean;
  /** Préfixe des liens vers un bilan, ex. « /suivi/ ». */
  lienBilan: string;
  jours: number;
  vueCoach?: boolean;
}) {
  const champsGraphiques = champs.filter(
    (c) => (c.type === "nombre" || c.type === "echelle") && !(masquerPoids && c.est_poids && !vueCoach),
  );
  const points = (c: ChampMesure) =>
    bilans.flatMap((b) => {
      const v = b.valeurs.find((x) => x.champ_id === c.id);
      return v && v.valeur_num !== null ? [{ date: b.date_mesure, valeur: v.valeur_num }] : [];
    });
  const avecDonnees = champsGraphiques.filter((c) => points(c).length > 0);
  const colonnes = champs.filter((c) => c.type !== "texte" && bilans.some((b) => valeurAffichee(c, b) !== null));

  return (
    <div className="flex flex-col gap-8">
      {avecDonnees.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="titre-evolution">
          <Surtitre>
            <span id="titre-evolution">Mon évolution</span>
          </Surtitre>
          {vueCoach && masquerPoids && (
            <p className="text-[13px] text-texte-2">Le graphique du poids est masqué pour elle.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {avecDonnees.map((c) => (
              <GraphiqueSuivi
                key={c.id}
                titre={libelleChamp(c, jours)}
                unite={c.unite}
                echelle={c.type === "echelle"}
                points={points(c)}
              />
            ))}
          </div>
        </section>
      )}

      {!sansChiffres && photos.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="titre-photos">
          <Surtitre>
            <span id="titre-photos">Photos avant / après</span>
          </Surtitre>
          <ComparatifPhotos photos={photos} />
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="titre-historique">
        <Surtitre>
          <span id="titre-historique">Historique</span>
        </Surtitre>
        {bilans.length === 0 ? (
          <p className="text-[14px] text-texte-2">Aucun bilan pour l’instant.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-ligne overflow-hidden rounded-carte bg-blanc-casse shadow-douce">
              {bilans.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`${lienBilan}${b.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-sable/40"
                  >
                    <span className="flex flex-col">
                      <span className="text-[15px] font-medium">{formatDate.format(Date.parse(b.date_mesure))}</span>
                      <span className="text-[13px] text-texte-2">
                        {b.echeance ? "Bilan" : "Saisie libre"}
                        {b.photos.length > 0 && ` · ${b.photos.length} photo${b.photos.length > 1 ? "s" : ""}`}
                      </span>
                    </span>
                    {b.retour ? (
                      <Etiquette ton={!vueCoach && !b.retour.lu_le ? "rose" : "vert"}>
                        {!vueCoach && !b.retour.lu_le ? "Nouveau retour" : "Retour envoyé"}
                      </Etiquette>
                    ) : vueCoach && b.echeance ? (
                      <Etiquette ton="sable">À traiter</Etiquette>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>

            {colonnes.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-[14px] text-texte-2 hover:text-chocolat">
                  Voir en tableau
                </summary>
                <div className="mt-3 overflow-x-auto rounded-carte bg-blanc-casse shadow-douce">
                  <table className="w-max min-w-full border-collapse text-[13.5px]">
                    <thead>
                      <tr className="text-left text-texte-2">
                        <th scope="col" className="sticky left-0 bg-blanc-casse px-3 py-2.5 font-medium">
                          Date
                        </th>
                        {colonnes.map((c) => (
                          <th key={c.id} scope="col" className="px-3 py-2.5 font-medium">
                            {libelleChamp(c, jours)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {bilans.map((b) => (
                        <tr key={b.id} className="border-t border-ligne">
                          <th scope="row" className="sticky left-0 bg-blanc-casse px-3 py-2.5 text-left font-normal">
                            {formatDate.format(Date.parse(b.date_mesure))}
                          </th>
                          {colonnes.map((c) => (
                            <td key={c.id} className="px-3 py-2.5">
                              {valeurAffichee(c, b) ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}
