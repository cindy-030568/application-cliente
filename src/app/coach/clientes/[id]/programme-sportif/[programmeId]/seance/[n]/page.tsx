import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LecteurSeance } from "@/components/programme/lecteur-seance";
import { exigerCoach } from "@/lib/auth";
import { lireProgrammeSportif, videosParExercice } from "@/lib/programme-sportif-serveur";

export const metadata: Metadata = { title: "Aperçu du mode séance" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La coach teste le mode séance tel que sa cliente le verra (rien n'est enregistré). */
export default async function ApercuSeance({ params }: { params: Promise<{ id: string; programmeId: string; n: string }> }) {
  const { id, programmeId, n } = await params;
  if (!UUID.test(id) || !UUID.test(programmeId)) notFound();
  const { supabase } = await exigerCoach();
  const p = await lireProgrammeSportif(supabase, programmeId);
  const index = Number(n);
  const seance = p && p.cliente_id === id && Number.isInteger(index) ? p.contenu.seances[index] : undefined;
  if (!p || !seance) notFound();
  const videos = await videosParExercice(supabase);
  return (
    <div className="mx-auto w-full max-w-lg rounded-carte bg-creme p-5 shadow-douce ring-1 ring-ligne">
      <p className="mb-3 rounded-xl bg-sable/60 px-3 py-2 text-[13px]">Aperçu : ta cliente voit exactement cet écran sur son téléphone.</p>
      <LecteurSeance
        seance={seance}
        cle={`apercu:${p.id}:${index}`}
        retour={`/coach/clientes/${id}/programme-sportif/${p.id}`}
        videos={videos}
        lienVideo="/coach/videos/"
      />
    </div>
  );
}
