import type { Metadata } from "next";
import Link from "next/link";
import { IconeCalendrier, IconeFleche } from "@/components/icones";
import { LienBouton } from "@/components/ui";
import { VueSuivi } from "@/components/suivi/vue-suivi";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis, echeanceOuverte, formaterDate, prochainBilan } from "@/lib/bilan";
import { chargerBilans, chargerChamps, champsVisibles, urlsPhotos } from "@/lib/suivi";
import { EnTete } from "../composants";

export const metadata: Metadata = { title: "Suivi" };

export default async function PageSuivi() {
  const { supabase, profil, fiche, reglages } = await exigerCliente();
  const [champsTous, bilans] = await Promise.all([chargerChamps(supabase, true), chargerBilans(supabase, profil.id)]);
  const champs = champsVisibles(
    champsTous.filter((c) => c.actif || bilans.some((b) => b.valeurs.some((v) => v.champ_id === c.id))),
    fiche.mode_sans_chiffres,
  );
  const urls = fiche.mode_sans_chiffres
    ? new Map<string, string>()
    : await urlsPhotos(supabase, bilans.flatMap((b) => b.photos.map((p) => p.fichier_path)));
  const photos = bilans.flatMap((b) =>
    b.photos.flatMap((p) => (urls.get(p.fichier_path) ? [{ angle: p.angle, date: b.date_mesure, url: urls.get(p.fichier_path)! }] : [])),
  );

  const auj = aujourdhuiParis();
  const active = fiche.statut === "active";
  const ouverte = active ? echeanceOuverte(fiche.date_debut, fiche.frequence_bilan_jours, reglages.fenetre_bilan_jours, auj) : null;
  const dejaEnvoye = ouverte ? bilans.find((b) => b.echeance === ouverte.echeance) : undefined;
  const prochain = active ? prochainBilan(fiche.date_debut, fiche.frequence_bilan_jours, auj) : null;
  const retourNonLu = bilans.find((b) => b.retour && !b.retour.lu_le);

  return (
    <>
      <EnTete titre="Mon suivi" sousTitre="Tes mesures, tes ressentis, ton chemin." />
      <div className="flex flex-col gap-6 px-5 pt-3">
        {retourNonLu && (
          <Link
            href={`/suivi/${retourNonLu.id}`}
            className="flex items-center justify-between gap-3 rounded-carte bg-chocolat p-4 text-creme apparition"
          >
            <span className="flex flex-col">
              <span className="font-medium">Cindy t’a répondu 💛</span>
              <span className="text-[14px] text-texte-clair">
                Sur ton bilan du {formaterDate(retourNonLu.date_mesure, { year: undefined })}
              </span>
            </span>
            <IconeFleche className="size-5 shrink-0" />
          </Link>
        )}

        {ouverte && !dejaEnvoye ? (
          <div className="flex flex-col gap-3 rounded-bloc bg-accent-pale p-5 apparition">
            <p className="font-titre text-xl font-bold">
              {ouverte.statut === "ouverte" ? "Ton bilan est ouvert" : "Ton bilan t’attend"}
            </p>
            <p className="text-[15px] text-texte-2">
              {ouverte.statut === "ouverte"
                ? `C’est le moment de faire le point pour le ${formaterDate(ouverte.echeance, { year: undefined })}.`
                : "Pas de souci, il est encore temps de l’envoyer."}{" "}
              Quelques minutes suffisent.
            </p>
            <LienBouton href="/suivi/bilan" pleineLargeur>
              Faire mon bilan
            </LienBouton>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-pale">
              <IconeCalendrier className="size-5" />
            </span>
            <span className="flex flex-1 flex-col">
              {dejaEnvoye ? (
                <>
                  <span className="font-medium">Bilan envoyé ✓</span>
                  <span className="text-[14px] text-texte-2">
                    {dejaEnvoye.retour ? "Cindy t’a répondu." : "Cindy te répond bientôt."}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">
                    {prochain ? `Prochain bilan le ${formaterDate(prochain, { year: undefined })}` : "Ton suivi"}
                  </span>
                  <span className="text-[14px] text-texte-2">
                    {prochain ? "Il s’ouvrira quelques jours avant." : "Tu peux noter une mesure quand tu veux."}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        <LienBouton href="/suivi/bilan" variante="contour" pleineLargeur>
          {ouverte && !dejaEnvoye ? "Ou juste noter une mesure" : "Noter une mesure"}
        </LienBouton>

        <VueSuivi
          champs={champs}
          bilans={bilans}
          photos={photos}
          masquerPoids={fiche.masquer_graph_poids}
          sansChiffres={fiche.mode_sans_chiffres}
          lienBilan="/suivi/"
        />
      </div>
    </>
  );
}
