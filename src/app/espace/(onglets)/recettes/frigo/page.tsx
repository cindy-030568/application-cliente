import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { exigerAbonnee } from "@/lib/auth";
import { ingredientsACocher } from "@/lib/menus";
import { chargerRecettes, urlPhotoRecette } from "@/lib/recettes";
import { AvecCeQueJai } from "./avec-ce-que-j-ai";

export const metadata: Metadata = { title: "Avec ce que j’ai" };

/** « Avec ce que j'ai » : elle coche ce qu'elle a, l'appli lui montre mes recettes faisables. */
export default async function FrigoAbonnee() {
  const { supabase } = await exigerAbonnee();
  const recettes = await chargerRecettes(supabase);
  const legeres = recettes.map((r) => ({
    id: r.id,
    titre: r.titre,
    repas: r.repas,
    photo: urlPhotoRecette(r.photo_path),
    ingredients: r.ingredients.map((i) => ({ aliment_id: i.aliment_id, role: i.role, unite: i.unite, qte_base: i.qte_base, aliment: { nom: i.aliment.nom, nom_unite: i.aliment.nom_unite } })),
  }));
  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-8">
      <Link href="/espace/recettes" className="inline-flex min-h-11 items-center gap-1 self-start text-[14.5px] text-texte-2">
        <IconeRetour className="size-5" /> Recettes
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[30px] font-bold leading-[1.12]">Avec ce que j’ai</h1>
        <p className="text-[15px] text-texte-2">Coche ce que tu as dans ton frigo et tes placards : je te montre ce que tu peux cuisiner. Le sel, l’huile et les épices sont déjà comptés.</p>
      </div>
      <AvecCeQueJai recettes={legeres} ingredients={ingredientsACocher(legeres)} />
    </div>
  );
}
