import { exigerCliente } from "@/lib/auth";
import { visiteANoter } from "@/lib/bilan";
import { accesCommunaute } from "@/lib/communaute-serveur";
import { lireSuiviSport } from "@/lib/paiements-serveur";
import { EnregistrementServiceWorker } from "@/components/pwa";
import { BarreOnglets } from "./barre-onglets";

export default async function LayoutCliente({ children }: { children: React.ReactNode }) {
  const { supabase, profil, fiche } = await exigerCliente();
  // Note la visite (au plus une fois par heure) pour les alertes de décrochage côté coach.
  if (visiteANoter(fiche.derniere_visite)) await supabase.rpc("noter_visite");
  const [communaute, sport] = await Promise.all([accesCommunaute(supabase, profil.id), lireSuiviSport(supabase, profil.id)]);
  return (
    <>
      <div className="pb-onglets mx-auto min-h-dvh w-full max-w-lg">{children}</div>
      <BarreOnglets communaute={communaute ? { nonLus: communaute.nonLus } : null} sport={sport} />
      <EnregistrementServiceWorker />
    </>
  );
}
