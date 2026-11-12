import type { Metadata } from "next";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach, lireReglages } from "@/lib/auth";
import { chargerChamps } from "@/lib/suivi";
import { GestionChamps } from "./champs";
import { FormulaireReglages } from "./formulaire";
import { FormulaireTolerance } from "./tolerance";

export const metadata: Metadata = { title: "Réglages" };

export default async function PageReglages() {
  const { supabase } = await exigerCoach();
  const [reglages, champs] = await Promise.all([lireReglages(), chargerChamps(supabase, true)]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Surtitre>Réglages</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Réglages de l’app</h1>
      </div>
      <Carte>
        <FormulaireReglages reglages={reglages} />
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Recettes adaptées</h2>
          <p className="text-[14px] text-texte-2">
            L’app recalcule les quantités de chaque recette pour les cibles du repas. Une recette est
            proposée si chaque macro (protéines, glucides, lipides) tombe dans l’écart accepté : le plus
            large des deux réglages ci-dessous.
          </p>
        </div>
        <FormulaireTolerance reglages={reglages} />
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Le bilan</h2>
          <p className="text-[14px] text-texte-2">
            Les questions posées à tes clientes, rubrique par rubrique, dans cet ordre.
          </p>
        </div>
        <GestionChamps champs={champs} fenetre={reglages.fenetre_bilan_jours} intro={reglages.intro_bilan} />
      </Carte>
    </div>
  );
}
