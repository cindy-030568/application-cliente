import type { Metadata } from "next";
import { IconeTrophee } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { defisDeLaCliente } from "@/lib/defis-serveur";
import { CarteDefiCliente } from "@/components/defis/carte-defi";
import { lireEtatCommunaute } from "@/lib/communaute-serveur";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Défis du mois" };

export default async function PageDefisCliente() {
  const { supabase, profil, fiche } = await exigerCliente();
  const auj = aujourdhuiParis();
  const [defis, communaute] = await Promise.all([defisDeLaCliente(supabase, profil.id, auj), lireEtatCommunaute(supabase)]);
  const sansChiffres = fiche.mode_sans_chiffres;
  return (
    <>
      <EnTete titre="Défis du mois" sousTitre="On se lance ensemble ? Tu choisis de relever le défi, et on avance à notre rythme 💛" />
      {defis.length === 0 ? (
        <BientotDisponible icone={<IconeTrophee className="size-6" />} titre="Pas de défi en ce moment" texte="Je prépare le prochain : je te préviens dès qu’il commence !" />
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-6 pt-3">
          {defis.map((d) => (
            <CarteDefiCliente key={d.id} d={d} auj={auj} sansChiffres={sansChiffres} communaute={Boolean(communaute?.ouverte)} />
          ))}
        </div>
      )}
    </>
  );
}
