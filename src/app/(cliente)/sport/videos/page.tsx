import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour, IconeVideo } from "@/components/icones";
import { cx } from "@/components/ui";
import { CarteVideo } from "@/components/video/carte-video";
import { exigerCliente } from "@/lib/auth";
import { FAMILLES, type FamilleFiltre } from "@/lib/types";
import { chargerFiltres, chargerVideos, normaliser } from "@/lib/videos";
import { BientotDisponible } from "../../composants";

export const metadata: Metadata = { title: "Vidéos d’exercices" };

type Params = { q?: string; groupe?: string; materiel?: string; categorie?: string };

export default async function PageVideos({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase } = await exigerCliente();
  const [filtres, videos] = await Promise.all([chargerFiltres(supabase), chargerVideos(supabase)]);

  const choisis: Partial<Record<FamilleFiltre, string>> = {
    groupe: params.groupe,
    materiel: params.materiel,
    categorie: params.categorie,
  };
  const q = normaliser(params.q ?? "");
  const resultats = videos.filter(
    (v) =>
      (!q || normaliser(`${v.titre} ${v.description ?? ""}`).includes(q)) &&
      FAMILLES.every(({ valeur }) => !choisis[valeur] || v.filtres.includes(choisis[valeur]!)),
  );

  const lien = (changement: Partial<Params>) => {
    const p = new URLSearchParams();
    const fusion = { ...params, ...changement };
    for (const [k, v] of Object.entries(fusion)) if (v) p.set(k, v);
    const s = p.toString();
    return `/sport/videos${s ? `?${s}` : ""}`;
  };
  const actifs = FAMILLES.some(({ valeur }) => choisis[valeur]) || Boolean(params.q);

  return (
    <div className="pt-encoche flex flex-col gap-5">
      <div className="flex flex-col gap-4 px-5">
        <Link href="/sport" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
          <IconeRetour className="size-5" /> Sport
        </Link>
        <h1 className="font-titre text-[30px] font-bold leading-tight">Vidéos d’exercices</h1>
        {videos.length > 0 && (
          <form action="/sport/videos" className="relative" role="search">
            {FAMILLES.map(({ param, valeur }) =>
              choisis[valeur] ? <input key={param} type="hidden" name={param} value={choisis[valeur]} /> : null,
            )}
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Rechercher un exercice"
              aria-label="Rechercher un exercice"
              className="min-h-12 w-full rounded-full border border-ligne bg-white px-5 text-[16px] focus:border-chocolat focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent-pale"
            />
          </form>
        )}
      </div>

      {videos.length === 0 ? (
        <BientotDisponible
          icone={<IconeVideo className="size-6" />}
          titre="Bientôt ici"
          texte="Cindy prépare ses vidéos d’exercices, avec les points techniques à retenir."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {FAMILLES.map(({ valeur, libelle, param }) => {
              const utiles = filtres.filter(
                (f) => f.famille === valeur && videos.some((v) => v.filtres.includes(f.id)),
              );
              if (utiles.length === 0) return null;
              return (
                <div key={valeur} className="flex flex-col gap-1.5">
                  <p className="px-5 text-[12px] font-medium uppercase tracking-[0.12em] text-caramel-texte">{libelle}</p>
                  <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                    <Puce href={lien({ [param]: undefined })} actif={!choisis[valeur]}>
                      Tous
                    </Puce>
                    {utiles.map((f) => (
                      <Puce key={f.id} href={lien({ [param]: f.id })} actif={choisis[valeur] === f.id}>
                        {f.nom}
                      </Puce>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-5 text-[14px] text-texte-2">
            <span>
              {resultats.length} exercice{resultats.length > 1 ? "s" : ""}
            </span>
            {actifs && (
              <Link href="/sport/videos" className="underline underline-offset-4">
                Tout afficher
              </Link>
            )}
          </div>

          {resultats.length === 0 ? (
            <p className="mx-5 rounded-carte bg-blanc-casse p-6 text-center text-[15px] text-texte-2 shadow-douce">
              Aucun exercice ne correspond. Essaie d’enlever un filtre.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-5">
              {resultats.map((v) => (
                <CarteVideo key={v.id} video={v} filtres={filtres} href={`/sport/videos/${v.id}`} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={actif ? "true" : undefined}
      className={cx(
        "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[14px] transition-colors",
        actif ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat hover:bg-sable",
      )}
    >
      {children}
    </Link>
  );
}
