"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { ANGLES, type AnglePhoto } from "@/lib/types";

export type PhotoDatee = { angle: AnglePhoto; date: string; url: string };

const formatDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Deux photos côte à côte (avant / après), pour un même angle. */
export function ComparatifPhotos({ photos }: { photos: PhotoDatee[] }) {
  const anglesDispo = ANGLES.filter((a) => photos.some((p) => p.angle === a.valeur));
  const [angle, setAngle] = useState<AnglePhoto>(anglesDispo[0]?.valeur ?? "face");
  const serie = photos.filter((p) => p.angle === angle).sort((a, b) => a.date.localeCompare(b.date));
  const [avant, setAvant] = useState(0);
  const [apres, setApres] = useState<number | null>(null);

  if (anglesDispo.length === 0) {
    return <p className="text-[14px] text-texte-2">Pas encore de photo. Elles sont facultatives : à toi de voir 💛</p>;
  }
  const iApres = Math.min(apres ?? serie.length - 1, serie.length - 1);
  const iAvant = Math.min(avant, serie.length - 1);

  const selecteur = (valeur: number, changer: (n: number) => void, label: string) => (
    <label className="flex flex-col gap-1 text-[12.5px] text-texte-2">
      {label}
      <select
        value={valeur}
        onChange={(e) => changer(Number(e.target.value))}
        className="min-h-10 rounded-lg border border-ligne bg-white px-2 text-[14px] text-chocolat"
      >
        {serie.map((p, i) => (
          <option key={p.url} value={i}>
            {formatDate.format(Date.parse(p.date))}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="Angle de la photo">
        {anglesDispo.map((a) => (
          <button
            key={a.valeur}
            type="button"
            aria-pressed={angle === a.valeur}
            onClick={() => {
              setAngle(a.valeur);
              setAvant(0);
              setApres(null);
            }}
            className={cx(
              "rounded-full px-4 py-1.5 text-[14px] transition-colors",
              angle === a.valeur ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat hover:bg-sable",
            )}
          >
            {a.libelle}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { i: iAvant, changer: setAvant, label: "Avant" },
          { i: iApres, changer: (n: number) => setApres(n), label: "Après" },
        ].map(({ i, changer, label }) => (
          <div key={label} className="flex flex-col gap-2">
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-sable">
              {serie[i] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={serie[i].url}
                  alt={`${label} : photo de ${angle} du ${formatDate.format(Date.parse(serie[i].date))}`}
                  className="size-full object-cover"
                />
              )}
            </div>
            {serie.length > 1 ? selecteur(i, changer, label) : <span className="text-[12.5px] text-texte-2">{label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
