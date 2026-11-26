import type { Metadata } from "next";
import Link from "next/link";
import { ListeCourses } from "@/app/(cliente)/recettes/courses/liste";
import { IconeRetour } from "@/components/icones";
import { exigerAbonnee } from "@/lib/auth";
import { regrouperCourses, type LigneCourses } from "@/lib/courses";

export const metadata: Metadata = { title: "Liste de courses" };

/** La liste de courses de l'abonnée (privée) : celle de son menu, et ce qu'elle ajoute à la main. */
export default async function CoursesAbonnee() {
  const { supabase, profil } = await exigerAbonnee();
  const { data } = await supabase
    .from("courses")
    .select("id, lot, recette_titre, portions, aliment_id, nom, rayon, quantite, unite, nom_unite, coche, created_at")
    .eq("cliente_id", profil.id)
    .order("created_at")
    .returns<(LigneCourses & { lot: string | null; recette_titre: string | null; portions: number | null })[]>();
  const lignes = (data ?? []).map((l) => ({ ...l, quantite: l.quantite === null ? null : Number(l.quantite) }));
  const lots = new Map<string, { lot: string; titre: string; portions: number }>();
  for (const l of lignes) if (l.lot && l.recette_titre && !lots.has(l.lot)) lots.set(l.lot, { lot: l.lot, titre: l.recette_titre, portions: l.portions ?? 1 });
  return (
    <div className="flex flex-col gap-5 px-5 pb-8">
      <header className="pt-encoche flex flex-col gap-3">
        <Link href="/espace/recettes/menu" className="inline-flex min-h-11 items-center gap-1 self-start text-[14.5px] text-texte-2">
          <IconeRetour className="size-5" /> Mon menu
        </Link>
        <h1 className="font-titre text-[30px] font-bold leading-[1.12]">Ma liste de courses</h1>
      </header>
      <ListeCourses
        sections={regrouperCourses(lignes)}
        recettes={[...lots.values()]}
        retour="/espace/recettes/menu"
        libelleRetour="Voir mon menu"
        vide="Dans ton menu de la semaine, touche « Ajouter le menu à ma liste de courses » : tout arrive ici, rangé par rayon."
      />
    </div>
  );
}
