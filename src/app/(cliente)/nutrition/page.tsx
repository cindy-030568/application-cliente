import type { Metadata } from "next";
import { IconeNutrition } from "@/components/icones";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Nutrition" };

export default function Page() {
  return (
    <>
      <EnTete titre="Mon plan alimentaire" />
      <BientotDisponible
        icone={<IconeNutrition className="size-6" />}
        titre="Bientôt disponible"
        texte="Ton plan alimentaire arrive très bientôt ici : tu pourras le lire et le télécharger directement depuis l’app."
      />
    </>
  );
}
