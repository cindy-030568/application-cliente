import type { Metadata } from "next";
import Link from "next/link";
import { BoutonDeconnexion } from "@/components/hors-connexion";
import { IconeDeconnexion, IconeFleche, IconeRetour } from "@/components/icones";
import { Carte } from "@/components/ui";
import { CarteInstallation } from "@/components/pwa";
import { texteMonAbonnement } from "@/lib/abonnement";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { exigerAbonnee } from "@/lib/auth";
import { formaterDate } from "@/lib/bilan";
import { createAdminClient } from "@/lib/supabase/admin";
import { BoutonGerer } from "../../bouton-gerer";
import { InterrupteurSansChiffres } from "../../sans-chiffres";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilAbonnee() {
  const { profil, fiche } = await exigerAbonnee();
  const reglages = await lireReglagesAbonnement(createAdminClient()).catch(() => null);
  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/espace" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <h1 className="font-titre text-[30px] font-bold leading-tight">Mon profil</h1>
      <Carte className="flex flex-col gap-1">
        <span className="font-medium">{profil.prenom}</span>
        <span className="text-[14px] text-texte-2">{profil.email}</span>
      </Carte>
      <Carte className="flex flex-col gap-3">
        <h2 className="font-titre text-xl font-bold">Mon abonnement</h2>
        <p className="text-[15px]">{texteMonAbonnement(fiche, (d) => formaterDate(d))}</p>
        <BoutonGerer />
        <p className="text-[13px] text-texte-2">Carte bancaire, factures, formule, arrêt : tout se gère dans l’espace sécurisé de Stripe.</p>
      </Carte>
      <Link href="/espace/metabolisme" className="flex items-center justify-between rounded-carte bg-blanc-casse p-4 shadow-douce">
        <span className="flex flex-col">
          <span className="font-medium">🔥 Mon métabolisme</span>
          <span className="text-[13.5px] text-texte-2">Mes repères du quotidien</span>
        </span>
        <IconeFleche className="size-5 text-texte-2" />
      </Link>
      <Carte>
        <InterrupteurSansChiffres actif={fiche.mode_sans_chiffres} />
      </Carte>
      <CarteInstallation toujours />
      {reglages?.lienCoaching && (
        <a id="coaching" href={reglages.lienCoaching} target="_blank" rel="noopener noreferrer" className="scroll-mt-6 rounded-carte bg-chocolat p-5 text-creme">
          <span className="block text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-clair">Envie d’aller plus loin ?</span>
          <span className="mt-1 block font-titre text-[20px] font-bold">Passer au coaching</span>
          <span className="mt-1 block text-[14px] text-texte-clair">Un plan fait pour toi, mon suivi personnalisé, et l’appli à vie.</span>
        </a>
      )}
      <BoutonDeconnexion className="inline-flex w-fit items-center gap-2 text-[15px] text-texte-2">
        <IconeDeconnexion className="size-5" /> Me déconnecter
      </BoutonDeconnexion>
    </div>
  );
}
