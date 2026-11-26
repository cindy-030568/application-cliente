import type { Metadata } from "next";
import Link from "next/link";
import { Carte, Etiquette, Message, Surtitre } from "@/components/ui";
import { textePrix } from "@/lib/abonnement";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { exigerCoach } from "@/lib/auth";
import { formaterDate } from "@/lib/bilan";
import { SITE_URL } from "@/lib/env";
import { configurationStripe, lirePrix } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { FormulaireOffre } from "./formulaire";

export const metadata: Metadata = { title: "Abonnées" };

type Abonnee = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  statut: string;
  depuis: string | null;
  ferme_le: string | null;
  abonnement_statut: string | null;
  abonnement_formule: string | null;
  abonnement_fin_periode: string | null;
  abonnement_resilie: boolean;
};

/** Les abonnées (sans coaching) : l'offre, et la liste (jamais leurs données personnelles de suivi). */
export default async function PageAbonnees() {
  const { supabase } = await exigerCoach();
  const [{ data, error }, reglages] = await Promise.all([supabase.rpc("liste_abonnees"), lireReglagesAbonnement(createAdminClient()).catch(() => null)]);
  const abonnees = (data ?? []) as Abonnee[];
  const config = configurationStripe();
  const [mensuel, annuel] = await Promise.all([lirePrix(reglages?.prixMensuel ?? null), lirePrix(reglages?.prixAnnuel ?? null)]);
  const actives = abonnees.filter((a) => a.statut !== "fermee");
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <Surtitre>Abonnées</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Mes abonnées</h1>
        <p className="mt-1 text-[15px] text-texte-2">
          Des femmes qui ne suivent pas ton coaching et s’abonnent à ton appli. Elles ont leur propre espace : elles ne voient rien de ton coaching, et tu ne vois pas leurs données
          personnelles, seulement leur abonnement.
        </p>
      </div>
      {error || !reglages ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0045_abonnees.sql (voir le guide).</Message>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Chiffre valeur={actives.length} libelle="abonnées actives" />
            <Chiffre valeur={actives.filter((a) => a.abonnement_resilie).length} libelle="arrêt programmé" />
            <Chiffre valeur={abonnees.length - actives.length} libelle="anciennes abonnées (6 mois)" />
          </div>

          <Carte className="flex flex-col gap-3">
            <h2 className="font-titre text-xl font-bold">Liste</h2>
            {abonnees.length === 0 ? (
              <p className="text-[14.5px] text-texte-2">Pas encore d’abonnée. Elles apparaîtront ici dès leur premier paiement.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ligne">
                {abonnees.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-[14.5px]">
                    <span className="flex flex-col">
                      <span className="font-medium">{`${a.prenom} ${a.nom}`.trim() || a.email}</span>
                      <span className="text-[13px] text-texte-2">{a.email}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[13px] text-texte-2">
                      {a.statut === "fermee" ? (
                        <Etiquette>Terminé{a.ferme_le ? ` le ${formaterDate(a.ferme_le)}` : ""}</Etiquette>
                      ) : a.abonnement_statut === "past_due" ? (
                        <Etiquette ton="rose">Paiement en échec</Etiquette>
                      ) : a.abonnement_resilie ? (
                        <Etiquette ton="sable">Arrêt le {a.abonnement_fin_periode ? formaterDate(a.abonnement_fin_periode) : "?"}</Etiquette>
                      ) : (
                        <Etiquette ton="vert">Active</Etiquette>
                      )}
                      {a.abonnement_formule && <span>{a.abonnement_formule === "annuel" ? "à l’année" : "au mois"}</span>}
                      {a.depuis && <span>depuis le {formaterDate(a.depuis)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <Carte id="offre" className="flex scroll-mt-6 flex-col gap-4">
            <div>
              <h2 className="font-titre text-xl font-bold">Mon offre</h2>
              <p className="text-[14px] text-texte-2">
                Page publique d’inscription :{" "}
                <Link href="/abonnement" className="font-medium underline underline-offset-4">
                  {SITE_URL()}/abonnement
                </Link>{" "}
                (tu peux la voir même fermée).
              </p>
            </div>
            <ul className="flex flex-col gap-1 rounded-xl bg-creme/60 p-4 text-[14px]">
              <li>{config.cle ? `✓ Clé Stripe enregistrée dans Vercel${config.test ? " (mode test)" : ""}` : "⚠️ Clé Stripe absente : ajoute STRIPE_SECRET_KEY dans Vercel (voir le guide)."}</li>
              <li>{config.webhook ? "✓ Secret des messages Stripe enregistré" : "⚠️ Secret des messages absent : ajoute STRIPE_WEBHOOK_SECRET dans Vercel (voir le guide)."}</li>
              <li>
                Adresse à donner à Stripe (webhook) : <code className="break-all rounded bg-blanc-casse px-1.5 py-0.5 text-[13px]">{SITE_URL()}/api/stripe/webhook</code>
              </li>
            </ul>
            <FormulaireOffre
              v={{ actif: reglages.actif, titre: reglages.titre, texte: reglages.texte, prixMensuel: reglages.prixMensuel, prixAnnuel: reglages.prixAnnuel, lienCgv: reglages.lienCgv }}
              prixLus={{ mensuel: textePrix(mensuel), annuel: textePrix(annuel) }}
            />
            <p className="text-[13px] text-texte-2">
              Le bouton « Passer au coaching » des abonnées mène vers ton lien d’inscription (Réglages → Parrainage) : {reglages.lienCoaching ?? "pas encore renseigné"}.
            </p>
          </Carte>
        </>
      )}
    </div>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="rounded-carte bg-blanc-casse p-4 shadow-douce">
      <p className="font-titre text-[30px] font-bold leading-none">{valeur}</p>
      <p className="mt-1 text-[13.5px] text-texte-2">{libelle}</p>
    </div>
  );
}
