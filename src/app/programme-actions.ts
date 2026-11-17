"use server";

import { lireSession } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La cliente a ouvert son programme sportif (la coach voit « vu le … »). */
export async function marquerProgrammeVu(programmeId: string): Promise<void> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach" || !UUID.test(programmeId)) return;
  await session.supabase.rpc("programme_sportif_vu", { p_programme: programmeId });
}
