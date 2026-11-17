import { NextResponse } from "next/server";
import { lireSession } from "@/lib/auth";
import { genererPdfPlan } from "@/lib/plan-alimentaire-pdf";
import { lirePlanAlimentaire } from "@/lib/plan-alimentaire-serveur";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

/**
 * PDF du plan alimentaire. La sécurité de la base décide : la coach voit tous les plans,
 * la cliente seulement son plan publié (et si son accès est ouvert).
 */
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await lireSession();
  if (!session) return new NextResponse("Accès refusé", { status: 403 });
  if (!UUID.test(id)) return new NextResponse("Introuvable", { status: 404 });
  const plan = await lirePlanAlimentaire(session.supabase, id);
  if (!plan) return new NextResponse("Introuvable", { status: 404 });

  const { data: c } = await session.supabase
    .from("clientes")
    .select("mode_sans_chiffres, profils!inner(prenom)")
    .eq("id", plan.cliente_id)
    .maybeSingle<{ mode_sans_chiffres: boolean; profils: { prenom: string } }>();

  const pdf = await genererPdfPlan({
    titre: plan.titre,
    prenom: c?.profils.prenom ?? session.profil.prenom ?? "",
    contenu: plan.contenu,
    recommandations: plan.recommandations,
    sansChiffres: c?.mode_sans_chiffres ?? false,
    date: dateLongue.format(new Date(plan.publie_le ?? plan.updated_at)),
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="plan-alimentaire.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
