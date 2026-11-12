import { Surtitre } from "@/components/ui";
import { libelleChamp, parSection } from "@/lib/champs";
import { ANGLES, type Bilan, type ChampMesure } from "@/lib/types";
import { valeurAffichee } from "./vue-suivi";

/** Contenu d'un bilan, rubrique par rubrique (trame de Cindy), puis photos et commentaire. */
export function DetailBilan({
  bilan,
  champs,
  urls,
  jours,
  precedent,
  comparer = false,
}: {
  bilan: Bilan;
  champs: ChampMesure[];
  urls: Map<string, string>;
  jours: number;
  precedent?: Bilan | null;
  comparer?: boolean;
}) {
  const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
  const valeur = (c: ChampMesure) => bilan.valeurs.find((v) => v.champ_id === c.id);
  const sections = parSection(champs.filter((c) => valeurAffichee(c, bilan) !== null || valeur(c)?.precision));

  const ecart = (c: ChampMesure) => {
    if (!comparer || !precedent || (c.type !== "nombre" && c.type !== "echelle")) return null;
    const a = precedent.valeurs.find((v) => v.champ_id === c.id)?.valeur_num;
    const b = valeur(c)?.valeur_num;
    if (a == null || b == null) return null;
    const d = Math.round((b - a) * 100) / 100;
    return d === 0 ? "=" : `${nf.format(d)}${c.unite ? ` ${c.unite}` : ""}`;
  };

  const precision = (c: ChampMesure) => {
    const p = valeur(c)?.precision;
    return p ? <p className="mt-1 whitespace-pre-wrap text-[14px] italic text-texte-2">« {p} »</p> : null;
  };

  return (
    <div className="flex flex-col gap-7">
      {sections.map(({ section, champs: liste }) => {
        // Dans l'ordre de la trame : les notes et mesures qui se suivent sont regroupées en grille.
        const compact = (c: ChampMesure) => c.type === "nombre" || (c.type === "echelle" && !valeur(c)?.precision);
        const blocs: ChampMesure[][] = [];
        for (const c of liste) {
          const dernier = blocs[blocs.length - 1];
          if (dernier && compact(c) && compact(dernier[0])) dernier.push(c);
          else blocs.push([c]);
        }
        return (
          <section key={section} className="flex flex-col gap-3">
            <Surtitre>{section}</Surtitre>
            {blocs.map((bloc) =>
              compact(bloc[0]) ? (
                <dl key={bloc[0].id} className="grid grid-cols-2 gap-2">
                  {bloc.map((c) => (
                    <div key={c.id} className="flex flex-col rounded-xl bg-blanc-casse px-4 py-3 shadow-douce">
                      <dt className="text-[13px] leading-snug text-texte-2">{libelleChamp(c, jours)}</dt>
                      <dd className="mt-auto flex items-baseline justify-between gap-2 pt-1">
                        <span className="text-[17px] font-medium tabular-nums">{valeurAffichee(c, bilan)}</span>
                        {ecart(c) && <span className="text-[12.5px] tabular-nums text-texte-2">{ecart(c)}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                bloc.map((c) => (
                  <div key={c.id} className="rounded-xl bg-blanc-casse px-4 py-3 shadow-douce">
                    <p className="text-[13px] leading-snug text-texte-2">{libelleChamp(c, jours)}</p>
                    {valeurAffichee(c, bilan) !== null &&
                      (c.type === "texte" ? (
                        <p className="mt-1 whitespace-pre-wrap text-[15.5px] leading-relaxed">{valeurAffichee(c, bilan)}</p>
                      ) : (
                        <p className="mt-1 flex items-baseline justify-between gap-2">
                          <span className="text-[16px] font-medium">{valeurAffichee(c, bilan)}</span>
                          {ecart(c) && <span className="text-[12.5px] tabular-nums text-texte-2">{ecart(c)}</span>}
                        </p>
                      ))}
                    {precision(c)}
                  </div>
                ))
              ),
            )}
          </section>
        );
      })}

      {bilan.photos.length > 0 && (
        <section className="flex flex-col gap-2">
          <Surtitre>Photos</Surtitre>
          <div className="grid grid-cols-3 gap-2">
            {ANGLES.map(({ valeur: angle, libelle }) => {
              const p = bilan.photos.find((x) => x.angle === angle);
              const url = p && urls.get(p.fichier_path);
              return url ? (
                <a key={angle} href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${libelle}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <span className="text-center text-[12.5px] text-texte-2">{libelle}</span>
                </a>
              ) : null;
            })}
          </div>
        </section>
      )}

      {bilan.commentaire && (
        <section className="flex flex-col gap-2">
          <Surtitre>Commentaire</Surtitre>
          <p className="whitespace-pre-wrap rounded-xl bg-blanc-casse px-4 py-3 text-[15px] shadow-douce">
            {bilan.commentaire}
          </p>
        </section>
      )}
    </div>
  );
}
