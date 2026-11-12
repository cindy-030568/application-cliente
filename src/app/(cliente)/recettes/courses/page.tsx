import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { regrouperCourses, type LigneCourses } from "@/lib/courses";
import { ListeCourses } from "./liste";

export const metadata: Metadata = { title: "Liste de courses" };

export default async function PageCourses() {
  const { supabase, profil } = await exigerCliente();
  const { data } = await supabase
    .from("courses")
    .select("id, lot, recette_titre, portions, aliment_id, nom, rayon, quantite, unite, nom_unite, coche, created_at")
    .eq("cliente_id", profil.id)
    .order("created_at")
    .returns<(LigneCourses & { lot: string | null; recette_titre: string | null; portions: number | null; created_at: string })[]>();
  const lignes = (data ?? []).map((l) => ({ ...l, quantite: l.quantite === null ? null : Number(l.quantite) }));

  const recettes = new Map<string, { lot: string; titre: string; portions: number }>();
  for (const l of lignes) {
    if (l.lot && l.recette_titre && !recettes.has(l.lot)) recettes.set(l.lot, { lot: l.lot, titre: l.recette_titre, portions: l.portions ?? 1 });
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-8">
      <header className="pt-encoche flex flex-col gap-3">
        <Link href="/recettes" className="inline-flex min-h-11 items-center gap-1 self-start text-[14.5px] text-texte-2">
          <IconeRetour className="size-5" /> Recettes
        </Link>
        <h1 className="font-titre text-[30px] font-bold leading-[1.12]">Ma liste de courses</h1>
      </header>
      <ListeCourses sections={regrouperCourses(lignes)} recettes={[...recettes.values()]} />
    </div>
  );
}
