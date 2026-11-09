import type { Metadata } from "next";
import { IconeSuivi } from "@/components/icones";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Suivi" };

export default function Page() {
  return (
    <>
      <EnTete titre="Mon suivi" />
      <BientotDisponible
        icone={<IconeSuivi className="size-6" />}
        titre="Bientôt disponible"
        texte="Tu pourras bientôt noter tes mesures et voir ton évolution, à ton rythme."
      />
    </>
  );
}
