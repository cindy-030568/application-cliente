"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const CLE = "fitw_annonces_lues";
const lire = () => {
  try {
    return localStorage.getItem(CLE) ?? "";
  } catch {
    return "";
  }
};

/** Message(s) de Cindy sur l'accueil (24 h), que la cliente peut fermer. */
export function AnnoncesAccueil({ annonces }: { annonces: { id: string; texte: string; lien: string | null }[] }) {
  const luesAuDepart = useSyncExternalStore(() => () => {}, lire, () => "");
  const [fermees, setFermees] = useState<string[]>([]);
  const visibles = annonces.filter((a) => !luesAuDepart.split(",").includes(a.id) && !fermees.includes(a.id));
  if (!visibles.length) return null;
  const fermer = (id: string) => {
    setFermees((f) => [...f, id]);
    try {
      localStorage.setItem(CLE, [...lire().split(",").filter(Boolean), id].slice(-20).join(","));
    } catch {}
  };
  return (
    <>
      {visibles.map((a) => (
        <div key={a.id} className="relative flex items-start gap-3 rounded-carte bg-chocolat p-4 pr-10 text-creme apparition">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-carte-sombre font-main text-xl text-caramel-clair" aria-hidden>
            C
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[12px] uppercase tracking-[0.12em] text-caramel-clair">Un petit mot de ma part</span>
            <span className="whitespace-pre-wrap text-[15px]">{a.texte}</span>
            {a.lien && (
              <Link href={a.lien} onClick={() => fermer(a.id)} className="mt-1 self-start text-[14px] font-medium text-white underline underline-offset-4">
                J’y vais →
              </Link>
            )}
          </span>
          <button type="button" onClick={() => fermer(a.id)} aria-label="Fermer le message" className="absolute right-3 top-3 text-[18px] leading-none text-texte-clair hover:text-white">
            ×
          </button>
        </div>
      ))}
    </>
  );
}
