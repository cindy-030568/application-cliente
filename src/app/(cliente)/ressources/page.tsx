import type { Metadata } from "next";
import { IconeRessources } from "@/components/icones";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Ressources" };

export default function Page() {
  return (
    <>
      <EnTete titre="Mes ressources" />
      <BientotDisponible
        icone={<IconeRessources className="size-6" />}
        titre="Bientôt disponible"
        texte="Guides, listes de courses, fiches pratiques : tout sera réuni ici."
      />
    </>
  );
}
