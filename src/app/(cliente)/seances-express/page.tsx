import type { Metadata } from "next";
import { exigerCliente } from "@/lib/auth";
import { accesExpress } from "@/lib/seances-express";
import { BibliothequeExpress } from "@/components/express/bibliotheque";
import { lireSeancesExpress } from "@/lib/seances-express-serveur";
import { BientotDisponible, EnTete } from "../composants";
import { IconeSport } from "@/components/icones";

export const metadata: Metadata = { title: "Séances express" };

type Params = { duree?: string; materiel?: string; type?: string; favoris?: string };

export default async function PageSeancesExpressCliente({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profil, fiche } = await exigerCliente();
  const params = await searchParams;
  const ouvert = accesExpress(fiche);
  const [seances, { data: favorisLus }] = ouvert
    ? await Promise.all([lireSeancesExpress(supabase, { publiees: true }), supabase.from("seances_express_favoris").select("seance_id").eq("cliente_id", profil.id)])
    : [null, { data: [] }];
  const favoris = new Set((favorisLus ?? []).map((f) => f.seance_id as string));
  return (
    <>
      <EnTete titre="Séances express" sousTitre="Pas le temps, pas de salle, en déplacement ? Une petite séance vaut toujours mieux que rien 💛" />
      {!ouvert ? (
        <BientotDisponible
          icone={<IconeSport className="size-6" />}
          titre="Pas disponible pour le moment"
          texte="Les séances express ne sont pas disponibles sur ton compte. Écris-moi si tu penses que c’est une erreur 💛"
        />
      ) : seances === null || seances.length === 0 ? (
        <BientotDisponible icone={<IconeSport className="size-6" />} titre="Bientôt ici" texte="Je prépare tes premières séances express : reviens très vite !" />
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-6 pt-3">
          <BibliothequeExpress seances={seances} favoris={favoris} params={params} base="/seances-express" />
        </div>
      )}
    </>
  );
}
