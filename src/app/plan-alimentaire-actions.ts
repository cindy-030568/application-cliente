"use server";

import { lireSession } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La cliente a ouvert son plan alimentaire (la coach voit « vu le … »). */
export async function marquerPlanAlimentaireVu(planId: string): Promise<void> {
  const session = await lireSession();
  if (!session || session.profil.role === "coach" || !UUID.test(planId)) return;
  await session.supabase.rpc("plan_alimentaire_vu", { p_plan: planId });
}
