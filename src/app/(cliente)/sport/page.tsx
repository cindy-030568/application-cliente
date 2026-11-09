import type { Metadata } from "next";
import { IconeSport } from "@/components/icones";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Sport" };

export default function Page() {
  return (
    <>
      <EnTete titre="Mon programme sportif" />
      <span id="videos" />
      <BientotDisponible
        icone={<IconeSport className="size-6" />}
        titre="Bientôt disponible"
        texte="Ton programme et la bibliothèque de vidéos d’exercices arrivent bientôt."
      />
    </>
  );
}
