import type { Metadata } from "next";
import { EnTete } from "@/app/(cliente)/composants";
import { EspaceCommunaute } from "@/components/communaute/espace-communaute";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { exigerAbonnee } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Communauté" };

/** Communauté d'une abonnée : l'espace commun, partagé avec mes clientes coachées. */
export default async function PageCommunauteAbonnee() {
  const { supabase, profil, reglages } = await exigerAbonnee();
  const offre = await lireReglagesAbonnement(createAdminClient()).catch(() => null);
  return (
    <>
      <EnTete titre="La communauté" sousTitre="Ensemble, on se motive 💛" profil="/espace/profil" />
      <div className="flex flex-col gap-5 px-5 pb-6 pt-3">
        <EspaceCommunaute supabase={supabase} moi={profil.id} lienPolitique={reglages.lien_politique} salon="commun" abonnee base="/espace/communaute" />
        {offre?.lienCoaching && (
          <p className="text-center text-[13.5px] text-texte-2">
            Envie d’aller plus loin avec moi ?{" "}
            <a href={offre.lienCoaching} target="_blank" rel="noopener noreferrer" className="font-medium text-chocolat underline underline-offset-4">
              Découvre le coaching
            </a>
          </p>
        )}
      </div>
    </>
  );
}
