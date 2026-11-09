import type { Metadata } from "next";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach, lireReglages } from "@/lib/auth";
import { FormulaireReglages } from "./formulaire";

export const metadata: Metadata = { title: "Réglages" };

export default async function PageReglages() {
  await exigerCoach();
  const reglages = await lireReglages();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Surtitre>Réglages</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Réglages de l’app</h1>
      </div>
      <Carte>
        <FormulaireReglages reglages={reglages} />
      </Carte>
      <p className="text-[14px] text-texte-2">
        La tolérance des recettes, les champs de mesure et les catégories arriveront ici au fil des
        phases.
      </p>
    </div>
  );
}
