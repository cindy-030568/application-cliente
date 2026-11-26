import type { Metadata } from "next";
import Link from "next/link";
import { IconeCoeur, IconeHorloge, IconeRecettes, IconeRecherche } from "@/components/icones";
import { cx } from "@/components/ui";
import { exigerAbonnee } from "@/lib/auth";
import { REPAS_RECETTE, type TypeRepasRecette } from "@/lib/nutrition";
import { chargerRecettes, chargerTags, urlPhotoRecette } from "@/lib/recettes";
import { normaliser } from "@/lib/texte";
import { EnTete } from "../../../(cliente)/composants";

export const metadata: Metadata = { title: "Recettes" };

type Params = { q?: string; repas?: string; tag?: string; favoris?: string };

/** Les recettes de la coach pour les abonnées : telles qu'elle les a écrites, sans calcul. */
export default async function RecettesAbonnee({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profil } = await exigerAbonnee();
  const p = await searchParams;
  const [recettes, tags, { data: favs }] = await Promise.all([
    chargerRecettes(supabase),
    chargerTags(supabase),
    supabase.from("favoris").select("recette_id").eq("cliente_id", profil.id),
  ]);
  const favoris = new Set((favs ?? []).map((f) => f.recette_id as string));
  const q = (p.q ?? "").trim().slice(0, 60);
  const repas = p.repas && p.repas in REPAS_RECETTE ? (p.repas as TypeRepasRecette) : null;
  const tag = tags.some((t) => t.id === p.tag) ? p.tag! : null;
  const vueFavoris = p.favoris === "1";
  const mots = normaliser(q).split(/\s+/).filter(Boolean);
  const liste = recettes.filter(
    (r) =>
      (!repas || r.repas.includes(repas)) &&
      (!tag || r.tags.includes(tag)) &&
      (!vueFavoris || favoris.has(r.id)) &&
      mots.every((m) => normaliser(`${r.titre} ${r.description ?? ""} ${r.ingredients.map((i) => i.aliment.nom).join(" ")}`).includes(m)),
  );
  const lien = (o: Partial<Record<keyof Params, string | null>>) => {
    const u = new URLSearchParams();
    const v = { q: q || null, repas, tag, favoris: vueFavoris ? "1" : null, ...o };
    for (const [k, x] of Object.entries(v)) if (x) u.set(k, x);
    const s = u.toString();
    return `/espace/recettes${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <EnTete titre="Mes recettes" sousTitre="Gourmandes, simples, et faites pour toute la famille 💛" profil="/espace/profil" />
      <div className="flex flex-col gap-4 px-5 pb-6 pt-3">
        <form action="/espace/recettes" role="search" className="flex items-center gap-2 rounded-full bg-blanc-casse py-1 pl-4 pr-1 shadow-douce">
          <IconeRecherche className="size-5 shrink-0 text-texte-2" />
          <input key={q} type="search" name="q" defaultValue={q} placeholder="Un plat, un ingrédient…" aria-label="Chercher une recette" className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
          {repas && <input type="hidden" name="repas" value={repas} />}
          {vueFavoris && <input type="hidden" name="favoris" value="1" />}
          <button type="submit" className="min-h-10 shrink-0 rounded-full bg-chocolat px-4 text-[14.5px] font-medium text-creme">
            Chercher
          </button>
        </form>
        <nav aria-label="Filtres" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <Puce href="/espace/recettes" actif={!repas && !tag && !vueFavoris && !q}>
            Toutes
          </Puce>
          <Puce href={lien({ favoris: vueFavoris ? null : "1" })} actif={vueFavoris}>
            ♥ Mes favoris
          </Puce>
          {(Object.keys(REPAS_RECETTE) as TypeRepasRecette[]).map((k) => (
            <Puce key={k} href={lien({ repas: repas === k ? null : k })} actif={repas === k}>
              {REPAS_RECETTE[k]}
            </Puce>
          ))}
          {tags.map((t) => (
            <Puce key={t.id} href={lien({ tag: tag === t.id ? null : t.id })} actif={tag === t.id}>
              {t.nom}
            </Puce>
          ))}
        </nav>
        {liste.length === 0 ? (
          <p className="rounded-bloc border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-10 text-center text-[15px] text-texte-2">
            {vueFavoris && !q ? "Touche le cœur d’une recette pour la retrouver ici." : "Aucune recette ici : essaie un autre mot ou enlève un filtre."}
          </p>
        ) : (
          <ul className="grid gap-4">
            {liste.map((r) => {
              const photo = urlPhotoRecette(r.photo_path);
              return (
                <li key={r.id}>
                  <Link href={`/espace/recettes/${r.id}`} className="group block overflow-hidden rounded-carte bg-blanc-casse shadow-douce">
                    <div className="relative aspect-[16/9] bg-gradient-to-br from-caramel-clair/60 to-accent-pale">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-chocolat/40">
                          <IconeRecettes className="size-10" />
                        </span>
                      )}
                      {favoris.has(r.id) && (
                        <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-blanc-casse/90 text-accent">
                          <IconeCoeur className="size-5" fill="currentColor" aria-label="Dans tes favoris" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 p-4">
                      <span className="font-medium leading-snug group-hover:text-accent">{r.titre}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-texte-2">
                        {r.temps_prep_min && (
                          <span className="inline-flex items-center gap-1">
                            <IconeHorloge className="size-4" /> {r.temps_prep_min} min
                          </span>
                        )}
                        {r.repas.map((k) => REPAS_RECETTE[k as TypeRepasRecette] ?? k).join(" · ")}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={actif ? "page" : undefined} className={cx("inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[14px]", actif ? "bg-chocolat text-creme" : "bg-blanc-casse shadow-douce")}>
      {children}
    </Link>
  );
}
