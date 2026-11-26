import { BoutonDeconnexion } from "@/components/hors-connexion";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo, classesBouton } from "@/components/ui";
import { MOIS_CONSERVATION } from "@/lib/abonnement";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { lireSession } from "@/lib/auth";
import { formaterDate } from "@/lib/bilan";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Accès fermé" };

export default async function PageAccesFerme() {
  // Une ancienne abonnée : elle peut reprendre son abonnement et retrouver tout (données gardées 6 mois).
  const session = await lireSession();
  let abonnee: { ferme_le: string | null } | null = null;
  if (session) {
    const { data } = await session.supabase.from("clientes").select("formule, ferme_le").eq("id", session.profil.id).maybeSingle<{ formule: string; ferme_le: string | null }>();
    if (data?.formule === "abonnement") abonnee = { ferme_le: data.ferme_le };
  }
  const offre = abonnee ? await lireReglagesAbonnement(createAdminClient()).catch(() => null) : null;
  const finConservation = (() => {
    if (!abonnee?.ferme_le) return null;
    const [a, m, j] = abonnee.ferme_le.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1 + MOIS_CONSERVATION, j)).toISOString().slice(0, 10);
  })();

  return (
    <main className="pt-encoche flex min-h-dvh items-center justify-center px-6 pb-10">
      <div className="flex w-full max-w-sm flex-col gap-6 apparition">
        <Logo className="text-2xl" />
        {abonnee ? (
          <>
            <h1 className="font-titre text-[30px] font-bold leading-tight">Ton abonnement est terminé</h1>
            <p className="text-texte-2">
              Merci pour ce bout de chemin ensemble 💛 Tes données (journal, favoris, planning) sont gardées
              {finConservation ? ` jusqu’au ${formaterDate(finConservation)}` : " pendant 6 mois"} : si tu reviens d’ici là, tu retrouves tout.
            </p>
            {offre?.actif && (
              <Link href="/abonnement" className={classesBouton("principal", true)}>
                Reprendre mon abonnement
              </Link>
            )}
          </>
        ) : (
          <>
            <h1 className="font-titre text-[30px] font-bold leading-tight">Ton espace est fermé</h1>
            <p className="text-texte-2">
              Ton accès à l’app n’est plus actif. Si tu penses que c’est une erreur, ou si tu veux
              reprendre un accompagnement, écris-moi directement : je serai ravie d’avoir de tes
              nouvelles.
            </p>
          </>
        )}
        <BoutonDeconnexion className="underline underline-offset-4">Me déconnecter</BoutonDeconnexion>
      </div>
    </main>
  );
}
