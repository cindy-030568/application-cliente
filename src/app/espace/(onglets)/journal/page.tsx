import type { Metadata } from "next";
import Link from "next/link";
import { Carte } from "@/components/ui";
import { FormulaireJournee } from "@/components/journal/formulaire-journee";
import { VueJournal } from "@/components/journal/vue-journal";
import { exigerAbonnee } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { lireJournal } from "@/lib/journal-serveur";
import { EnTete } from "../../../(cliente)/composants";

export const metadata: Metadata = { title: "Mon journal" };

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const jourPuce = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Journal simple (abonnées) : eau, sommeil, pas, énergie, stress, digestion, poids facultatif. Privé : la coach ne le voit pas. */
export default async function JournalAbonnee({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const { supabase, profil, fiche } = await exigerAbonnee();
  const entrees = (await lireJournal(supabase, profil.id)) ?? [];
  const auj = aujourdhuiParis();
  // Elle peut remplir les 60 derniers jours (ou depuis sa première journée si c'est plus ancien).
  const plusAncienne = entrees.at(-1)?.jour;
  const debut = plusAncienne && plusAncienne < ajouterJours(auj, -60) ? plusAncienne : ajouterJours(auj, -60);
  const demande = (await searchParams).jour;
  const jour = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) && demande <= auj && demande >= debut ? demande : auj;
  const { data: energie } = await supabase.from("journal_quotidien").select("energie").eq("cliente_id", profil.id).eq("jour", jour).maybeSingle<{ energie: number | null }>();
  const trouve = entrees.find((e) => e.jour === jour);
  const entree = trouve ? { ...trouve, energie: energie?.energie ?? null } : null;
  const veille = ajouterJours(jour, -1);
  const lendemain = ajouterJours(jour, 1);
  const remplis = new Set(entrees.map((e) => e.jour));
  const oublies: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const j = ajouterJours(auj, -i);
    if (!remplis.has(j)) oublies.push(j);
  }
  return (
    <>
      <EnTete titre="Mon journal" sousTitre="Quelques secondes par jour pour prendre soin de toi 💛" profil="/espace/profil" />
      <div className="flex flex-col gap-5 px-5 pb-6 pt-3">
        <Carte className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            {veille >= debut ? (
              <Link href={`/espace/journal?jour=${veille}`} className="rounded-full px-3 py-2 text-[14px] text-texte-2 hover:bg-sable/60" aria-label="Jour précédent">
                ‹ Veille
              </Link>
            ) : (
              <span />
            )}
            <p className="text-center font-medium first-letter:uppercase">
              {jour === auj ? "Aujourd’hui" : dateLongue.format(new Date(`${jour}T00:00:00Z`))}
              {entree ? <span className="block text-[12.5px] font-normal text-texte-2">déjà remplie ✓</span> : null}
            </p>
            {lendemain <= auj ? (
              <Link href={`/espace/journal?jour=${lendemain}`} className="rounded-full px-3 py-2 text-[14px] text-texte-2 hover:bg-sable/60" aria-label="Jour suivant">
                Lendemain ›
              </Link>
            ) : (
              <span />
            )}
          </div>
          {oublies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {oublies.map((j) => (
                <Link
                  key={j}
                  href={`/espace/journal?jour=${j}`}
                  aria-current={j === jour ? "date" : undefined}
                  className={j === jour ? "rounded-full bg-chocolat px-3 py-1.5 text-[13.5px] text-creme" : "rounded-full border border-caramel-clair bg-white px-3 py-1.5 text-[13.5px] text-chocolat"}
                >
                  {jourPuce.format(new Date(`${j}T00:00:00Z`))}
                </Link>
              ))}
            </div>
          )}
          <FormulaireJournee
            key={jour}
            jour={jour}
            entree={entree}
            sansChiffres={fiche.mode_sans_chiffres}
            simple
            base="/espace/journal"
            suivant={(() => {
              const j = oublies.find((x) => x !== jour);
              return j ? { jour: j, libelle: jourPuce.format(new Date(`${j}T00:00:00Z`)) } : null;
            })()}
          />
          <p className="text-center text-[12.5px] text-texte-2">Ton journal est privé : moi-même, je ne le vois pas.</p>
        </Carte>
        {entrees.length > 0 && <VueJournal entrees={entrees} debut={debut} aujourdhui={auj} sansChiffres={fiche.mode_sans_chiffres} />}
      </div>
    </>
  );
}
