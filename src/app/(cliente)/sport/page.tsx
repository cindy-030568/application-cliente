import type { Metadata } from "next";
import Link from "next/link";
import { IconeFleche, IconeVideo } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { VueProgramme } from "@/components/programme/vue-programme";
import { Etiquette, Surtitre } from "@/components/ui";
import { lireMonProgramme, videosParExercice } from "@/lib/programme-sportif-serveur";
import { EnTete } from "../composants";
import { PagePlan } from "../page-plan";
import { MarquerProgrammeVu } from "./marquer-vu";

export const metadata: Metadata = { title: "Sport" };

const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string; pdf?: string }> }) {
  const { version, pdf } = await searchParams;
  const { supabase } = await exigerCliente();
  const { count } = await supabase.from("videos").select("id", { count: "exact", head: true });
  const nbVideos = count ?? 0;
  // Programme construit avec Claude (0016) : affiché en priorité. Sinon, les programmes PDF / liens comme avant.
  const programme = version || pdf ? null : await lireMonProgramme(supabase);
  const [videos, { count: nbPdf }] = programme
    ? await Promise.all([videosParExercice(supabase), supabase.from("plans").select("id", { count: "exact", head: true }).eq("type", "sport")])
    : [{}, { count: 0 }];
  return (
    <>
      {programme ? (
        <>
          <EnTete
            titre="Mon programme sportif"
            sousTitre={`${programme.titre} · mis à jour le ${dateLongue.format(new Date(programme.publie_le ?? programme.updated_at))}`}
          />
          {!programme.vu_le && <MarquerProgrammeVu programmeId={programme.id} />}
          <div className="flex flex-col gap-4 px-5 pt-3">
            {!programme.vu_le && (
              <div>
                <Etiquette>Nouveau</Etiquette>
              </div>
            )}
            <VueProgramme programme={programme.contenu} videos={videos} lienVideo="/sport/videos/" />
            {(nbPdf ?? 0) > 0 && (
              <Link href="/sport?pdf=1" className="text-center text-[14px] text-texte-2 underline underline-offset-4">
                Voir mes anciens programmes en PDF
              </Link>
            )}
          </div>
        </>
      ) : (
        <PagePlan type="sport" version={version} />
      )}
      <section id="videos" className="mx-5 mt-8 flex scroll-mt-6 flex-col gap-3">
        <Surtitre>Vidéos d’exercices</Surtitre>
        <Link
          href="/sport/videos"
          className="flex items-center gap-4 rounded-carte bg-chocolat p-5 text-creme transition-transform active:scale-[0.98]"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-carte-sombre text-caramel-clair">
            <IconeVideo className="size-6" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-titre text-lg font-bold">La bibliothèque</span>
            <span className="text-[14px] text-texte-clair">
              {nbVideos > 0
                ? `${nbVideos} exercice${nbVideos > 1 ? "s" : ""} expliqué${nbVideos > 1 ? "s" : ""} en vidéo`
                : "Bientôt disponible"}
            </span>
          </span>
          <IconeFleche className="size-5 shrink-0" />
        </Link>
      </section>
    </>
  );
}
