import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LecteurSeance } from "@/components/programme/lecteur-seance";
import { exigerCoach } from "@/lib/auth";
import { videosParExercice } from "@/lib/programme-sportif-serveur";
import { lireSeanceExpress } from "@/lib/seances-express-serveur";

export const metadata: Metadata = { title: "Aperçu du mode séance" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La coach teste la séance express telle que sa cliente la verra (rien n'est enregistré). */
export default async function ApercuSeanceExpress({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const s = await lireSeanceExpress(supabase, id);
  if (!s) notFound();
  const videos = await videosParExercice(supabase);
  return (
    <div className="mx-auto w-full max-w-lg rounded-carte bg-creme p-5 shadow-douce ring-1 ring-ligne">
      <p className="mb-3 rounded-xl bg-sable/60 px-3 py-2 text-[13px]">Aperçu : ta cliente voit exactement cet écran sur son téléphone.</p>
      <LecteurSeance seance={s.contenu} cle={`apercu-express:${s.id}`} retour={`/coach/seances-express/${s.id}`} videos={videos} lienVideo="/coach/videos/" />
    </div>
  );
}
