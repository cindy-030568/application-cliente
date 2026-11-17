import type { Metadata } from "next";
import { exigerCliente } from "@/lib/auth";
import { lireMonPlanAlimentaire } from "@/lib/plan-alimentaire-serveur";
import { PagePlan } from "../page-plan";
import { VuePlanAlimentaire } from "./vue-plan";

export const metadata: Metadata = { title: "Nutrition" };

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string; pdf?: string }> }) {
  const { version, pdf } = await searchParams;
  // Plan construit dans l'app (0015) : affiché en priorité. Sinon, les plans PDF / liens comme avant.
  if (!version && !pdf) {
    const { supabase, profil } = await exigerCliente();
    const plan = await lireMonPlanAlimentaire(supabase);
    if (plan) {
      const [{ data: c }, { count }] = await Promise.all([
        supabase.from("clientes").select("mode_sans_chiffres").eq("id", profil.id).maybeSingle<{ mode_sans_chiffres: boolean }>(),
        supabase.from("plans").select("id", { count: "exact", head: true }).eq("type", "nutrition"),
      ]);
      return <VuePlanAlimentaire plan={plan} sansChiffres={c?.mode_sans_chiffres ?? false} plansPdf={(count ?? 0) > 0} />;
    }
  }
  return <PagePlan type="nutrition" version={version} />;
}
