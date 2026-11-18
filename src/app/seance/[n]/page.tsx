import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LecteurSeance } from "@/components/programme/lecteur-seance";
import { exigerCliente } from "@/lib/auth";
import { cleExercice } from "@/lib/programme-sportif";
import { lireMonProgramme, videosParExercice } from "@/lib/programme-sportif-serveur";
import { regrouperCharges } from "@/lib/seance-guidee";
import { lireCharges } from "@/lib/seances-faites-serveur";
import { noterCharges, validerSeance } from "../../programme-actions";

export const metadata: Metadata = { title: "Ma séance" };

/** Mode séance : plein écran, sans la barre d'onglets. */
export default async function PageSeance({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const index = Number(n);
  const { supabase } = await exigerCliente();
  const programme = await lireMonProgramme(supabase);
  const seance = Number.isInteger(index) ? programme?.contenu.seances[index] : undefined;
  if (!programme || !seance) notFound();
  const cles = [...new Set(seance.blocs.flatMap((b) => b.exercices.map((e) => cleExercice(e.nom))))];
  // Poids notés les fois précédentes (rien avant la mise à jour 0021 : la séance marche quand même).
  const [videos, charges] = await Promise.all([videosParExercice(supabase), lireCharges(supabase, { cles })]);
  return (
    <main className="mx-auto w-full max-w-lg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <LecteurSeance
        seance={seance}
        cle={`${programme.id}:${index}`}
        retour="/sport"
        videos={videos}
        lienVideo="/sport/videos/"
        valider={validerSeance.bind(null, programme.id, index)}
        historique={regrouperCharges(charges ?? [])}
        noterCharges={noterCharges.bind(null, programme.id)}
      />
    </main>
  );
}
