import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { FormulaireBilan } from "@/components/suivi/formulaire-bilan";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis, echeanceOuverte } from "@/lib/bilan";
import { chargerChamps, champsVisibles } from "@/lib/suivi";

export const metadata: Metadata = { title: "Mon bilan" };

export default async function PageNouveauBilan() {
  const { supabase, profil, fiche, reglages } = await exigerCliente();
  const champs = champsVisibles(await chargerChamps(supabase), fiche.mode_sans_chiffres);
  const auj = aujourdhuiParis();
  const ouverte =
    fiche.statut === "active"
      ? echeanceOuverte(fiche.date_debut, fiche.frequence_bilan_jours, reglages.fenetre_bilan_jours, auj)
      : null;
  let estBilan = false;
  if (ouverte) {
    const { data } = await supabase
      .from("bilans")
      .select("id")
      .eq("cliente_id", profil.id)
      .eq("echeance", ouverte.echeance)
      .maybeSingle();
    estBilan = !data;
  }

  return (
    <div className="pt-encoche flex flex-col gap-6 px-5">
      <Link href="/suivi" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Mon suivi
      </Link>
      <div>
        <h1 className="font-titre text-[30px] font-bold leading-tight">
          {estBilan ? "Mon bilan" : "Noter une mesure"}
        </h1>
        <p className="text-[15px] text-texte-2">
          {estBilan
            ? "Prends quelques minutes pour toi. Il n’y a pas de bonne ou de mauvaise réponse."
            : "Une mesure en plus de tes bilans, quand tu en as envie."}
        </p>
      </div>
      <FormulaireBilan
        champs={champs}
        dateInitiale={auj}
        dateMax={auj}
        sansPhotos={fiche.mode_sans_chiffres}
        redirection="/suivi/{id}?envoye=1"
        libelleEnvoi={estBilan ? "Envoyer mon bilan à Cindy" : "Enregistrer"}
      />
    </div>
  );
}
