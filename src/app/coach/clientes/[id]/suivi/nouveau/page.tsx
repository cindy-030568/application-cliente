import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { FormulaireBilan } from "@/components/suivi/formulaire-bilan";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { chargerChamps, champsVisibles } from "@/lib/suivi";

export const metadata: Metadata = { title: "Saisir un bilan" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageSaisieCoach({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ depart?: string }>;
}) {
  const { id } = await params;
  const depart = (await searchParams).depart === "1";
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: c } = await supabase
    .from("clientes")
    .select("mode_sans_chiffres, frequence_bilan_jours, date_debut, profils!inner(prenom)")
    .eq("id", id)
    .maybeSingle<{ mode_sans_chiffres: boolean; frequence_bilan_jours: number; date_debut: string | null; profils: { prenom: string } }>();
  if (!c) notFound();
  const tous = champsVisibles(await chargerChamps(supabase), c.mode_sans_chiffres);
  // Point de départ : seulement les mesures (et les photos).
  const champs = depart ? tous.filter((ch) => ch.groupe === "mesure") : tous;
  const auj = aujourdhuiParis();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href={`/coach/clientes/${id}/suivi`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Suivi de {c.profils.prenom}
      </Link>
      <div>
        <Surtitre>Saisie par la coach</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">
          {depart ? `Point de départ de ${c.profils.prenom}` : `Bilan de ${c.profils.prenom}`}
        </h1>
        <p className="text-[15px] text-texte-2">
          {depart
            ? "Ses premières photos et mesures, à la date de son démarrage : elles serviront d’« avant » dans le comparatif avant / après. Elle les verra dans son suivi."
            : "Pratique pendant un bilan en visio. Elle le retrouvera dans son historique."}
        </p>
      </div>
      <Carte>
        <FormulaireBilan
          champs={champs}
          jours={c.frequence_bilan_jours}
          avecCommentaire={!depart}
          clienteCible={id}
          dateInitiale={depart ? (c.date_debut && c.date_debut <= auj ? c.date_debut : auj) : auj}
          libelleDate={depart ? "Date des photos (son démarrage)" : "Date du bilan"}
          champsCaches={depart ? { depart: "1" } : {}}
          dateMax={auj}
          sansPhotos={c.mode_sans_chiffres}
          redirection={depart ? `/coach/clientes/${id}/suivi` : `/coach/bilans/{id}`}
          libelleEnvoi={depart ? "Enregistrer le point de départ" : "Enregistrer le bilan"}
          libelleCommentaire="Tes notes de l’échange (visibles par elle)"
        />
      </Carte>
    </div>
  );
}
