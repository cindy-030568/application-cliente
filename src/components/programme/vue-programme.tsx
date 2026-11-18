import Link from "next/link";
import { IconeVideo } from "@/components/icones";
import { Surtitre } from "@/components/ui";
import { cleExercice, volume, type Programme } from "@/lib/programme-sportif";

const dateFaite = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

/**
 * Affichage d'un programme sportif (cliente et aperçu coach).
 * `videos` : titre normalisé → id de vidéo ; `lienVideo` : préfixe du lien (null = pas de lien).
 */
export function VueProgramme({
  programme,
  videos = {},
  lienVideo = null,
  lienSeance,
  libelleSeance = "Commencer la séance",
  faites = {},
}: {
  programme: Programme;
  videos?: Record<string, string>;
  lienVideo?: string | null;
  /** Mode séance : lien vers la séance n° i (absent = pas de bouton). */
  lienSeance?: (i: number) => string;
  libelleSeance?: string;
  /** Séances déjà faites, par nom de séance. */
  faites?: Record<string, { nb: number; derniere: string }>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {(programme.duree || programme.frequence) && (
        <p className="text-[14.5px] text-texte-2">{[programme.duree, programme.frequence].filter(Boolean).join(" · ")}</p>
      )}

      {programme.seances.map((s, i) => (
        <details key={i} open={i === 0} className="group rounded-carte bg-blanc-casse shadow-douce">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 flex-col">
              <span className="font-titre text-xl font-bold leading-tight">{s.nom}</span>
              {(s.jour || s.duree) && <span className="text-[13.5px] text-texte-2">{[s.jour, s.duree].filter(Boolean).join(" · ")}</span>}
            </span>
            <span aria-hidden className="text-texte-2 transition-transform group-open:rotate-180">⌄</span>
          </summary>

          <div className="flex flex-col gap-4 px-4 pb-4">
            {lienSeance && (
              <div className="flex flex-col gap-1.5">
                <Link
                  href={lienSeance(i)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15.5px] font-medium text-white"
                >
                  ▶ {libelleSeance}
                </Link>
                {faites[s.nom] && (
                  <p className="text-center text-[13px] text-texte-2">
                    ✓ Faite {faites[s.nom].nb} fois · dernière fois le {dateFaite.format(new Date(faites[s.nom].derniere))}
                  </p>
                )}
              </div>
            )}
            {s.echauffement && <Encart titre="Échauffement">{s.echauffement}</Encart>}

            {s.blocs.map((b, j) => (
              <section key={j} className="flex flex-col gap-2">
                {(b.titre || b.format) && (
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {b.titre && <h3 className="text-[15.5px] font-semibold">{b.titre}</h3>}
                    {b.format && <span className="rounded-full bg-accent-pale px-2.5 py-0.5 text-[12.5px] font-medium">{b.format}</span>}
                  </div>
                )}
                <ul className="flex flex-col divide-y divide-ligne rounded-xl border border-ligne bg-white/60">
                  {b.exercices.map((e, k) => {
                    const v = volume(e);
                    const video = lienVideo ? videos[cleExercice(e.nom)] : undefined;
                    return (
                      <li key={k} className="flex flex-col gap-1 px-3 py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[15px] font-medium">{e.nom}</span>
                          {v && <span className="shrink-0 text-[14.5px] font-semibold tabular-nums">{v}</span>}
                        </div>
                        {(e.charge || e.repos || e.tempo) && (
                          <div className="flex flex-wrap gap-1.5 text-[12.5px]">
                            {e.charge && <span className="rounded-full bg-sable/70 px-2 py-0.5">{e.charge}</span>}
                            {e.repos && <span className="rounded-full bg-sable/70 px-2 py-0.5">Repos {e.repos}</span>}
                            {e.tempo && <span className="rounded-full bg-sable/70 px-2 py-0.5">Tempo {e.tempo}</span>}
                          </div>
                        )}
                        {e.consignes && <p className="text-[13.5px] text-texte-2">{e.consignes}</p>}
                        {video && (
                          <Link href={`${lienVideo}${video}`} className="inline-flex w-fit items-center gap-1.5 text-[13.5px] font-medium text-accent">
                            <IconeVideo className="size-4" /> Voir la vidéo
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {s.retour_au_calme && <Encart titre="Retour au calme">{s.retour_au_calme}</Encart>}
            {s.notes && <p className="whitespace-pre-line text-[14px] text-texte-2">{s.notes}</p>}
          </div>
        </details>
      ))}

      {programme.conseils && (
        <section className="flex flex-col gap-2 rounded-carte bg-blanc-casse p-4 shadow-douce">
          <Surtitre>Conseils</Surtitre>
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed">{programme.conseils}</p>
        </section>
      )}
    </div>
  );
}

function Encart({ titre, children }: { titre: string; children: string }) {
  return (
    <div className="rounded-xl bg-sable/50 px-3 py-2.5">
      <p className="text-[12.5px] font-medium uppercase tracking-wide text-caramel-texte">{titre}</p>
      <p className="whitespace-pre-line text-[14px]">{children}</p>
    </div>
  );
}
