import type { Metadata } from "next";
import Link from "next/link";
import { IconePanier, IconeRetour } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis } from "@/lib/bilan";
import { joursSemaine, lundiDe } from "@/lib/planning";
import { recettesAdapteesCliente } from "@/lib/recettes-adaptees";
import { BoutonRemplirCourses, BoutonRetirer } from "./boutons";

export const metadata: Metadata = { title: "Mon planning de repas" };

const nomJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const court = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const date = (j: string) => new Date(`${j}T12:00:00Z`);

export default async function PagePlanning({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const { supabase, profil, reglages } = await exigerCliente();
  const auj = aujourdhuiParis();
  const demande = (await searchParams).semaine;
  const lundi = demande && /^\d{4}-\d{2}-\d{2}$/.test(demande) ? lundiDe(demande) : lundiDe(auj);
  const jours = joursSemaine(lundi);
  const [repas, { data: planning, error: sansPlanning }] = await Promise.all([
    recettesAdapteesCliente(supabase, profil.id, reglages),
    supabase
      .from("planning_repas")
      .select("jour, repas_cible_id, recette_id, recettes(titre)")
      .eq("cliente_id", profil.id)
      .gte("jour", jours[0])
      .lte("jour", jours[6])
      .returns<{ jour: string; repas_cible_id: string; recette_id: string; recettes: { titre: string } | null }[]>(),
  ]);
  const choix = new Map((planning ?? []).map((p) => [`${p.jour}|${p.repas_cible_id}`, p]));

  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/recettes" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Recettes
      </Link>
      <div>
        <h1 className="font-titre text-[30px] font-bold leading-tight">Mon planning de repas</h1>
        <p className="text-[15px] text-texte-2">
          Semaine du {court.format(date(jours[0]))} au {court.format(date(jours[6]))} · tes recettes, déjà adaptées à toi.
        </p>
      </div>
      <nav className="flex items-center justify-between text-[14.5px]" aria-label="Autres semaines">
        <Link href={`/recettes/planning?semaine=${ajouterJours(lundi, -7)}`} className="underline underline-offset-4">
          ← Semaine d’avant
        </Link>
        {lundi !== lundiDe(auj) && (
          <Link href="/recettes/planning" className="underline underline-offset-4">
            Cette semaine
          </Link>
        )}
        <Link href={`/recettes/planning?semaine=${ajouterJours(lundi, 7)}`} className="underline underline-offset-4">
          Semaine d’après →
        </Link>
      </nav>

      {sansPlanning ? (
        <p className="rounded-carte bg-blanc-casse p-5 text-[15px] text-texte-2 shadow-douce">Le planning arrive très bientôt dans ton appli 💛</p>
      ) : repas.length === 0 ? (
        <p className="rounded-carte bg-blanc-casse p-5 text-[15px] text-texte-2 shadow-douce">
          Cindy prépare tes repères pour chaque repas : ton planning sera disponible dès que c’est fait.
        </p>
      ) : (
        <>
          <BoutonRemplirCourses lundi={lundi} vide={!(planning ?? []).length} />
          <ol className="flex flex-col gap-3">
            {jours.map((j) => (
              <li key={j} className="flex flex-col gap-2 rounded-carte bg-blanc-casse p-4 shadow-douce">
                <h2 className="font-titre text-[18px] font-bold first-letter:uppercase">
                  {nomJour.format(date(j))}
                  {j === auj && <span className="ml-2 align-middle text-[12px] font-medium text-accent">aujourd’hui</span>}
                </h2>
                <ul className="flex flex-col divide-y divide-ligne">
                  {repas.map((r, i) => {
                    const p = choix.get(`${j}|${r.repas.id}`);
                    return (
                      <li key={r.repas.id} className="flex items-center gap-3 py-2">
                        <span className="w-24 shrink-0 text-[13px] text-texte-2">{r.repas.libelle}</span>
                        {p ? (
                          <>
                            <Link href={`/recettes/${p.recette_id}?repas=${i}`} className="min-w-0 flex-1 truncate text-[15px] font-medium underline-offset-4 hover:underline">
                              {p.recettes?.titre ?? "Recette"}
                            </Link>
                            <BoutonRetirer jour={j} repasCibleId={r.repas.id} titre={p.recettes?.titre ?? "la recette"} />
                          </>
                        ) : (
                          <Link
                            href={`/recettes/planning/choisir?jour=${j}&repas=${i}`}
                            className="flex-1 text-[14.5px] font-medium text-accent"
                            aria-label={`Choisir une recette pour le ${r.repas.libelle.toLowerCase()} du ${nomJour.format(date(j))}`}
                          >
                            + Choisir
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
          <Link href="/recettes/courses" className="inline-flex items-center gap-2 self-center text-[15px] font-medium underline underline-offset-4">
            <IconePanier className="size-5" /> Voir ma liste de courses
          </Link>
        </>
      )}
    </div>
  );
}
