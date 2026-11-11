import { Surtitre } from "@/components/ui";
import { ANGLES, type Bilan, type ChampMesure } from "@/lib/types";
import { valeurAffichee } from "./vue-suivi";

/** Contenu d'un bilan : mesures, ressentis, photos, commentaire. */
export function DetailBilan({
  bilan,
  champs,
  urls,
  precedent,
  comparer = false,
}: {
  bilan: Bilan;
  champs: ChampMesure[];
  urls: Map<string, string>;
  precedent?: Bilan | null;
  comparer?: boolean;
}) {
  const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
  const groupes = [
    { titre: "Mesures", items: champs.filter((c) => c.groupe === "mesure") },
    { titre: "Ressentis", items: champs.filter((c) => c.groupe === "ressenti") },
  ]
    .map((g) => ({ ...g, items: g.items.filter((c) => valeurAffichee(c, bilan) !== null) }))
    .filter((g) => g.items.length > 0);

  const ecart = (c: ChampMesure) => {
    if (!comparer || !precedent || c.type === "choix") return null;
    const a = precedent.valeurs.find((v) => v.champ_id === c.id)?.valeur_num;
    const b = bilan.valeurs.find((v) => v.champ_id === c.id)?.valeur_num;
    if (a == null || b == null) return null;
    const d = Math.round((b - a) * 100) / 100;
    return d === 0 ? "=" : `${nf.format(d)}${c.unite ? ` ${c.unite}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {groupes.map((g) => (
        <section key={g.titre} className="flex flex-col gap-2">
          <Surtitre>{g.titre}</Surtitre>
          <dl className="grid grid-cols-2 gap-2">
            {g.items.map((c) => (
              <div key={c.id} className="flex flex-col rounded-xl bg-blanc-casse px-4 py-3 shadow-douce">
                <dt className="text-[13px] text-texte-2">{c.libelle}</dt>
                <dd className="flex items-baseline justify-between gap-2">
                  <span className="text-[17px] font-medium tabular-nums">{valeurAffichee(c, bilan)}</span>
                  {ecart(c) && <span className="text-[12.5px] tabular-nums text-texte-2">{ecart(c)}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {bilan.photos.length > 0 && (
        <section className="flex flex-col gap-2">
          <Surtitre>Photos</Surtitre>
          <div className="grid grid-cols-3 gap-2">
            {ANGLES.map(({ valeur, libelle }) => {
              const p = bilan.photos.find((x) => x.angle === valeur);
              const url = p && urls.get(p.fichier_path);
              return url ? (
                <a key={valeur} href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-1">
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
