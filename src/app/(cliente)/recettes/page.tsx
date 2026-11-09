import type { Metadata } from "next";
import { IconeRecettes } from "@/components/icones";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Recettes" };

export default function Page() {
  return (
    <>
      <EnTete titre="Des recettes plaisir, adaptées à toi" />
      <BientotDisponible
        icone={<IconeRecettes className="size-6" />}
        titre="Bientôt disponible"
        texte="Choisis le repas que tu veux remplacer, et l’app te proposera des recettes avec tes quantités déjà calculées."
      />
    </>
  );
}
