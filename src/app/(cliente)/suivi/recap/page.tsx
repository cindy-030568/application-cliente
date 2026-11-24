import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, cx } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { heureParis } from "@/lib/journal";
import { dimancheDuRecap, estDimanche, formaterHeures, formaterLitres, formaterPas } from "@/lib/recap-semaine";
import { chargerRecaps } from "@/lib/recap-semaine-serveur";
import { lireSuiviSport } from "@/lib/paiements-serveur";

export const metadata: Metadata = { title: "Ma semaine" };

const jourMois = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const date = (j: string) => jourMois.format(new Date(`${j}T12:00:00Z`));

export default async function PageRecap({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const { supabase, profil, fiche } = await exigerCliente();
  const auj = aujourdhuiParis();
  const derniere = dimancheDuRecap(auj, heureParis(new Date()));
  const demande = (await searchParams).semaine;
  const premiere = fiche.date_debut ? ajouterJours(fiche.date_debut, 6) : null;
  const dimanche = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) && estDimanche(demande) && demande <= derniere ? demande : derniere;
  const [recaps, sport] = await Promise.all([chargerRecaps(supabase, [{ id: profil.id, prenom: profil.prenom }], dimanche), lireSuiviSport(supabase, profil.id)]);
  const r = recaps.get(profil.id)!;
  const precedente = ajouterJours(dimanche, -7);
  const suivante = ajouterJours(dimanche, 7);

  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/suivi" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Mon suivi
      </Link>
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">Ton récap de la semaine</span>
        <h1 className="font-titre text-[28px] font-bold leading-tight first-letter:uppercase">
          Du {date(r.lundi)} au {date(r.dimanche)}
        </h1>
      </div>

      <p className="rounded-carte bg-accent-pale p-5 font-main text-[26px] leading-[1.2] text-chocolat apparition">{r.phrase}</p>

      <div className="grid grid-cols-2 gap-3">
        {(sport || r.seances > 0) && (
          <Tuile emoji="💪" libelle="Séances" valeur={String(r.seances)} detail={r.seances > 1 ? "séances faites" : "séance faite"} />
        )}
        <Tuile emoji="😴" libelle="Sommeil" valeur={r.sommeil === null ? null : formaterHeures(r.sommeil)} detail="par nuit en moyenne" />
        <Tuile emoji="👟" libelle="Pas" valeur={r.pas === null ? null : formaterPas(r.pas)} detail="par jour en moyenne" />
        <Tuile emoji="💧" libelle="Hydratation" valeur={r.hydratation === null ? null : formaterLitres(r.hydratation)} detail="par jour en moyenne" />
      </div>
      <Carte className="text-[14.5px] text-texte-2">
        {r.joursRemplis === 0
          ? "Ton journal n’a pas été rempli cette semaine. Même 1 minute par jour m’aide à mieux t’accompagner 💛"
          : `Journal rempli ${r.joursRemplis} jour${r.joursRemplis > 1 ? "s" : ""} sur 7.`}{" "}
        <Link href="/suivi/journal" className="font-medium text-chocolat underline underline-offset-4">
          Mon journal
        </Link>
      </Carte>

      <nav className="flex items-center justify-between gap-3 text-[14.5px]" aria-label="Autres semaines">
        {!premiere || precedente >= premiere ? (
          <Link href={`/suivi/recap?semaine=${precedente}`} className="underline underline-offset-4">
            ← Semaine d’avant
          </Link>
        ) : (
          <span />
        )}
        {suivante <= derniere && (
          <Link href={`/suivi/recap?semaine=${suivante}`} className="underline underline-offset-4">
            Semaine d’après →
          </Link>
        )}
      </nav>
    </div>
  );
}

function Tuile({ emoji, libelle, valeur, detail }: { emoji: string; libelle: string; valeur: string | null; detail: string }) {
  return (
    <div className={cx("flex flex-col gap-1 rounded-carte bg-blanc-casse p-4 shadow-douce", valeur === null && "opacity-70")}>
      <span className="text-[13px] text-texte-2">
        <span aria-hidden>{emoji}</span> {libelle}
      </span>
      <span className="font-titre text-[26px] font-bold leading-tight tabular-nums">{valeur ?? "—"}</span>
      <span className="text-[12.5px] text-texte-2">{valeur === null ? "pas noté cette semaine" : detail}</span>
    </div>
  );
}
