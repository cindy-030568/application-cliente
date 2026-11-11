import { exigerCliente } from "@/lib/auth";
import { visiteANoter } from "@/lib/bilan";
import { BarreOnglets } from "./barre-onglets";

export default async function LayoutCliente({ children }: { children: React.ReactNode }) {
  const { supabase, fiche } = await exigerCliente();
  // Note la visite (au plus une fois par heure) pour les alertes de décrochage côté coach.
  if (visiteANoter(fiche.derniere_visite)) await supabase.rpc("noter_visite");
  return (
    <>
      <div className="pb-onglets mx-auto min-h-dvh w-full max-w-lg">{children}</div>
      <BarreOnglets />
    </>
  );
}
