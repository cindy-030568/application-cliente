import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, cx } from "@/components/ui";
import { exigerAbonnee } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { JOURS_SEMAINE, LIBELLES_REPAS_MENU, REPAS_MENU, etapesBatch, jourDuMenu, periodeSemaine } from "@/lib/menus";
import { lireMenuPublie } from "@/lib/menus-serveur";
import { urlPhotoRecette } from "@/lib/recettes";
import { AjoutCourses, EtapesBatch } from "./interactions";

export const metadata: Metadata = { title: "Mon menu de la semaine" };

/** Le menu de la semaine (préparé par la coach), le batch cooking du dimanche et la liste de courses. */
export default async function MenuAbonnee({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const { supabase } = await exigerAbonnee();
  const auj = aujourdhuiParis();
  const menu = await lireMenuPublie(supabase, auj, (await searchParams).semaine);
  const ids = [...new Set(menu?.cases.map((c) => c.recette_id) ?? [])];
  const { data: recettes } = ids.length
    ? await supabase.from("recettes").select("id, titre, photo_path, temps_prep_min").in("id", ids).returns<{ id: string; titre: string; photo_path: string | null; temps_prep_min: number | null }[]>()
    : { data: [] };
  const parId = new Map((recettes ?? []).map((r) => [r.id, r]));
  const aujourdhui = menu ? jourDuMenu(menu.lundi, auj) : null;
  const index = menu ? menu.lundis.indexOf(menu.lundi) : -1;
  const precedente = menu && index > 0 ? menu.lundis[index - 1] : null;
  const suivante = menu && index >= 0 && index < menu.lundis.length - 1 ? menu.lundis[index + 1] : null;
  const etapes = etapesBatch(menu?.batch);
  // Les jours, en commençant par aujourd'hui (le reste de la semaine ensuite).
  const jours = Array.from({ length: 7 }, (_, i) => i + 1);
  const ordre = aujourdhui ? [...jours.slice(aujourdhui - 1), ...jours.slice(0, aujourdhui - 1)] : jours;

  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-8">
      <Link href="/espace/recettes" className="inline-flex min-h-11 items-center gap-1 self-start text-[14.5px] text-texte-2">
        <IconeRetour className="size-5" /> Recettes
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[30px] font-bold leading-[1.12]">Mon menu de la semaine</h1>
        {menu && <p className="text-[15px] text-texte-2 first-letter:uppercase">{periodeSemaine(menu.lundi)}</p>}
      </div>

      {!menu ? (
        <div className="flex flex-col items-center gap-3 rounded-bloc border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-10 text-center">
          <span className="text-4xl" aria-hidden>
            🍽️
          </span>
          <p className="font-titre text-xl font-bold">Ton menu arrive bientôt</p>
          <p className="max-w-xs text-[15px] text-texte-2">Je prépare ton menu de la semaine : tu le retrouveras ici, avec ta liste de courses et le batch cooking du dimanche.</p>
          <Link href="/espace/recettes/frigo" className="text-[14.5px] font-medium underline underline-offset-4">
            En attendant : cuisine avec ce que tu as
          </Link>
        </div>
      ) : (
        <>
          {(precedente || suivante) && (
            <nav aria-label="Semaines" className="flex justify-between text-[14px]">
              {precedente ? (
                <Link href={`/espace/recettes/menu?semaine=${precedente}`} className="text-texte-2 underline underline-offset-4">
                  ‹ Semaine d’avant
                </Link>
              ) : (
                <span />
              )}
              {suivante && (
                <Link href={`/espace/recettes/menu?semaine=${suivante}`} className="font-medium underline underline-offset-4">
                  Semaine suivante ›
                </Link>
              )}
            </nav>
          )}
          {menu.mot && (
            <div className="rounded-carte bg-accent-pale/60 p-4">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">Le mot de Cindy</p>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{menu.mot}</p>
            </div>
          )}

          <Carte className="flex flex-col gap-3">
            <h2 className="font-titre text-xl font-bold">🛒 Mes courses</h2>
            <p className="text-[14px] text-texte-2">Tout le menu dans ta liste, additionné et rangé par rayon. Les recettes sont prévues pour 1 personne.</p>
            <AjoutCourses lundi={menu.lundi} />
          </Carte>

          {etapes.length > 0 && (
            <section className="flex flex-col gap-3 rounded-carte bg-chocolat p-5 text-creme" aria-labelledby="titre-batch">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-clair">Le dimanche</p>
                <h2 id="titre-batch" className="font-titre text-[22px] font-bold">
                  Mon batch cooking
                </h2>
                <p className="text-[14px] text-texte-clair">1 à 2 heures le dimanche, et ta semaine est (presque) prête.</p>
              </div>
              <EtapesBatch lundi={menu.lundi} etapes={etapes} />
            </section>
          )}

          <section className="flex flex-col gap-3" aria-label="Les repas de la semaine">
            {ordre.map((jour) => {
              const repas = REPAS_MENU.map((r) => ({ r, c: menu.cases.find((c) => c.jour === jour && c.repas === r) })).filter((x) => x.c);
              if (!repas.length) return null;
              return (
                <Carte key={jour} className={cx("flex flex-col gap-2", jour === aujourdhui && "ring-2 ring-accent")}>
                  <h2 className="font-titre text-lg font-bold">
                    {JOURS_SEMAINE[jour - 1]}
                    {jour === aujourdhui && <span className="ml-2 text-[13px] font-medium text-accent">Aujourd’hui</span>}
                  </h2>
                  <ul className="flex flex-col divide-y divide-ligne">
                    {repas.map(({ r, c }) => {
                      const recette = parId.get(c!.recette_id);
                      if (!recette) return null;
                      const photo = urlPhotoRecette(recette.photo_path);
                      return (
                        <li key={r}>
                          <Link href={`/espace/recettes/${recette.id}`} className="flex items-center gap-3 py-2">
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo} alt="" loading="lazy" className="size-12 shrink-0 rounded-xl object-cover" />
                            ) : (
                              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sable" aria-hidden>
                                🍽️
                              </span>
                            )}
                            <span className="flex min-w-0 flex-col">
                              <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-caramel-texte">{LIBELLES_REPAS_MENU[r]}</span>
                              <span className="text-[15px] leading-snug">{recette.titre}</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Carte>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
