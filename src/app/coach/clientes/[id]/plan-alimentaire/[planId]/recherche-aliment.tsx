"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { IconeRecherche } from "@/components/icones";
import { chercherAlimentsPlan, type ResultatAliment } from "../../../plan-alimentaire-actions";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Champ de recherche d'aliment (Ciqual + aliments perso), avec liste de résultats. */
export function RechercheAliment({
  placeholder,
  onChoisir,
  onFermer,
}: {
  placeholder: string;
  onChoisir: (r: ResultatAliment) => void;
  onFermer: () => void;
}) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ResultatAliment[]>([]);
  const [cherche, setCherche] = useState(false);
  const [enCours, demarrer] = useTransition();
  const champ = useRef<HTMLInputElement>(null);
  const derniere = useRef(0);

  useEffect(() => champ.current?.focus(), []);

  const lancer = (texte: string) => {
    setQ(texte);
    const n = ++derniere.current;
    if (texte.trim().length < 2) {
      setResultats([]);
      setCherche(false);
      return;
    }
    window.setTimeout(() => {
      if (n !== derniere.current) return;
      demarrer(async () => {
        const r = await chercherAlimentsPlan(texte);
        if (n === derniere.current) {
          setResultats(r);
          setCherche(true);
        }
      });
    }, 250);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-chocolat/30 bg-white p-2">
      <div className="flex items-center gap-2">
        <IconeRecherche className="ml-1 size-5 shrink-0 text-texte-2" />
        <input
          ref={champ}
          type="search"
          value={q}
          onChange={(e) => lancer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onFermer();
            if (e.key === "Enter") {
              e.preventDefault();
              if (resultats[0]) onChoisir(resultats[0]);
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-h-10 flex-1 bg-transparent text-[15px] outline-none"
        />
        <button type="button" onClick={onFermer} className="rounded-full px-3 py-1 text-[13px] text-texte-2 hover:text-chocolat">
          Fermer
        </button>
      </div>
      {enCours && <p className="px-2 text-[13px] text-texte-2">Recherche…</p>}
      {!enCours && cherche && resultats.length === 0 && (
        <p className="px-2 text-[13px] text-texte-2">Aucun aliment trouvé. Essaie un autre mot (sans accent, au singulier).</p>
      )}
      {resultats.length > 0 && (
        <ul className="defilement max-h-64 overflow-y-auto">
          {resultats.map((r) => (
            <li key={r.aliment.id}>
              <button
                type="button"
                onClick={() => onChoisir(r)}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-sable/60"
              >
                <span className="text-[14.5px]">{r.nomComplet}</span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-texte-2">{nf.format(r.aliment.k)} kcal/100 g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
