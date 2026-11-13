import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { configurationRappels, envoyerPush, type AbonnementPush } from "@/lib/envoi-rappels";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAR_PAGE,
  notificationPermise,
  regrouperReactions,
  type MessageCommunaute,
} from "@/lib/communaute";

export type EtatCommunaute = { ouverte: boolean; charte: string };
export type Membre = {
  cliente_id: string;
  statut: "membre" | "exclue";
  notifications: boolean;
  dernier_vu: string;
  charte_acceptee_le: string;
};

/** Réglages de la communauté, ou null si la mise à jour de la base (0009) n'a pas encore été faite. */
export async function lireEtatCommunaute(supabase: SupabaseClient): Promise<EtatCommunaute | null> {
  const { data, error } = await supabase
    .from("reglages")
    .select("communaute_ouverte, communaute_charte")
    .maybeSingle<{ communaute_ouverte: boolean; communaute_charte: string }>();
  if (error || !data) return null;
  return { ouverte: data.communaute_ouverte, charte: data.communaute_charte };
}

export async function lireMembre(supabase: SupabaseClient, clienteId: string): Promise<Membre | null> {
  const { data } = await supabase
    .from("membres_communaute")
    .select("cliente_id, statut, notifications, dernier_vu, charte_acceptee_le")
    .eq("cliente_id", clienteId)
    .maybeSingle<Membre>();
  return data ?? null;
}

/** Nombre de messages des autres depuis la dernière visite (0 si rien ou si erreur). */
export async function compterNonLus(supabase: SupabaseClient, moi: string, depuis: string) {
  const { count } = await supabase
    .from("messages_communaute")
    .select("id", { count: "exact", head: true })
    .gt("created_at", depuis)
    .neq("auteur_id", moi);
  return count ?? 0;
}

type LigneMessage = {
  id: string;
  auteur_id: string;
  auteur_prenom: string;
  auteur_coach: boolean;
  texte: string;
  photo_path: string | null;
  epingle: boolean;
  created_at: string;
};
const COLONNES = "id, auteur_id, auteur_prenom, auteur_coach, texte, photo_path, epingle, created_at";

/**
 * Une page du fil (les plus récents d'abord). Sans `avant`, les messages épinglés
 * sont ajoutés en plus. Les photos sont servies par des liens temporaires (15 min).
 */
export async function chargerMessages(
  supabase: SupabaseClient,
  moi: string,
  o: { avant?: string | null; limite?: number } = {},
): Promise<{ messages: MessageCommunaute[]; encore: boolean }> {
  const limite = Math.min(Math.max(o.limite ?? PAR_PAGE, 1), 120);
  let requete = supabase.from("messages_communaute").select(COLONNES).order("created_at", { ascending: false }).limit(limite + 1);
  if (o.avant) requete = requete.lt("created_at", o.avant);
  const [{ data: page }, { data: epingles }] = await Promise.all([
    requete.returns<LigneMessage[]>(),
    o.avant
      ? Promise.resolve({ data: [] as LigneMessage[] })
      : supabase.from("messages_communaute").select(COLONNES).eq("epingle", true).order("created_at", { ascending: false }).limit(10).returns<LigneMessage[]>(),
  ]);
  const encore = (page?.length ?? 0) > limite;
  const lignes = new Map<string, LigneMessage>();
  for (const l of [...(epingles ?? []), ...(page ?? []).slice(0, limite)]) lignes.set(l.id, l);
  const ids = [...lignes.keys()];
  if (!ids.length) return { messages: [], encore: false };

  const chemins = [...lignes.values()].map((l) => l.photo_path).filter((c): c is string => Boolean(c));
  const [{ data: reactions }, liens] = await Promise.all([
    supabase.from("reactions_communaute").select("message_id, auteur_id, emoji").in("message_id", ids),
    chemins.length
      ? supabase.storage.from("communaute").createSignedUrls(chemins, 900)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const urls = new Map((liens.data ?? []).filter((l) => l.path && l.signedUrl).map((l) => [l.path as string, l.signedUrl]));
  const parMessage = regrouperReactions(reactions ?? [], moi);

  const messages = [...lignes.values()].map<MessageCommunaute>((l) => ({
    id: l.id,
    auteurId: l.auteur_id,
    prenom: l.auteur_prenom,
    coach: l.auteur_coach,
    texte: l.texte,
    photo: l.photo_path ? (urls.get(l.photo_path) ?? null) : null,
    epingle: l.epingle,
    creeLe: l.created_at,
    reactions: parMessage.get(l.id)?.reactions ?? { coeur: 0, bravo: 0, force: 0, rire: 0 },
    miennes: parMessage.get(l.id)?.miennes ?? [],
  }));
  return { messages, encore };
}

/**
 * Prévient les membres qui l'ont demandé (au plus une notification par heure chacune).
 * Le contenu du message n'apparaît jamais dans la notification.
 * Utilise la clé secrète : la liste des membres n'est pas lisible par les clientes.
 */
export async function notifierMembres(auteurId: string) {
  if (!configurationRappels().push || !process.env.SUPABASE_SECRET_KEY) return;
  try {
    const admin = createAdminClient();
    const etat = await lireEtatCommunaute(admin);
    if (!etat?.ouverte) return;
    const { data: membres } = await admin
      .from("membres_communaute")
      .select("cliente_id, notifications, derniere_notif, dernier_vu, clientes!inner(statut)")
      .eq("statut", "membre")
      .eq("notifications", true)
      .neq("clientes.statut", "fermee")
      .neq("cliente_id", auteurId);
    const maintenant = new Date();
    const cibles = (membres ?? []).filter((m) => notificationPermise(m, maintenant)).map((m) => m.cliente_id as string);
    if (!cibles.length) return;
    const { data: appareils } = await admin
      .from("abonnements_push")
      .select("id, cliente_id, endpoint, p256dh, auth")
      .in("cliente_id", cibles)
      .returns<(AbonnementPush & { cliente_id: string })[]>();
    const prevenues = new Set<string>();
    for (const a of appareils ?? []) {
      const r = await envoyerPush(a, {
        titre: "Communauté fitw_cindy",
        texte: "Il y a du nouveau dans la communauté 💬",
        url: "/communaute",
      });
      if (r === "ok") prevenues.add(a.cliente_id);
      else if (r === "expire") await admin.from("abonnements_push").delete().eq("id", a.id);
    }
    if (prevenues.size) {
      await admin
        .from("membres_communaute")
        .update({ derniere_notif: maintenant.toISOString() })
        .in("cliente_id", [...prevenues]);
    }
  } catch (e) {
    console.warn("Communauté : notifications non envoyées", e instanceof Error ? e.message.slice(0, 120) : "");
  }
}
