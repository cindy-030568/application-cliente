import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { FormulaireBilan } from "@/components/suivi/formulaire-bilan";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis, echeanceOuverte } from "@/lib/bilan";
import { redirect } from "next/navigation";
import { avecJours } from "@/lib/champs";
import { chargerChamps, champsVisibles } from "@/lib/suivi";

export const metadata: Metadata = { title: "Mon bilan" };

export default async function PageNouveauBilan() {
  const { supabase, profil, fiche, reglages } = await exigerCliente();
  const tous = champsVisibles(await chargerChamps(supabase), fiche.mode_sans_chiffres);
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
  // Bilan : toute la trame. Saisie libre entre deux bilans : seulement les mesures.
  const champs = estBilan ? tous : tous.filter((c) => c.groupe === "mesure");
  if (champs.length === 0) redirect("/suivi");
  const jours = fiche.frequence_bilan_jours;

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
            ? `Trame de bilan · tous les ${jours} jours`
            : "Une mesure en plus de tes bilans, quand tu en as envie."}
        </p>
      </div>
      <FormulaireBilan
        champs={champs}
        jours={jours}
        intro={estBilan ? avecJours(reglages.intro_bilan, jours) : undefined}
        avecCommentaire={!estBilan}
        dateInitiale={auj}
        dateMax={auj}
        sansPhotos={fiche.mode_sans_chiffres}
        redirection="/suivi/{id}?envoye=1"
        libelleEnvoi={estBilan ? "Envoyer mon bilan à Cindy" : "Enregistrer"}
      />
    </div>
  );
}
