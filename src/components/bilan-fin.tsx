import type { ReactNode } from "react";
import { ecartSigne, type Evolution } from "@/lib/bilan-fin";
import type { DonneesBilanFin } from "@/lib/bilan-fin-serveur";

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const date = (j: string) => dateLongue.format(new Date(`${j}T12:00:00Z`));
const kg = (n: number) => `${n.toLocaleString("fr-FR")} kg`;

/** Petite courbe (SVG) d'une mesure, du départ à aujourd'hui. */
function Courbe({ e }: { e: Evolution }) {
  const L = 240;
  const H = 64;
  const valeurs = e.points.map((p) => p.valeur);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const ecart = max - min || 1;
  const pts = e.points.map(
    (p, i) =>
      [
        8 + (i * (L - 16)) / Math.max(1, e.points.length - 1),
        8 + ((max - p.valeur) * (H - 16)) / ecart,
      ] as const,
  );
  return (
    <svg
      viewBox={`0 0 ${L} ${H}`}
      className="h-16 w-full"
      role="img"
      aria-label={`Courbe : ${e.libelle}`}
    >
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === 0 || i === pts.length - 1 ? 4.5 : 3}
          fill={i === pts.length - 1 ? "var(--accent)" : "var(--blanc-casse)"}
          stroke="var(--accent)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-titre text-[21px] font-bold leading-tight">
        {titre}
      </h2>
      {children}
    </section>
  );
}

/** Bilan de fin de suivi : sa transformation, à garder. Partagé entre la cliente et l'aperçu de la coach. */
export function VueBilanFin({
  d,
  photos,
  suite,
  lienPdf,
}: {
  d: DonneesBilanFin;
  photos: { avant: string; apres: string } | null;
  /** Bloc « continuer avec moi » (boutons côté cliente, aperçu côté coach). */
  suite: ReactNode;
  lienPdf: string | null;
}) {
  const p = d.prenom.trim();
  return (
    <div className="flex flex-col gap-7">
      <div className="relative overflow-hidden rounded-bloc bg-chocolat p-6 text-creme">
        <span
          aria-hidden
          className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/30 blur-2xl"
        />
        <div className="relative flex flex-col gap-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-clair">
            Ton bilan de fin de suivi
          </span>
          <h1 className="font-titre text-[30px] font-bold leading-tight">
            {p ? `${p}, regarde ton chemin` : "Regarde ton chemin"} 💛
          </h1>
          {d.debut && (
            <p className="text-[15px] text-texte-clair">
              Depuis le {date(d.debut)}
              {d.fin ? ` jusqu’au ${date(d.fin)}` : ""}
            </p>
          )}
          {lienPdf && (
            <a
              href={lienPdf}
              className="mt-2 inline-flex min-h-11 w-fit items-center rounded-full bg-accent px-5 text-[15px] font-medium text-white"
            >
              Télécharger mon bilan (PDF)
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-3 [&>*]:flex-1">
        {[
          [
            d.chiffres.seances,
            d.chiffres.seances > 1 ? "séances faites" : "séance faite",
          ],
          [
            d.chiffres.bilans,
            d.chiffres.bilans > 1 ? "bilans envoyés" : "bilan envoyé",
          ],
          [
            d.chiffres.joursJournal,
            d.chiffres.joursJournal > 1
              ? "jours de journal"
              : "jour de journal",
          ],
        ]
          .filter(([n]) => Number(n) > 0)
          .map(([n, libelle]) => (
            <div
              key={String(libelle)}
              className="flex flex-col items-center gap-1 rounded-carte bg-blanc-casse p-3 text-center shadow-douce"
            >
              <span className="font-titre text-[26px] font-bold tabular-nums">
                {n}
              </span>
              <span className="text-[12.5px] leading-tight text-texte-2">
                {libelle}
              </span>
            </div>
          ))}
      </div>

      {photos && d.photos && (
        <Section titre="Avant / après">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["Avant", photos.avant, d.photos.avant.date],
                ["Après", photos.apres, d.photos.apres.date],
              ] as const
            ).map(([libelle, url, jour]) => (
              <figure key={libelle} className="flex flex-col gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${libelle}, le ${date(jour)}`}
                  className="aspect-[3/4] w-full rounded-carte object-cover"
                />
                <figcaption className="text-center text-[13px] text-texte-2">
                  {libelle} · {date(jour)}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {d.evolutions.length > 0 && (
        <Section titre="Tes mesures">
          <ul className="grid gap-3 sm:grid-cols-2">
            {d.evolutions.map((e) => (
              <li
                key={e.libelle}
                className="flex flex-col gap-1 rounded-carte bg-blanc-casse p-4 shadow-douce"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{e.libelle}</span>
                  <span className="font-titre text-[20px] font-bold tabular-nums">
                    {ecartSigne(e.ecart)}
                    {e.unite ? ` ${e.unite}` : ""}
                  </span>
                </div>
                <Courbe e={e} />
                <span className="text-[12.5px] text-texte-2">
                  {e.depart.toLocaleString("fr-FR")} →{" "}
                  {e.actuel.toLocaleString("fr-FR")}
                  {e.unite ? ` ${e.unite}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.progression.length > 0 && (
        <Section titre="Tu es devenue plus forte 💪">
          <ul className="flex flex-col divide-y divide-ligne rounded-carte bg-blanc-casse px-4 shadow-douce">
            {d.progression.map((x) => (
              <li
                key={x.nom}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="font-medium">{x.nom}</span>
                {!d.sansChiffres && (
                  <span className="text-[14.5px] tabular-nums text-texte-2">
                    {kg(x.depart)} →{" "}
                    <strong className="text-chocolat">{kg(x.meilleur)}</strong>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="rounded-carte bg-accent-pale p-5 font-main text-[26px] leading-[1.2] text-chocolat">
        Tout ce chemin, c’est toi qui l’as fait. Garde ces habitudes avec toi :
        elles t’appartiennent 💛
      </p>

      {suite}
    </div>
  );
}
