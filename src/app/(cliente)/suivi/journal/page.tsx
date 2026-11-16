import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte } from "@/components/ui";
import { FormulaireJournee } from "@/components/journal/formulaire-journee";
import { VueJournal } from "@/components/journal/vue-journal";
import { exigerCliente } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { numeroSemaine } from "@/lib/journal";
import { journalActif, lireJournal } from "@/lib/journal-serveur";

export const metadata: Metadata = { title: "Mon journal" };

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function PageJournal({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const { supabase, profil, fiche } = await exigerCliente();
  const [entrees, actif] = await Promise.all([lireJournal(supabase, profil.id), journalActif(supabase, profil.id)]);
  if (!entrees || !actif) redirect("/suivi");

  const auj = aujourdhuiParis();
  const debut = fiche.date_debut && fiche.date_debut <= auj ? fiche.date_debut : (entrees.at(-1)?.jour ?? auj);
  const demande = (await searchParams).jour;
  const jour = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) && demande <= auj && demande >= debut ? demande : auj;
  const entree = entrees.find((e) => e.jour === jour) ?? null;
  const veille = ajouterJours(jour, -1);
  const lendemain = ajouterJours(jour, 1);

  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/suivi" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Mon suivi
      </Link>
      <div>
        <h1 className="font-titre text-[30px] font-bold leading-tight">Mon journal</h1>
        <p className="text-[15px] text-texte-2">Quelques secondes par jour : c’est ce qui fait la différence 💛</p>
      </div>

      <Carte className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          {veille >= debut ? (
            <Link href={`/suivi/journal?jour=${veille}`} className="rounded-full px-3 py-2 text-[14px] text-texte-2 hover:bg-sable/60" aria-label="Jour précédent">
              ‹ Veille
            </Link>
          ) : (
            <span />
          )}
          <div className="text-center">
            <p className="font-medium first-letter:uppercase">{jour === auj ? "Aujourd’hui" : dateLongue.format(new Date(`${jour}T00:00:00Z`))}</p>
            <p className="text-[12.5px] text-texte-2">Semaine {numeroSemaine(debut, jour)}{entree ? " · déjà remplie ✓" : ""}</p>
          </div>
          {lendemain <= auj ? (
            <Link href={`/suivi/journal?jour=${lendemain}`} className="rounded-full px-3 py-2 text-[14px] text-texte-2 hover:bg-sable/60" aria-label="Jour suivant">
              Lendemain ›
            </Link>
          ) : (
            <span />
          )}
        </div>
        <FormulaireJournee jour={jour} entree={entree} sansChiffres={fiche.mode_sans_chiffres} />
      </Carte>

      <VueJournal entrees={entrees} debut={debut} aujourdhui={auj} sansChiffres={fiche.mode_sans_chiffres} />
    </div>
  );
}
