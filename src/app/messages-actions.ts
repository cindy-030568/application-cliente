"use server";

import { lireSession } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La cliente a vu les petits mots de sa coach sur son accueil. */
export async function marquerMessagesLus(ids: string[]): Promise<void> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach") return;
  for (const id of ids.slice(0, 10)) if (UUID.test(id)) await session.supabase.rpc("message_cliente_lu", { p_message: id });
}
