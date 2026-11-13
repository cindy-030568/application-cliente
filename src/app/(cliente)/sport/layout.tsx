import { redirect } from "next/navigation";
import { exigerCliente } from "@/lib/auth";
import { lireSuiviSport } from "@/lib/paiements-serveur";

/** Sans suivi sportif dans sa formule, la partie Sport n'est pas accessible. */
export default async function LayoutSport({ children }: { children: React.ReactNode }) {
  const { supabase, profil } = await exigerCliente();
  if (!(await lireSuiviSport(supabase, profil.id))) redirect("/");
  return children;
}
