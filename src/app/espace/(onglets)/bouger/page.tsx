import type { Metadata } from "next";
import { CarteDefiCliente } from "@/components/defis/carte-defi";
import { BibliothequeExpress } from "@/components/express/bibliotheque";
import { exigerAbonnee } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { lireEtatCommunaute } from "@/lib/communaute-serveur";
import { defisDeLaCliente } from "@/lib/defis-serveur";
import { lireSeancesExpress } from "@/lib/seances-express-serveur";
import { EnTete } from "../../../(cliente)/composants";

export const metadata: Metadata = { title: "Bouger" };

type Params = { duree?: string; materiel?: string; type?: string; favoris?: string };

/** « Bouger » (abonnées) : le défi du mois, puis les séances express. */
export default async function BougerAbonnee({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profil, fiche } = await exigerAbonnee();
  const params = await searchParams;
  const auj = aujourdhuiParis();
  const [seances, { data: favs }, defis, communaute] = await Promise.all([
    lireSeancesExpress(supabase, { publiees: true }),
    supabase.from("seances_express_favoris").select("seance_id").eq("cliente_id", profil.id),
    defisDeLaCliente(supabase, profil.id, auj),
    lireEtatCommunaute(supabase),
  ]);
  const favoris = new Set((favs ?? []).map((f) => f.seance_id as string));
  return (
    <>
      <EnTete titre="Bouger" sousTitre="Quelques minutes, chez toi, à ton rythme : chaque mouvement compte 💪" profil="/espace/profil" />
      <div className="flex flex-col gap-6 px-5 pb-6 pt-3">
        {defis.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Défis du mois">
            {defis.map((d) => (
              <CarteDefiCliente key={d.id} d={d} auj={auj} sansChiffres={fiche.mode_sans_chiffres} communaute={Boolean(communaute?.ouverte)} />
            ))}
          </section>
        )}
        <section className="flex flex-col gap-4" aria-labelledby="titre-express">
          <h2 id="titre-express" className="font-titre text-[22px] font-bold">
            ⚡ Séances express
          </h2>
          {seances && seances.length > 0 ? (
            <BibliothequeExpress seances={seances} favoris={favoris} params={params} base="/espace/bouger" />
          ) : (
            <p className="rounded-carte bg-blanc-casse p-5 text-[15px] text-texte-2 shadow-douce">Je prépare tes premières séances : reviens très vite !</p>
          )}
        </section>
      </div>
    </>
  );
}
