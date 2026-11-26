import { EncouragementDuJour } from "@/components/encouragement";
import { BandeauHorsConnexion } from "@/components/hors-connexion";
import { EnregistrementServiceWorker } from "@/components/pwa";
import { exigerAbonnee } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { accesCommunaute } from "@/lib/communaute-serveur";
import { encouragementDuJour } from "@/lib/encouragements";
import { BarreOnglets } from "../../(cliente)/barre-onglets";

/** Espace d'une abonnée (sans coaching) : ses onglets, à elle. */
export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  const { supabase, profil } = await exigerAbonnee();
  const communaute = await accesCommunaute(supabase, profil.id);
  const jour = aujourdhuiParis();
  return (
    <>
      <div className="pb-onglets mx-auto min-h-dvh w-full max-w-lg">
        <div className="px-5">
          <BandeauHorsConnexion />
        </div>
        {children}
      </div>
      <BarreOnglets espace communaute={communaute ? { nonLus: communaute.nonLus } : null} />
      <EnregistrementServiceWorker />
      <EncouragementDuJour jour={jour} phrase={encouragementDuJour(jour)} />
    </>
  );
}
