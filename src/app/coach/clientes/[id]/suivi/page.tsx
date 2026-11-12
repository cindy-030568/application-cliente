import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconePlus, IconeRetour } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Surtitre, classesBouton } from "@/components/ui";
import { VueSuivi } from "@/components/suivi/vue-suivi";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis, formaterDate, isoVersHeureParis, prochainBilan } from "@/lib/bilan";
import { chargerBilans, chargerChamps, urlsPhotos } from "@/lib/suivi";
import { COLONNES_FICHE } from "@/lib/types";
import type { ClienteListe } from "../../../donnees";
import { ReglagesSuivi } from "./reglages-suivi";

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
            {prochain && <span>Prochain bilan : {formaterDate(prochain)}</span>}
            <span>Bilan tous les {c.frequence_bilan_jours} jours</span>
            <span>{derniereVisite ? `Dernière visite : ${derniereVisite}` : "Jamais connectée"}</span>
            {c.mode_sans_chiffres && <Etiquette ton="sable">Mode sans chiffres</Etiquette>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={`/coach/clientes/${id}/suivi/export`} className={classesBouton("contour")} download>
            Exporter (Excel / CSV)
          </a>
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
    </div>
  );
}
