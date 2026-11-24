import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconePlus, IconeRetour } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Surtitre, classesBouton } from "@/components/ui";
import { VueSuivi } from "@/components/suivi/vue-suivi";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis, bilanAvecPhotos, formaterDate, isoVersHeureParis, prochainBilan } from "@/lib/bilan";
import { chargerBilans, chargerChamps, urlsPhotos } from "@/lib/suivi";
import { COLONNES_FICHE } from "@/lib/types";
import type { ClienteListe } from "../../../donnees";
import { ReglagesSuivi } from "./reglages-suivi";
import { VueJournal } from "@/components/journal/vue-journal";
import { lireJournal } from "@/lib/journal-serveur";
import { ajouterJours } from "@/lib/bilan";
import { LIBELLE_PHASE, libelleSymptome, situationCycle } from "@/lib/cycle";
import { lireCycle, lireSymptomesJournal } from "@/lib/cycle-serveur";

export const metadata: Metadata = { title: "Suivi" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageSuiviCoach({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: c } = await supabase
    .from("clientes")
    .select(`${COLONNES_FICHE}, profils!inner(prenom, nom, email)`)
    .eq("id", id)
    .maybeSingle<ClienteListe>();
  if (!c) notFound();

  const [champsTous, bilans] = await Promise.all([chargerChamps(supabase, true), chargerBilans(supabase, id)]);
  const champs = champsTous.filter((ch) => ch.actif || bilans.some((b) => b.valeurs.some((v) => v.champ_id === ch.id)));
  const urls = await urlsPhotos(supabase, bilans.flatMap((b) => b.photos.map((p) => p.fichier_path)));
  const journal = await lireJournal(supabase, id);
  const aujJ = aujourdhuiParis();
  const debutJournal = c.date_debut && c.date_debut <= aujJ ? c.date_debut : (journal?.at(-1)?.jour ?? aujJ);
  // Cycle / périménopause (choisi par la cliente) : données sensibles, visibles seulement par elle et toi.
  const cycle = await lireCycle(supabase, id);
  const situation = cycle?.mode === "cycle" && journal ? situationCycle(journal.filter((e) => e.regles).map((e) => e.jour), aujJ, cycle.duree) : null;
  const symptomes14 = cycle?.mode === "perimenopause" ? await lireSymptomesJournal(supabase, id, ajouterJours(aujJ, -13)) : null;
  const compteSymptomes = new Map<string, number>();
  for (const liste of symptomes14?.values() ?? []) for (const x of liste) compteSymptomes.set(x, (compteSymptomes.get(x) ?? 0) + 1);
  const photos = bilans.flatMap((b) =>
    b.photos.flatMap((p) => (urls.get(p.fichier_path) ? [{ angle: p.angle, date: b.date_mesure, url: urls.get(p.fichier_path)! }] : [])),
  );
  const prochain = c.statut === "active" ? prochainBilan(c.date_debut, c.frequence_bilan_jours, aujourdhuiParis()) : null;
  const derniereVisite = c.derniere_visite
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(c.derniere_visite))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/coach/clientes/${id}`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Fiche de {c.profils.prenom}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Suivi et bilans</Surtitre>
          <h1 className="font-titre text-[32px] font-bold leading-tight">
            {c.profils.prenom} {c.profils.nom}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[14px] text-texte-2">
            {prochain && <span>Prochain bilan : {formaterDate(prochain)}{bilanAvecPhotos(c.date_debut, c.frequence_bilan_jours, prochain) ? " · avec photos 📸" : ""}</span>}
            <span>Bilan tous les {c.frequence_bilan_jours} jours</span>
            <span>{derniereVisite ? `Dernière visite : ${derniereVisite}` : "Jamais connectée"}</span>
            {c.mode_sans_chiffres && <Etiquette ton="sable">Mode sans chiffres</Etiquette>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`/coach/clientes/${id}/suivi/export`} className={classesBouton("contour")} download>
            Exporter (Excel / CSV)
          </a>
          <LienBouton href={`/coach/clientes/${id}/suivi/nouveau?depart=1`} variante="contour">
            <IconePlus className="size-5" /> Photos de départ
          </LienBouton>
          <LienBouton href={`/coach/clientes/${id}/suivi/nouveau`}>
            <IconePlus className="size-5" /> Saisir un bilan
          </LienBouton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <VueSuivi
          champs={champs}
          bilans={bilans}
          photos={photos}
          masquerPoids={c.masquer_graph_poids}
          sansChiffres={false}
          lienBilan="/coach/bilans/"
          jours={c.frequence_bilan_jours}
          vueCoach
        />
        <Carte className="flex h-fit flex-col gap-4">
          <h2 className="font-titre text-lg font-bold">Réglages de son suivi</h2>
          <ReglagesSuivi
            clienteId={id}
            sansChiffres={c.mode_sans_chiffres}
            masquerPoids={c.masquer_graph_poids}
            rdv={isoVersHeureParis(c.prochain_rdv)}
            lienRdv={c.lien_rdv ?? ""}
          />
        </Carte>
      </div>

      {journal && (
        <Carte className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-titre text-xl font-bold">Journal quotidien</h2>
              <p className="text-[14px] text-texte-2">
                Ce qu’elle note chaque jour : moyennes par semaine, écarts par mois et synthèse, comme ton tableau.
              </p>
            </div>
            {journal.length > 0 && (
              <a href={`/coach/clientes/${id}/suivi/journal-export`} className={classesBouton("contour")} download>
                Exporter le journal (Excel / CSV)
              </a>
            )}
          </div>
          <VueJournal entrees={journal} debut={debutJournal} aujourdhui={aujJ} />
        </Carte>
      )}

      {cycle && cycle.mode !== "aucun" && (
        <Carte className="flex flex-col gap-2">
          <h2 className="font-titre text-xl font-bold">{cycle.mode === "cycle" ? "Son cycle" : "Sa périménopause"}</h2>
          {cycle.mode === "cycle" ? (
            <p className="text-[14.5px]">
              {situation
                ? `Aujourd’hui : jour ${situation.jour} de son cycle (${LIBELLE_PHASE[situation.phase]})${situation.retention ? ", période où le corps retient souvent de l’eau" : ""}. Cycle habituel : ${cycle.duree} jours.`
                : `Pas de règles notées récemment dans son journal. Cycle habituel : ${cycle.duree} jours.`}
            </p>
          ) : compteSymptomes.size ? (
            <ul className="flex flex-wrap gap-2 text-[14px]">
              {[...compteSymptomes].sort((a, b) => b[1] - a[1]).map(([code, n]) => (
                <li key={code} className="rounded-full bg-sable px-3 py-1">
                  {libelleSymptome(code)} · {n} jour{n > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14.5px] text-texte-2">Aucun symptôme noté ces 14 derniers jours.</p>
          )}
          <p className="text-[12.5px] text-texte-2">
            {cycle.mode === "perimenopause" ? "Symptômes notés ces 14 derniers jours. " : ""}Suivi choisi par ta cliente, visible seulement par elle et toi. Repères indicatifs, jamais un avis médical.
          </p>
        </Carte>
      )}
    </div>
  );
}
