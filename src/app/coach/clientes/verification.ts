import "server-only";
import { lireSession } from "@/lib/auth";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SESSION_PERDUE =
  "Action annulée : ce navigateur n’est plus connecté à ton espace coach (une connexion cliente l’a sans doute remplacé). Recharge la page et reconnecte-toi avec ton email. Rien n’a été modifié.";


/** Session coach, ou null (au lieu de rediriger : on affiche un message clair). */
export async function sessionCoach() {
  const session = await lireSession();
  return session && session.profil.role === "coach" ? session : null;
}

/** Vérifie la session coach et que l'identifiant désigne bien une cliente (jamais le compte coach). */
export async function verifierCliente(id: string) {
  const session = await sessionCoach();
  if (!session) return { erreur: SESSION_PERDUE } as const;
  if (!UUID.test(id)) return { erreur: "Cliente introuvable." } as const;
  const { data } = await session.supabase
    .from("clientes")
    .select("id, profils!inner(email, prenom)")
    .eq("id", id)
    .maybeSingle<{ id: string; profils: { email: string; prenom: string } }>();
  if (!data) return { erreur: "Cliente introuvable." } as const;
  return { ...session, email: data.profils.email, prenom: data.profils.prenom, erreur: undefined };
}
