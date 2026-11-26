import type { Metadata } from "next";
import Link from "next/link";
import { IconeFleche, IconeVideo } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import { VueProgramme } from "@/components/programme/vue-programme";
import { Etiquette, Surtitre } from "@/components/ui";
import { activerProgrammesPlanifies, lireMonProgramme, videosParExercice } from "@/lib/programme-sportif-serveur";
import { aujourdhuiParis, formaterDate, joursEntre } from "@/lib/bilan";
import { ANNONCE_JOURS, semaineProgramme } from "@/lib/programme-sportif";
import { resumeSeancesFaites } from "@/lib/seance-guidee";
import { lireSeancesFaites } from "@/lib/seances-faites-serveur";
import { EnTete } from "../composants";
import { PagePlan } from "../page-plan";
import { MarquerProgrammeVu } from "./marquer-vu";
import { PreparerHorsConnexion } from "@/components/hors-connexion";

export const metadata: Metadata = { title: "Sport" };

const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

export default async function Page({ searchParams }: { searchParams: Promise<{ version?: string; pdf?: string }> }) {
  const { version, pdf } = await searchParams;
  const { supabase, profil } = await exigerCliente();
  const { count } = await supabase.from("videos").select("id", { count: "exact", head: true });
  const nbVideos = count ?? 0;
  // Son programme planifié passe en ligne dès sa date, même avant la tâche du matin.
  if (!version && !pdf) await activerProgrammesPlanifies(supabase);
  // Programme construit avec Claude (0016) : affiché en priorité. Sinon, les programmes PDF / liens comme avant.
  const programme = version || pdf ? null : await lireMonProgramme(supabase);
  const { data: prochain } = programme ? await supabase.rpc("ma_prochaine_bascule") : { data: null };
  const auj = aujourdhuiParis();
  const dansJours = typeof prochain === "string" ? joursEntre(auj, prochain) : null;
  const [videos, { count: nbPdf }, faites] = programme
    ? await Promise.all([
        videosParExercice(supabase),
        supabase.from("plans").select("id", { count: "exact", head: true }).eq("type", "sport"),
        lireSeancesFaites(supabase, { programmeId: programme.id, limite: 200 }),
      ])
    : [{}, { count: 0 }, null];
  const semaine = programme ? semaineProgramme(programme.publie_le, programme.renouveler_le, auj) : null;
  // Séances express (0040) : seulement si elle en a.
  const { count: nbExpress } = await supabase.from("seances_express").select("id", { count: "exact", head: true });
  return (
    <>
      {programme ? (
        <>
          <EnTete
            titre="Mon programme sportif"
            sousTitre={`${programme.titre} · mis à jour le ${dateLongue.format(new Date(programme.publie_le ?? programme.updated_at))}`}
          />
          {!programme.vu_le && <MarquerProgrammeVu programmeId={programme.id} />}
          <PreparerHorsConnexion
            proprietaire={profil.id}
            nbSeances={programme.contenu.seances.length}
            version={`${programme.id}:${programme.updated_at ?? ""}:${programme.publie_le ?? ""}`}
          />
          <div className="flex flex-col gap-4 px-5 pt-3">
            {(!programme.vu_le || semaine) && (
              <div className="flex flex-wrap items-center gap-2">
                {!programme.vu_le && <Etiquette>Nouveau</Etiquette>}
                {semaine &&
                  (semaine.semaine <= semaine.total ? (
                    <Etiquette ton="sable">
                      Semaine {semaine.semaine} sur {semaine.total}
                    </Etiquette>
                  ) : (
                    <Etiquette ton="sable">Ton prochain programme arrive bientôt 💪</Etiquette>
                  ))}
              </div>
            )}
            {dansJours !== null && dansJours >= 1 && dansJours <= ANNONCE_JOURS && (
              <div className="rounded-carte bg-chocolat p-4 text-creme">
                <p className="font-titre text-lg font-bold">Ton nouveau programme arrive {dansJours === 1 ? "demain" : `dans ${dansJours} jours`} 🗓️</p>
                <p className="text-[14px] text-texte-clair">
                  Il s’affichera ici le {formaterDate(prochain as string, { weekday: "long", year: undefined })}. Termine bien celui-ci, tu y es presque 💪
                </p>
              </div>
            )}
            <VueProgramme
              programme={programme.contenu}
              videos={videos}
              lienVideo="/sport/videos/"
              lienSeance={(i) => `/seance/${i}`}
              faites={resumeSeancesFaites(faites ?? [])}
            />
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
      {(nbExpress ?? 0) > 0 && (
        <Link
          href="/seances-express"
          className="mx-5 mt-6 flex items-center justify-between gap-3 rounded-carte border border-dashed border-caramel-clair px-4 py-3 text-[14.5px]"
        >
          <span>
            <span className="font-medium">Pas le temps aujourd’hui ?</span>{" "}
            <span className="text-texte-2">Pas de salle, en déplacement ? Fais une séance express de 5 à 30 min ⚡</span>
          </span>
          <IconeFleche className="size-4 shrink-0 text-texte-2" />
        </Link>
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
