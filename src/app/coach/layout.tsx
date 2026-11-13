import type { Metadata } from "next";
import Link from "next/link";
import { IconeDeconnexion } from "@/components/icones";
import { Logo } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { NavigationCoach } from "./navigation";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" } };

export default async function LayoutCoach({ children }: { children: React.ReactNode }) {
  const { supabase, profil } = await exigerCoach();
  const { data: recents } = await supabase
    .from("bilans")
    .select("saisi_par, retours_bilan(bilan_id), clientes!inner(statut)")
    .neq("clientes.statut", "fermee")
    .not("echeance", "is", null)
    .order("envoye_le", { ascending: false })
    .limit(300);
  const aTraiter = (recents ?? []).filter((b) => {
    const r = b.retours_bilan as unknown;
    return (Array.isArray(r) ? r.length === 0 : !r) && b.saisi_par !== profil.id;
  }).length;
  // Signalements non traités (0 si la mise à jour 0009 n'est pas encore faite).
  const { count: signalements } = await supabase
    .from("signalements_communaute")
    .select("message_id", { count: "exact", head: true })
    .eq("traite", false);
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ligne bg-blanc-casse/95 px-4 py-3 backdrop-blur md:h-dvh md:w-64 md:shrink-0 md:flex-col md:items-stretch md:justify-start md:gap-8 md:border-b-0 md:border-r md:px-4 md:py-6">
        <div className="flex flex-col gap-0.5 md:px-3">
          <Logo className="text-xl" />
          <span className="hidden font-main text-[19px] text-caramel-texte md:block">Espace coach</span>
        </div>
        <form action="/auth/deconnexion" method="post" className="md:hidden">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] text-texte-2 hover:text-chocolat"
          >
            <IconeDeconnexion className="size-4" /> Déconnexion
          </button>
        </form>
        <NavigationCoach aTraiter={aTraiter} signalements={signalements ?? 0} />
        <div className="hidden md:mt-auto md:flex md:flex-col md:gap-2 md:px-3">
          <p className="text-[13px] text-texte-2">Connectée : {profil.prenom || profil.email}</p>
          <Link href="/compte/mot-de-passe" className="text-[14px] text-texte-2 hover:text-chocolat">
            Mon mot de passe
          </Link>
          <form action="/auth/deconnexion" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 text-[14px] text-texte-2 hover:text-chocolat"
            >
              <IconeDeconnexion className="size-4" /> Déconnexion
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
