import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { exigerCoach } from "@/lib/auth";
import { lireBesoins, lirePlanAlimentaire, objectifsDepuis } from "@/lib/plan-alimentaire-serveur";
import { EditeurPlan } from "./editeur";

export const metadata: Metadata = { title: "Plan alimentaire" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

export default async function PageEditeurPlan({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await params;
  if (!UUID.test(id) || !UUID.test(planId)) notFound();
  const { supabase } = await exigerCoach();
  const [plan, besoins, { data: c }] = await Promise.all([
    lirePlanAlimentaire(supabase, planId),
    lireBesoins(supabase, id),
    supabase.from("clientes").select("profils!inner(prenom)").eq("id", id).maybeSingle<{ profils: { prenom: string } }>(),
  ]);
  if (!plan || plan.cliente_id !== id || !c) notFound();

  const info = plan.publie
    ? `Publié le ${dateCourte.format(new Date(plan.publie_le ?? plan.updated_at))}${plan.vu_le ? ` · vu le ${dateCourte.format(new Date(plan.vu_le))}` : " · pas encore vu"}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/coach/clientes/${id}/plan-alimentaire`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Plans et besoins de {c.profils.prenom}
      </Link>
      <EditeurPlan
        clienteId={id}
        planId={planId}
        prenom={c.profils.prenom}
        titre={plan.titre}
        contenu={plan.contenu}
        recommandations={plan.recommandations}
        publie={plan.publie}
        infoPublication={info}
        objectifsBesoins={besoins ? objectifsDepuis(besoins.besoins) : null}
      />
    </div>
  );
}
