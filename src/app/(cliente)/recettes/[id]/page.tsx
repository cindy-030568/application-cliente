import type { Metadata } from "next";
import { nomIngredient } from "@/lib/noms-aliments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeHorloge, IconeRecettes, IconeRetour } from "@/components/icones";
import { Etiquette, cx } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { PORTIONS_MAX } from "@/lib/courses";
import { formaterQuantite } from "@/lib/nutrition";
import { chargerTags, urlPhotoRecette } from "@/lib/recettes";
import { recettesAdapteesCliente, trouverAdaptation } from "@/lib/recettes-adaptees";
import { BoutonCourses, BoutonFavori } from "../boutons";

export const metadata: Metadata = { title: "Recette" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default async function PageRecette({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ repas?: string; portions?: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, profil, fiche, reglages } = await exigerCliente();
  const sp = await searchParams;
  const [repas, tags, { data: favori }] = await Promise.all([
    recettesAdapteesCliente(supabase, profil.id, reglages),
    chargerTags(supabase),
    supabase.from("favoris").select("recette_id").eq("cliente_id", profil.id).eq("recette_id", id).maybeSingle(),
  ]);

  // Repas pour lesquels cette recette est proposée.
  const repasPossibles = repas.flatMap((_, i) => (trouverAdaptation(repas, i, id) ? [i] : []));
  if (repasPossibles.length === 0) notFound();
  const demande = Number(sp.repas);
  const index = repasPossibles.includes(demande) ? demande : repasPossibles[0];
  const adaptation = trouverAdaptation(repas, index, id)!;
  const recette = adaptation.recette.source;
  const portionsDemandees = Number(sp.portions ?? 1);
  const portions = Number.isInteger(portionsDemandees) && portionsDemandees >= 1 && portionsDemandees <= PORTIONS_MAX ? portionsDemandees : 1;
  const quantites = new Map(adaptation.resultat.quantites.map((q) => [q.id, q.quantite]));
  const photo = urlPhotoRecette(recette.photo_path);
  const nomsTags = tags.filter((t) => recette.tags.includes(t.id)).map((t) => t.nom);
  const m = adaptation.resultat.macros;
  const lien = (o: { repas?: number; portions?: number }) =>
    `/recettes/${id}?repas=${o.repas ?? index}${(o.portions ?? portions) > 1 ? `&portions=${o.portions ?? portions}` : ""}`;

  return (
    <article className="flex flex-col pb-8">
      <div className="relative">
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-caramel-clair/60 to-accent-pale sm:rounded-b-carte sm:overflow-hidden">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={recette.titre} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-chocolat/40">
              <IconeRecettes className="size-14" />
            </span>
          )}
        </div>
        <Link
          href={`/recettes?repas=${index}`}
          aria-label="Retour aux recettes"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
          className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-blanc-casse/90 text-chocolat shadow-douce"
        >
          <IconeRetour className="size-5" />
        </Link>
      </div>

      <div className="relative -mt-6 flex flex-col gap-6 rounded-t-[28px] bg-creme px-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="font-titre text-[28px] font-bold leading-[1.15]">{recette.titre}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-texte-2">
              {recette.temps_prep_min && (
                <span className="inline-flex items-center gap-1">
                  <IconeHorloge className="size-4" /> {recette.temps_prep_min} min
                </span>
              )}
              {nomsTags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
          <BoutonFavori recetteId={recette.id} favori={!!favori} />
        </div>
        {recette.description && <p className="text-[15px] text-texte-2">{recette.description}</p>}

        {repasPossibles.length > 1 && (
          <section className="flex flex-col gap-2" aria-labelledby="titre-pour">
            <h2 id="titre-pour" className="text-[14px] font-medium">
              Quantités calculées pour ton…
            </h2>
            <div className="defilement -mx-5 flex gap-2.5 overflow-x-auto px-5 py-0.5">
              {repasPossibles.map((i) => (
                <Choix key={i} href={lien({ repas: i })} actif={i === index}>
                  {repas[i].repas.libelle}
                </Choix>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3" aria-labelledby="titre-ingredients">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="titre-ingredients" className="font-titre text-xl font-bold">
              Ingrédients
              {repasPossibles.length === 1 && (
                <span className="block font-sans text-[13.5px] font-normal text-texte-2">
                  Pour ton {repas[index].repas.libelle.toLocaleLowerCase("fr")}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1 rounded-full bg-blanc-casse p-1 shadow-douce" role="group" aria-label="Nombre de portions">
              {Array.from({ length: PORTIONS_MAX }, (_, k) => k + 1).map((p) => (
                <Link
                  key={p}
                  href={lien({ portions: p })}
                  scroll={false}
                  aria-current={p === portions ? "true" : undefined}
                  aria-label={`${p} portion${p > 1 ? "s" : ""}`}
                  className={cx(
                    "flex size-9 items-center justify-center rounded-full text-[14px] font-medium",
                    p === portions ? "bg-chocolat text-creme" : "text-chocolat",
                  )}
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>
          {portions > 1 && (
            <p className="-mt-1 text-[13px] text-texte-2">
              Pour {portions} portions : tu prépares en une fois, chaque portion reste adaptée à toi.
            </p>
          )}
          <ul className="flex flex-col divide-y divide-ligne rounded-carte bg-blanc-casse px-4 shadow-douce">
            {[...recette.ingredients]
              .sort((a, b) => a.ordre - b.ordre)
              .map((i) => {
                const q = (quantites.get(i.id) ?? i.qte_base) * portions;
                return (
                  <li key={i.id} className="flex items-baseline justify-between gap-3 py-3">
                    <span className="flex flex-col">
                      <span className="text-[15px]">{nomIngredient(i.aliment.nom)}</span>
                      {i.note && <span className="text-[13px] text-texte-2">{i.note}</span>}
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                      {q > 0 ? formaterQuantite(q, i.unite, i.aliment.nom_unite) : "—"}
                    </span>
                  </li>
                );
              })}
          </ul>
          <p className="text-[12.5px] text-texte-2">Quantités crues, à peser avant cuisson.</p>
          {adaptation.approximative && (
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-texte-2">
              <Etiquette ton="sable">Approximative</Etiquette>
              Les quantités s’approchent de tes repères pour ce repas.
            </p>
          )}
          {!fiche.mode_sans_chiffres && (
            <p className="text-[12.5px] text-texte-2">
              Une portion : {nf.format(m.proteines)} g de protéines · {nf.format(m.glucides)} g de glucides ·{" "}
              {nf.format(m.lipides)} g de lipides
            </p>
          )}
        </section>

        <BoutonCourses recetteId={recette.id} indexRepas={index} portions={portions} />

        {recette.etapes.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="titre-etapes">
            <h2 id="titre-etapes" className="font-titre text-xl font-bold">
              Préparation
            </h2>
            <ol className="flex flex-col gap-3">
              {recette.etapes.map((e, k) => (
                <li key={k} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-pale text-[13px] font-semibold">
                    {k + 1}
                  </span>
                  <span className="pt-0.5 text-[15px] leading-relaxed">{e}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {recette.astuce && (
          <aside className="rounded-carte bg-accent-pale/60 p-4">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-accent-fonce">L’astuce de Cindy</p>
            <p className="mt-1 text-[15px]">{recette.astuce}</p>
          </aside>
        )}
      </div>
    </article>
  );
}

function Choix({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={actif ? "true" : undefined}
      className={cx(
        "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-medium",
        actif ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat shadow-douce",
      )}
    >
      {children}
    </Link>
  );
}
