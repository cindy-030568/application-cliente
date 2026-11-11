"use client";

import { useId, useMemo, useRef, useState } from "react";

export type Point = { date: string; valeur: number };

const L = 320;
const H = 132;
const M = { haut: 14, droite: 14, bas: 22, gauche: 34 };

const formatDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const formatDateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const formatNombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function graduations(min: number, max: number): number[] {
  if (min === max) return [min];
  const brut = (max - min) / 3;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut;
  const debut = Math.floor(min / pas) * pas;
  const valeurs: number[] = [];
  for (let v = debut; v <= max + pas / 2; v += pas) valeurs.push(Math.round(v * 100) / 100);
  return valeurs;
}

/**
 * Courbe d'un seul indicateur (petits multiples : tous les graphiques ont la même taille).
 * Survol / toucher : ligne verticale + bulle avec la date et la valeur.
 */
export function GraphiqueSuivi({
  titre,
  unite,
  points,
  echelle = false,
}: {
  titre: string;
  unite?: string | null;
  points: Point[];
  echelle?: boolean;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [actif, setActif] = useState<number | null>(null);

  const donnees = useMemo(() => [...points].sort((a, b) => a.date.localeCompare(b.date)), [points]);

  const { x, y, ticks } = useMemo(() => {
    const valeurs = donnees.map((p) => p.valeur);
    let min = echelle ? 1 : Math.min(...valeurs);
    let max = echelle ? 10 : Math.max(...valeurs);
    if (!echelle) {
      const marge = Math.max((max - min) * 0.15, max * 0.01, 0.5);
      min -= marge;
      max += marge;
    }
    const t = echelle ? [1, 5, 10] : graduations(min, max);
    const bas = Math.min(min, t[0]);
    const haut = Math.max(max, t[t.length - 1]);
    const temps = donnees.map((p) => Date.parse(p.date));
    const t0 = Math.min(...temps);
    const t1 = Math.max(...temps);
    const xs = (d: string) =>
      t1 === t0
        ? M.gauche + (L - M.gauche - M.droite) / 2
        : M.gauche + ((Date.parse(d) - t0) / (t1 - t0)) * (L - M.gauche - M.droite);
    const ys = (v: number) => M.haut + (1 - (v - bas) / (haut - bas || 1)) * (H - M.haut - M.bas);
    return { x: xs, y: ys, ticks: t };
  }, [donnees, echelle]);

  const derniere = donnees[donnees.length - 1];
  const libelleValeur = (v: number) => `${formatNombre.format(v)}${unite ? ` ${unite}` : echelle ? "/10" : ""}`;

  if (donnees.length === 0) {
    return (
      <figure className="flex flex-col gap-1 rounded-carte bg-blanc-casse p-4 shadow-douce">
        <figcaption className="text-[14px] font-medium">{titre}</figcaption>
        <p className="py-6 text-center text-[13px] text-texte-2">Pas encore de valeur</p>
      </figure>
    );
  }

  const chemin = donnees.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.valeur).toFixed(1)}`).join(" ");
  const aire = `${chemin} L${x(derniere.date).toFixed(1)},${H - M.bas} L${x(donnees[0].date).toFixed(1)},${H - M.bas} Z`;

  function survol(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L;
    let meilleur = 0;
    donnees.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(donnees[meilleur].date) - px)) meilleur = i;
    });
    setActif(meilleur);
  }

  const point = actif !== null ? donnees[actif] : null;

  return (
    <figure className="relative flex flex-col gap-1 rounded-carte bg-blanc-casse p-4 shadow-douce">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span id={`${id}-titre`} className="text-[14px] font-medium">
          {titre}
        </span>
        <span className="text-[13px] tabular-nums text-texte-2">{libelleValeur(derniere.valeur)}</span>
      </figcaption>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${L} ${H}`}
          className="w-full touch-pan-y select-none"
          role="img"
          aria-labelledby={`${id}-titre`}
          aria-describedby={`${id}-resume`}
          onPointerMove={survol}
          onPointerDown={survol}
          onPointerLeave={() => setActif(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.gauche} x2={L - M.droite} y1={y(t)} y2={y(t)} stroke="var(--ligne)" strokeWidth={1} />
              <text x={M.gauche - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--texte-2)">
                {formatNombre.format(t)}
              </text>
            </g>
          ))}
          <text x={M.gauche} y={H - 6} fontSize={10} fill="var(--texte-2)">
            {formatDate.format(Date.parse(donnees[0].date))}
          </text>
          {donnees.length > 1 && (
            <text x={L - M.droite} y={H - 6} fontSize={10} textAnchor="end" fill="var(--texte-2)">
              {formatDate.format(Date.parse(derniere.date))}
            </text>
          )}
          {donnees.length > 1 && <path d={aire} fill="var(--accent)" opacity={0.1} />}
          {donnees.length > 1 && (
            <path d={chemin} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {point && (
            <line
              x1={x(point.date)}
              x2={x(point.date)}
              y1={M.haut}
              y2={H - M.bas}
              stroke="var(--texte-2)"
              strokeWidth={1}
              opacity={0.5}
            />
          )}
          {donnees.map((p, i) =>
            i === donnees.length - 1 || i === actif || donnees.length === 1 ? (
              <circle
                key={p.date + i}
                cx={x(p.date)}
                cy={y(p.valeur)}
                r={4.5}
                fill="var(--accent)"
                stroke="var(--blanc-casse)"
                strokeWidth={2}
              />
            ) : null,
          )}
        </svg>
        {point && (
          <div
            className={`pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg bg-chocolat px-2.5 py-1.5 text-[12px] text-creme shadow-douce ${
              x(point.date) / L < 0.25 ? "" : x(point.date) / L > 0.75 ? "-translate-x-full" : "-translate-x-1/2"
            }`}
            style={{ left: `${(x(point.date) / L) * 100}%` }}
          >
            <span className="block text-texte-clair">{formatDateLongue.format(Date.parse(point.date))}</span>
            <span className="font-medium tabular-nums">{libelleValeur(point.valeur)}</span>
          </div>
        )}
      </div>
      <p id={`${id}-resume`} className="sr-only">
        {donnees.length} valeurs, de {libelleValeur(donnees[0].valeur)} le{" "}
        {formatDateLongue.format(Date.parse(donnees[0].date))} à {libelleValeur(derniere.valeur)} le{" "}
        {formatDateLongue.format(Date.parse(derniere.date))}.
      </p>
    </figure>
  );
}
