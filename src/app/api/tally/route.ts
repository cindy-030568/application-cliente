import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifierCoach } from "@/lib/notifications-coach";
import { lireReponseTally, signatureTallyValide } from "@/lib/tally";

/**
 * Webhook Tally : chaque réponse au formulaire d'inscription crée une demande « à valider »
 * (Clientes → Fiches à valider). Rien n'est envoyé à la personne : la coach vérifie, puis invite.
 * Protégé par la signature Tally (variable TALLY_SIGNING_SECRET). Aucune donnée personnelle
 * dans les logs ni dans la réponse.
 */
export async function POST(request: Request) {
  const secret = process.env.TALLY_SIGNING_SECRET;
  if (!secret) return Response.json({ erreur: "webhook non configuré" }, { status: 503 });
  const corps = await request.text();
  if (corps.length > 500_000) return Response.json({ erreur: "trop volumineux" }, { status: 413 });
  if (!signatureTallyValide(corps, request.headers.get("tally-signature"), secret)) {
    return Response.json({ erreur: "signature invalide" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(corps);
  } catch {
    return Response.json({ erreur: "contenu illisible" }, { status: 400 });
  }
  if ((payload as { eventType?: string })?.eventType !== "FORM_RESPONSE") return Response.json({ ignore: true });

  try {
    const admin = createAdminClient();
    const { data: categories } = await admin.from("categories_aliment").select("id, nom");
    const lue = lireReponseTally(payload, (categories ?? []) as { id: string; nom: string }[]);
    if ("erreur" in lue) return Response.json({ erreur: lue.erreur }, { status: 422 });

    // Déjà enregistrée (Tally renvoie parfois la même réponse) : rien à faire.
    if (lue.reference) {
      const { data: deja } = await admin.from("demandes_inscription").select("id").eq("reference", lue.reference).maybeSingle();
      if (deja) return Response.json({ ok: true, deja: true });
    }
    // Un compte existe déjà avec cet email (cliente actuelle ou ancienne) : on le signale à la coach.
    const { data: compte } = await admin.from("profils").select("id").ilike("email", lue.email.replace(/[%_\\]/g, "\\$&")).maybeSingle();
    const ligne = {
      reference: lue.reference,
      prenom: lue.prenom,
      nom: lue.nom,
      email: lue.email,
      objectif: lue.objectif,
      objectif_code: lue.objectifCode,
      exclusions_texte: lue.exclusionsTexte,
      categories_exclues: lue.categoriesExclues,
      reponses: lue.reponses,
      doublon_de: (compte?.id as string | undefined) ?? null,
      recue_le: new Date().toISOString(),
    };
    // Parrainage (0039) : la marraine est retrouvée grâce à son code (rien avant la mise à jour).
    let parrainage: { code_parrainage: string; marraine_id: string | null } | null = null;
    let marraine = "";
    if (lue.codeParrainage) {
      const { data: m, error: sans0039 } = await admin
        .from("clientes")
        .select("id, profils!inner(prenom)")
        .eq("code_parrainage", lue.codeParrainage)
        .maybeSingle<{ id: string; profils: { prenom: string } }>();
      if (!sans0039) {
        parrainage = { code_parrainage: lue.codeParrainage, marraine_id: m?.id ?? null };
        marraine = m?.profils.prenom ?? "";
      }
    }
    // Même email déjà « à valider » : on met à jour cette demande au lieu d'en créer une 2e.
    const { data: enAttente } = await admin
      .from("demandes_inscription")
      .select("id")
      .eq("statut", "a_valider")
      .ilike("email", lue.email.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    const complete = parrainage ? { ...ligne, ...parrainage } : ligne;
    const { error } = enAttente
      ? await admin.from("demandes_inscription").update(complete).eq("id", enAttente.id)
      : await admin.from("demandes_inscription").insert(complete);
    if (error) {
      console.error("Tally : demande non enregistrée", error.code);
      return Response.json({ erreur: "non enregistrée" }, { status: 500 });
    }
    const prenom = lue.prenom;
    after(() => notifierCoach({ type: "inscription", prenom, marraine }));
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Tally : échec", e instanceof Error ? e.message.slice(0, 120) : "erreur inconnue");
    return Response.json({ erreur: "échec" }, { status: 500 });
  }
}
