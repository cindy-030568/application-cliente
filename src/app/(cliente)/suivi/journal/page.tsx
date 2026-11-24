import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte } from "@/components/ui";
import { FormulaireJournee } from "@/components/journal/formulaire-journee";
import { VueJournal } from "@/components/journal/vue-journal";
import { RappelJournal } from "@/components/journal/rappel-journal";
import { exigerCliente } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { numeroSemaine } from "@/lib/journal";
import { journalActif, lireJournal } from "@/lib/journal-serveur";
import { LIBELLE_PHASE, PAS_UN_AVIS_MEDICAL, messageRetention, situationCycle } from "@/lib/cycle";
import { lireCycle, lireSymptomesJournal } from "@/lib/cycle-serveur";

export const metadata: Metadata = { title: "Mon journal" };

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const jourPuce = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default async function PageJournal({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const { supabase, profil, fiche } = await exigerCliente();
  const [entrees, actif, { data: rappel, error: sansRappel }, { count: appareils }] = await Promise.all([
    lireJournal(supabase, profil.id),
    journalActif(supabase, profil.id),
    supabase.from("clientes").select("rappel_journal_heure").eq("id", profil.id).maybeSingle<{ rappel_journal_heure: string | null }>(),
    supabase.from("abonnements_push").select("id", { count: "exact", head: true }).eq("cliente_id", profil.id),
  ]);
  if (!entrees || !actif) redirect("/suivi");
  const cycle = await lireCycle(supabase, profil.id);

  const auj = aujourdhuiParis();
  const debut = fiche.date_debut && fiche.date_debut <= auj ? fiche.date_debut : (entrees.at(-1)?.jour ?? auj);
  const demande = (await searchParams).jour;
  const jour = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) && demande <= auj && demande >= debut ? demande : auj;
  const entree = entrees.find((e) => e.jour === jour) ?? null;
  const veille = ajouterJours(jour, -1);
  const lendemain = ajouterJours(jour, 1);
  // Jours oubliés sur les 3 dernières semaines (sans aujourd'hui), du plus récent au plus ancien.
  const remplis = new Set(entrees.map((e) => e.jour));
  const oublies: string[] = [];
  for (let i = 1; i <= 21; i++) {
    const j = ajouterJours(auj, -i);
    if (j < debut) break;
    if (!remplis.has(j)) oublies.push(j);
  }

  // Cycle (facultatif, choisi par la cliente) : jour et phase déduits des jours « règles » cochés.
  const joursRegles = entrees.filter((e) => e.regles).map((e) => e.jour);
  const situation = cycle?.mode === "cycle" ? situationCycle(joursRegles, jour, cycle.duree) : null;
  const doux =
    cycle && entree
      ? messageRetention({ mode: cycle.mode, sansChiffres: fiche.mode_sans_chiffres, jour, poidsDuJour: entree.poids, pesees: entrees, joursRegles, duree: cycle.duree })
      : null;
  const symptomes = cycle?.mode === "perimenopause" ? ((await lireSymptomesJournal(supabase, profil.id, jour)).get(jour) ?? []) : null;

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
        <form action="/suivi/journal" className="flex items-end gap-2 rounded-xl bg-sable/50 p-3">
          <label className="flex flex-1 flex-col gap-1 text-[13px] text-texte-2">
            Remplir un autre jour
            <input
              type="date"
              name="jour"
              defaultValue={jour}
              min={debut}
              max={auj}
              className="min-h-11 rounded-xl border border-ligne bg-white px-3 text-[16px] text-chocolat"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-full bg-chocolat px-5 text-[15px] font-medium text-creme">
            Aller
          </button>
        </form>
        {cycle?.mode === "cycle" && (
          <div className="flex flex-col gap-1 rounded-xl bg-accent-pale/60 p-3 text-[14px]">
            {situation ? (
              <p>
                <span className="font-medium">Jour {situation.jour} de ton cycle</span> · {LIBELLE_PHASE[situation.phase]}
                {situation.retention && " · le corps retient souvent un peu d’eau en ce moment"}
              </p>
            ) : (
              <p>Coche « J’ai mes règles » les jours concernés : l’appli repère toute seule le jour et la phase de ton cycle.</p>
            )}
            {doux && <p>{doux}</p>}
            <p className="text-[12px] text-texte-2">
              {PAS_UN_AVIS_MEDICAL}{" "}
              <Link href="/profil#cycle" className="underline underline-offset-2">
                Régler
              </Link>
            </p>
          </div>
        )}
        {oublies.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-texte-2">
              {oublies.length === 1 ? "1 jour oublié" : `${oublies.length} jours oubliés`} ces 3 dernières semaines : touche un jour pour le remplir.
            </p>
            <div className="flex flex-wrap gap-2">
              {oublies.map((j) => (
                <Link
                  key={j}
                  href={`/suivi/journal?jour=${j}`}
                  aria-current={j === jour ? "date" : undefined}
                  className={
                    j === jour
                      ? "rounded-full bg-chocolat px-3 py-1.5 text-[13.5px] text-creme"
                      : "rounded-full border border-caramel-clair bg-white px-3 py-1.5 text-[13.5px] text-chocolat"
                  }
                >
                  {jourPuce.format(new Date(`${j}T00:00:00Z`))}
                </Link>
              ))}
            </div>
          </div>
        )}
        <FormulaireJournee
          key={jour}
          jour={jour}
          entree={entree}
          sansChiffres={fiche.mode_sans_chiffres}
          symptomes={symptomes}
          suivant={(() => {
            const j = oublies.find((x) => x !== jour);
            return j ? { jour: j, libelle: jourPuce.format(new Date(`${j}T00:00:00Z`)) } : null;
          })()}
        />
      </Carte>

      {!sansRappel && <RappelJournal heure={rappel?.rappel_journal_heure ?? null} appareil={(appareils ?? 0) > 0} />}

      <VueJournal entrees={entrees} debut={debut} aujourdhui={auj} sansChiffres={fiche.mode_sans_chiffres} />
    </div>
  );
}
