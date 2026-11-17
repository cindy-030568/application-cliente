import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconePlus, IconeRetour } from "@/components/icones";
import { Bouton, Carte, Etiquette, Message } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { apportsPlan } from "@/lib/plan-alimentaire";
import { dernierPoids, lireBesoins, lirePlansAlimentaires } from "@/lib/plan-alimentaire-serveur";
import { creerPlanAlimentaire } from "../../plan-alimentaire-actions";
import { FormulaireBesoins } from "./besoins";

export const metadata: Metadata = { title: "Plan alimentaire" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERREURS: Record<string, string> = {
  session: "Ta session coach a expiré. Recharge la page et reconnecte-toi.",
  migration: "Fais d’abord la mise à jour de la base : fichier 0015_plan_alimentaire.sql (voir le guide).",
  copie: "Le plan à copier est introuvable.",
  creation: "Le plan n’a pas pu être créé. Réessaie dans un instant.",
};
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default async function PagePlansAlimentaires({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { id } = await params;
  const { erreur } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: c } = await supabase
    .from("clientes")
    .select("id, profils!inner(prenom, nom)")
    .eq("id", id)
    .maybeSingle<{ id: string; profils: { prenom: string; nom: string } }>();
  if (!c) notFound();

  const [besoins, plans, poidsJournal] = await Promise.all([
    lireBesoins(supabase, id),
    lirePlansAlimentaires(supabase, id),
    dernierPoids(supabase, id),
  ]);
  // Plans de toutes les clientes, pour partir d'un plan existant.
  const { data: modeles } = plans
    ? await supabase
        .from("plans_alimentaires")
        .select("id, titre, created_at, clientes!inner(profils!inner(prenom, nom))")
        .order("updated_at", { ascending: false })
        .limit(60)
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/coach/clientes/${id}`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Fiche de {c.profils.prenom}
      </Link>
      <div>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Plan alimentaire</h1>
        <p className="text-[15px] text-texte-2">
          {c.profils.prenom} {c.profils.nom} · ses besoins, puis son plan repas par repas.
        </p>
      </div>
      {erreur && ERREURS[erreur] && <Message ton="erreur">{ERREURS[erreur]}</Message>}

      {!besoins || !plans ? (
        <Message ton="info">{ERREURS.migration}</Message>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Carte className="flex min-w-0 flex-col gap-4">
            <div>
              <h2 className="font-titre text-xl font-bold">Ses besoins</h2>
              <p className="text-[13.5px] text-texte-2">
                Ces objectifs servent de repère dans l’éditeur du plan. Visible par toi seulement.
              </p>
            </div>
            <FormulaireBesoins clienteId={id} initiaux={besoins.besoins} aujourdhui={aujourdhuiParis()} poidsJournal={poidsJournal} />
          </Carte>

          <div className="flex flex-col gap-6">
            <Carte className="flex flex-col gap-4">
              <h2 className="font-titre text-xl font-bold">Ses plans</h2>
              {plans.length === 0 ? (
                <p className="text-[14px] text-texte-2">Aucun plan pour l’instant.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-ligne">
                  {plans.map((p) => {
                    const t = apportsPlan(p.contenu);
                    return (
                      <li key={p.id}>
                        <Link href={`/coach/clientes/${id}/plan-alimentaire/${p.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent">
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[15px] font-medium">{p.titre}</span>
                            <span className="text-[13px] text-texte-2">
                              {dateCourte.format(new Date(p.updated_at))} · {p.contenu.repas.length} repas · {nf.format(t.kcal)} kcal
                            </span>
                          </span>
                          {p.publie ? (
                            <Etiquette ton="vert">{p.vu_le ? "Publié · vu" : "Publié"}</Etiquette>
                          ) : (
                            <Etiquette ton="sable">Brouillon</Etiquette>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Carte>

            <Carte className="flex flex-col gap-3">
              <h2 className="font-titre text-xl font-bold">Nouveau plan</h2>
              <form action={creerPlanAlimentaire.bind(null, id)} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-texte-2">Partir de</span>
                  <select name="depuis" className="min-h-11 w-full min-w-0 rounded-xl border border-ligne bg-white px-3 text-[15px]">
                    <option value="">Un plan vide (repas de sa fiche)</option>
                    {(modeles ?? []).map((m) => {
                      const cl = (Array.isArray(m.clientes) ? m.clientes[0] : m.clientes) as { profils: { prenom: string; nom: string } | { prenom: string; nom: string }[] } | null;
                      const pr = cl ? (Array.isArray(cl.profils) ? cl.profils[0] : cl.profils) : null;
                      return (
                        <option key={m.id as string} value={m.id as string}>
                          Copie : {m.titre as string} — {pr ? `${pr.prenom} ${pr.nom}`.trim() : "?"} ({dateCourte.format(new Date(m.created_at as string))})
                        </option>
                      );
                    })}
                  </select>
                </label>
                <Bouton type="submit">
                  <IconePlus className="size-5" /> Créer le plan
                </Bouton>
                <p className="text-[12.5px] text-texte-2">
                  Les objectifs de ses besoins sont repris. Une copie garde les repas, aliments, notes et recommandations.
                </p>
              </form>
            </Carte>
          </div>
        </div>
      )}
    </div>
  );
}
