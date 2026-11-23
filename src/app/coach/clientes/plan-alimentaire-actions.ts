"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rechercherAliments } from "@/lib/aliments";
import { envoyerPushCliente } from "@/lib/envoi-rappels";
import { nomIngredient } from "@/lib/noms-aliments";
import { lireContenu, heureParDefaut, type AlimentPlan, type ContenuPlan, type Formule, type Sexe } from "@/lib/plan-alimentaire";
import { lireBesoins, objectifsDepuis } from "@/lib/plan-alimentaire-serveur";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_PERDUE, UUID, sessionCoach, verifierCliente } from "./verification";

export type EtatPlanAlim = { erreur?: string; succes?: string };

const MIGRATION = "Fais d’abord la mise à jour de la base : fichier 0015_plan_alimentaire.sql (voir le guide).";

function rafraichir(clienteId: string, planId?: string) {
  revalidatePath(`/coach/clientes/${clienteId}`);
  revalidatePath(`/coach/clientes/${clienteId}/plan-alimentaire`);
  if (planId) revalidatePath(`/coach/clientes/${clienteId}/plan-alimentaire/${planId}`);
  revalidatePath("/nutrition");
}

// ---------------------------------------------------------------- Besoins

const nombre = (v: FormDataEntryValue | null, min: number, max: number): number | null => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
};

export async function enregistrerBesoins(clienteId: string, _e: EtatPlanAlim, formData: FormData): Promise<EtatPlanAlim> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };

  const champs = {
    taille_cm: nombre(formData.get("taille_cm"), 100, 230),
    poids_kg: nombre(formData.get("poids_kg"), 25, 350),
    poids_objectif_kg: nombre(formData.get("poids_objectif_kg"), 25, 350),
    masse_grasse_pct: nombre(formData.get("masse_grasse_pct"), 3, 70),
    nap_actuel: nombre(formData.get("nap_actuel"), 1, 2.5),
    nap_objectif: nombre(formData.get("nap_objectif"), 1, 2.5),
    kcal_objectif: nombre(formData.get("kcal_objectif"), 800, 6000),
    pct_lipides: nombre(formData.get("pct_lipides"), 0, 100),
    pct_glucides: nombre(formData.get("pct_glucides"), 0, 100),
    pct_proteines: nombre(formData.get("pct_proteines"), 0, 100),
    fibres_g: nombre(formData.get("fibres_g"), 0, 100),
  };
  const libelles: Record<string, string> = {
    taille_cm: "la taille (100 à 230 cm)",
    poids_kg: "le poids actuel",
    poids_objectif_kg: "le poids objectif",
    masse_grasse_pct: "la masse grasse (3 à 70 %)",
    nap_actuel: "le niveau d’activité actuel (1 à 2,5)",
    nap_objectif: "le niveau d’activité objectif (1 à 2,5)",
    kcal_objectif: "l’objectif calorique (800 à 6000 kcal)",
    pct_lipides: "le % de lipides",
    pct_glucides: "le % de glucides",
    pct_proteines: "le % de protéines",
    fibres_g: "les fibres (0 à 100 g)",
  };
  const invalide = Object.entries(champs).find(([, x]) => Number.isNaN(x));
  if (invalide) return { erreur: `Vérifie ${libelles[invalide[0]]}.` };
  const pct = [champs.pct_lipides, champs.pct_glucides, champs.pct_proteines].map((x) => Math.round(x ?? 0));
  if (pct[0] + pct[1] + pct[2] !== 100) return { erreur: "Lipides + glucides + protéines doivent faire 100 %." };

  const sexe = (formData.get("sexe") === "homme" ? "homme" : "femme") as Sexe;
  const formule = (["black", "mifflin", "harris"].includes(String(formData.get("formule"))) ? formData.get("formule") : "black") as Formule;
  const naissance = String(formData.get("date_naissance") ?? "");
  const date_naissance = /^\d{4}-\d{2}-\d{2}$/.test(naissance) && naissance > "1900-01-01" ? naissance : null;

  const { error } = await v.supabase.from("besoins_clientes").upsert({
    cliente_id: clienteId,
    sexe,
    formule,
    date_naissance,
    taille_cm: champs.taille_cm,
    poids_kg: champs.poids_kg,
    poids_objectif_kg: champs.poids_objectif_kg,
    masse_grasse_pct: champs.masse_grasse_pct,
    nap_actuel: champs.nap_actuel ?? 1.4,
    nap_objectif: champs.nap_objectif ?? 1.6,
    kcal_objectif: champs.kcal_objectif == null ? null : Math.round(champs.kcal_objectif),
    pct_lipides: pct[0],
    pct_glucides: pct[1],
    pct_proteines: pct[2],
    fibres_g: Math.round(champs.fibres_g ?? 30),
    updated_at: new Date().toISOString(),
  });
  if (error) return { erreur: ["42P01", "PGRST205"].includes(error.code) ? MIGRATION : "Les besoins n’ont pas pu être enregistrés. Réessaie." };
  // Apport actuel et objectif (mise à jour 0022) : enregistrés à part, ignorés si la base n'est pas à jour.
  const kcalActuelles = nombre(formData.get("kcal_actuelles"), 400, 6000);
  const objectif = String(formData.get("objectif") ?? "");
  if (Number.isNaN(kcalActuelles)) return { erreur: "Vérifie ce qu’elle mange aujourd’hui (400 à 6000 kcal), ou laisse vide." };
  await v.supabase
    .from("besoins_clientes")
    .update({
      kcal_actuelles: kcalActuelles == null ? null : Math.round(kcalActuelles),
      objectif: ["perte", "maintien", "prise", "recompo"].includes(objectif) ? objectif : null,
    })
    .eq("cliente_id", clienteId);
  rafraichir(clienteId);
  revalidatePath(`/coach/clientes/${clienteId}/analyse`);
  return { succes: "Besoins enregistrés." };
}

// ---------------------------------------------------------------- Recherche d'aliments

export type ResultatAliment = { aliment: AlimentPlan; nomComplet: string };

/** Recherche pour le plan : valeurs pour 100 g, nom simplifié, fibres si connues. */
export async function chercherAlimentsPlan(q: string): Promise<ResultatAliment[]> {
  const session = await sessionCoach();
  if (!session || q.trim().length < 2) return [];
  const trouves = await rechercherAliments(session.supabase, q, { limite: 20, actifsSeulement: true });
  const fibres = new Map<string, number | null>();
  if (trouves.length) {
    const { data, error } = await session.supabase.from("aliments").select("id, fibres_100").in("id", trouves.map((a) => a.id));
    if (!error) for (const d of data ?? []) fibres.set(d.id as string, d.fibres_100 == null ? null : Number(d.fibres_100));
  }
  return trouves.map((a) => ({
    nomComplet: a.nom,
    aliment: {
      id: a.id,
      nom: nomIngredient(a.nom),
      p: Number(a.proteines_100),
      g: Number(a.glucides_100),
      l: Number(a.lipides_100),
      k: Number(a.kcal_100),
      f: fibres.get(a.id) ?? null,
      nom_unite: a.nom_unite,
      poids_unite_g: a.poids_unite_g == null ? null : Number(a.poids_unite_g),
    },
  }));
}

// ---------------------------------------------------------------- Plans

/** Crée un plan (vide avec les repas de la fiche, ou copie d'un plan existant) et ouvre l'éditeur. */
export async function creerPlanAlimentaire(clienteId: string, formData: FormData): Promise<void> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) redirect(`/coach/clientes/${clienteId}/plan-alimentaire?erreur=session`);
  const { supabase } = v;
  const depuis = String(formData.get("depuis") ?? "");

  const besoins = await lireBesoins(supabase, clienteId);
  if (!besoins) redirect(`/coach/clientes/${clienteId}/plan-alimentaire?erreur=migration`);
  const objectifs = objectifsDepuis(besoins.besoins);

  let contenu: ContenuPlan;
  let recommandations = "";
  let titre = "Plan alimentaire";
  if (UUID.test(depuis)) {
    const { data } = await supabase.from("plans_alimentaires").select("titre, contenu, recommandations").eq("id", depuis).maybeSingle();
    if (!data) redirect(`/coach/clientes/${clienteId}/plan-alimentaire?erreur=copie`);
    contenu = { ...lireContenu(data.contenu), objectifs };
    recommandations = (data.recommandations as string) ?? "";
    titre = (data.titre as string) || titre;
  } else {
    const { data: repas } = await supabase.from("repas_cibles").select("libelle").eq("cliente_id", clienteId).order("ordre");
    const libelles = (repas ?? []).map((r) => r.libelle as string);
    contenu = {
      objectifs,
      repas: (libelles.length ? libelles : ["Petit-déjeuner", "Déjeuner", "Goûter", "Dîner"]).map((libelle) => ({
        libelle,
        heure: heureParDefaut(libelle),
        lignes: [],
        note: "",
      })),
    };
    // Les recommandations générales du dernier plan servent de point de départ.
    const { data: dernier } = await supabase
      .from("plans_alimentaires")
      .select("recommandations")
      .neq("recommandations", "")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    recommandations = (dernier?.recommandations as string) ?? "";
  }
  const { count } = await supabase.from("plans_alimentaires").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId);
  if (!UUID.test(depuis)) titre = `Plan alimentaire n°${(count ?? 0) + 1}`;

  const { data: cree, error } = await supabase
    .from("plans_alimentaires")
    .insert({ cliente_id: clienteId, titre: titre.slice(0, 80), contenu, recommandations })
    .select("id")
    .single();
  if (error || !cree) redirect(`/coach/clientes/${clienteId}/plan-alimentaire?erreur=creation`);
  rafraichir(clienteId);
  redirect(`/coach/clientes/${clienteId}/plan-alimentaire/${cree.id}`);
}

export async function enregistrerPlanAlimentaire(
  clienteId: string,
  planId: string,
  donnees: { titre: string; contenu: unknown; recommandations: string },
): Promise<EtatPlanAlim> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(planId)) return { erreur: "Plan introuvable." };
  const titre = String(donnees.titre ?? "").trim().slice(0, 80) || "Plan alimentaire";
  const contenu = lireContenu(donnees.contenu);
  const recommandations = String(donnees.recommandations ?? "").slice(0, 10000);
  const { data, error } = await v.supabase
    .from("plans_alimentaires")
    .update({ titre, contenu, recommandations, updated_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("cliente_id", clienteId)
    .select("id");
  if (error || !data?.length) return { erreur: "Le plan n’a pas pu être enregistré. Réessaie dans un instant." };
  rafraichir(clienteId, planId);
  return { succes: "Plan enregistré." };
}

export async function publierPlanAlimentaire(clienteId: string, planId: string, publie: boolean): Promise<EtatPlanAlim> {
  const v = await verifierCliente(clienteId);
  if (v.erreur) return { erreur: v.erreur };
  if (!UUID.test(planId)) return { erreur: "Plan introuvable." };
  const { error } = await v.supabase.rpc("publier_plan_alimentaire", { p_plan: planId, p_publie: publie });
  if (error) return { erreur: "Le plan n’a pas pu être publié. Réessaie dans un instant." };
  rafraichir(clienteId, planId);
  if (publie) {
    after(async () => {
      try {
        await envoyerPushCliente(createAdminClient(), clienteId, {
          titre: "Ton plan alimentaire est prêt 🍽️",
          texte: "Cindy vient de publier ton plan. Ouvre l’onglet Nutrition pour le découvrir.",
          url: "/nutrition",
        });
      } catch {
        // La publication reste valable même si la notification échoue.
      }
    });
  }
  return { succes: publie ? `Plan publié : ${v.prenom} le voit dans son onglet Nutrition.` : "Plan retiré : elle ne le voit plus." };
}

export async function supprimerPlanAlimentaire(clienteId: string, planId: string): Promise<EtatPlanAlim> {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE };
  if (!UUID.test(clienteId) || !UUID.test(planId)) return { erreur: "Plan introuvable." };
  const { error } = await session.supabase.from("plans_alimentaires").delete().eq("id", planId).eq("cliente_id", clienteId);
  if (error) return { erreur: "Le plan n’a pas pu être supprimé." };
  rafraichir(clienteId);
  redirect(`/coach/clientes/${clienteId}/plan-alimentaire`);
}
