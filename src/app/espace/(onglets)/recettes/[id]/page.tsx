import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeHorloge, IconeRecettes, IconeRetour } from "@/components/icones";
import { exigerAbonnee } from "@/lib/auth";
import { familles } from "@/lib/assiette";
import { nomIngredient } from "@/lib/noms-aliments";
import { formaterQuantite } from "@/lib/nutrition";
import { chargerRecette, chargerTags, urlPhotoRecette } from "@/lib/recettes";
import { BoutonFavori } from "../../../../(cliente)/recettes/boutons";

export const metadata: Metadata = { title: "Recette" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Une recette pour une abonnée : les quantités de la recette (1 portion) et la méthode de l'assiette. */
export default async function RecetteAbonnee({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, profil } = await exigerAbonnee();
  const [recette, tags, { data: favori }] = await Promise.all([
    chargerRecette(supabase, id),
    chargerTags(supabase),
    supabase.from("favoris").select("recette_id").eq("cliente_id", profil.id).eq("recette_id", id).maybeSingle(),
  ]);
  if (!recette) notFound();
  const photo = urlPhotoRecette(recette.photo_path);
  const nomsTags = tags.filter((t) => recette.tags.includes(t.id)).map((t) => t.nom);
  const groupes = familles(recette.ingredients, nomIngredient);
  return (
    <article className="flex flex-col pb-8">
      <div className="relative">
        <div className="aspect-[4/3] w-full bg-gradient-to-br from-caramel-clair/60 to-accent-pale">
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
          href="/espace/recettes"
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

        <section className="flex flex-col gap-3" aria-labelledby="titre-ingredients">
          <h2 id="titre-ingredients" className="font-titre text-xl font-bold">
            Ingrédients <span className="block font-sans text-[13.5px] font-normal text-texte-2">Pour 1 portion</span>
          </h2>
          <ul className="flex flex-col divide-y divide-ligne rounded-carte bg-blanc-casse px-4 shadow-douce">
            {[...recette.ingredients]
              .sort((a, b) => a.ordre - b.ordre)
              .map((i) => (
                <li key={i.id} className="flex items-baseline justify-between gap-3 py-3">
                  <span className="flex flex-col">
                    <span className="text-[15px]">{nomIngredient(i.aliment.nom)}</span>
                    {i.note && <span className="text-[13px] text-texte-2">{i.note}</span>}
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">{i.qte_base > 0 ? formaterQuantite(i.qte_base, i.unite, i.aliment.nom_unite) : "—"}</span>
                </li>
              ))}
          </ul>
          <p className="text-[12.5px] text-texte-2">Quantités crues, à peser avant cuisson. Adapte-les à ta faim : écoute tes sensations.</p>
        </section>

        {groupes.length > 0 && (
          <section className="flex flex-col gap-3 rounded-carte bg-accent-pale/50 p-4" aria-labelledby="titre-assiette">
            <h2 id="titre-assiette" className="font-titre text-lg font-bold">
              🍽️ Ton assiette
            </h2>
            <p className="text-[14px]">Une moitié de légumes, puis :</p>
            <ul className="flex flex-col gap-2">
              {groupes.map((g) => (
                <li key={g.code} className="text-[14.5px]">
                  <span className="font-medium">
                    {g.emoji} {g.libelle}
                  </span>{" "}
                  <span className="text-texte-2">({g.aliments.join(", ")}) : {g.repere}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recette.etapes.length > 0 && (
          <section className="flex flex-col gap-3" aria-labelledby="titre-etapes">
            <h2 id="titre-etapes" className="font-titre text-xl font-bold">
              Préparation
            </h2>
            <ol className="flex flex-col gap-3">
              {recette.etapes.map((e, k) => (
                <li key={k} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-pale text-[13px] font-semibold">{k + 1}</span>
                  <span className="pt-0.5 text-[15px] leading-relaxed">{e}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {recette.astuce && (
          <aside className="rounded-carte bg-accent-pale/60 p-4">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-accent-fonce">Mon astuce</p>
            <p className="mt-1 text-[15px]">{recette.astuce}</p>
          </aside>
        )}
      </div>
    </article>
  );
}
