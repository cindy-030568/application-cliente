"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconeRecherche } from "@/components/icones";
import { cx } from "@/components/ui";
import { GROUPES_INGREDIENTS, avecCeQueJai, type IngredientACocher, type RecetteMenu } from "@/lib/menus";
import { normaliser } from "@/lib/texte";

const CLE = "avec-ce-que-j-ai";

/** Les ingrédients à cocher, puis les recettes faisables (calculées sur le téléphone, rien n'est envoyé). */
export function AvecCeQueJai({ recettes, ingredients }: { recettes: (RecetteMenu & { photo: string | null })[]; ingredients: IngredientACocher[] }) {
  const [coches, setCoches] = useState<string[]>([]);
  const [filtre, setFiltre] = useState("");
  // Ses ingrédients cochés restent sur ce téléphone, pour la prochaine fois.
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage local au montage
      if (brut) setCoches(JSON.parse(brut));
    } catch {}
  }, []);
  const changer = (n: string[]) => {
    setCoches(n);
    try {
      window.localStorage.setItem(CLE, JSON.stringify(n));
    } catch {}
  };
  const basculer = (nom: string) => changer(coches.includes(nom) ? coches.filter((x) => x !== nom) : [...coches, nom]);
  const resultats = useMemo(() => avecCeQueJai(recettes, coches), [recettes, coches]);
  const photo = new Map(recettes.map((r) => [r.id, r.photo]));
  const mots = normaliser(filtre).split(/\s+/).filter(Boolean);
  const visibles = ingredients.filter((i) => mots.every((m) => normaliser(i.nom).includes(m)));
  const faisables = resultats.filter((r) => r.manquants.length === 0);
  const presque = resultats.filter((r) => r.manquants.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce" aria-labelledby="titre-ingredients">
        <div className="flex items-center justify-between gap-2">
          <h2 id="titre-ingredients" className="font-titre text-lg font-bold">
            J’ai… {coches.length > 0 && <span className="text-[14px] font-normal text-texte-2">({coches.length})</span>}
          </h2>
          {coches.length > 0 && (
            <button type="button" onClick={() => changer([])} className="text-[14px] text-texte-2 underline underline-offset-4">
              Tout décocher
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 rounded-full bg-creme px-4">
          <IconeRecherche className="size-5 shrink-0 text-texte-2" />
          <span className="sr-only">Chercher un ingrédient</span>
          <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Chercher un ingrédient…" className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </label>
        <div className="flex max-h-[45vh] flex-col gap-4 overflow-y-auto pr-1">
          {GROUPES_INGREDIENTS.map((g) => {
            const liste = visibles.filter((i) => i.groupe === g.code);
            if (!liste.length) return null;
            return (
              <fieldset key={g.code} className="flex flex-col gap-2">
                <legend className="mb-1 text-[12.5px] font-medium uppercase tracking-[0.12em] text-caramel-texte">{g.libelle}</legend>
                <div className="flex flex-wrap gap-2">
                  {liste.map((i) => {
                    const actif = coches.includes(i.nom);
                    return (
                      <label key={i.id} className="cursor-pointer">
                        <input type="checkbox" checked={actif} onChange={() => basculer(i.nom)} className="peer sr-only" />
                        <span
                          className={cx(
                            "inline-flex min-h-10 items-center rounded-full px-3.5 text-[14px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
                            actif ? "bg-chocolat text-creme" : "bg-creme text-chocolat",
                          )}
                        >
                          {actif ? "✓ " : ""}
                          {i.nom}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          {!visibles.length && <p className="text-[14px] text-texte-2">Aucun ingrédient ne correspond.</p>}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-live="polite" aria-labelledby="titre-resultats">
        <h2 id="titre-resultats" className="font-titre text-[22px] font-bold">
          Je peux cuisiner
        </h2>
        {!coches.length ? (
          <p className="text-[15px] text-texte-2">Coche quelques ingrédients pour voir mes idées.</p>
        ) : !resultats.length ? (
          <p className="text-[15px] text-texte-2">Rien pour l’instant : coche encore un ou deux ingrédients.</p>
        ) : (
          <>
            {faisables.length > 0 && <Liste titre={`Tu as tout ✓ (${faisables.length})`} resultats={faisables} photo={photo} />}
            {presque.length > 0 && <Liste titre="Il manque presque rien" resultats={presque} photo={photo} />}
          </>
        )}
      </section>
    </div>
  );
}

function Liste({ titre, resultats, photo }: { titre: string; resultats: ReturnType<typeof avecCeQueJai>; photo: Map<string, string | null> }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-medium uppercase tracking-[0.12em] text-caramel-texte">{titre}</h3>
      <ul className="flex flex-col gap-2">
        {resultats.map((r) => {
          const p = photo.get(r.id);
          return (
            <li key={r.id}>
              <Link href={`/espace/recettes/${r.id}`} className="flex items-center gap-3 overflow-hidden rounded-carte bg-blanc-casse shadow-douce">
                {p ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p} alt="" loading="lazy" className="size-20 shrink-0 object-cover" />
                ) : (
                  <span className="flex size-20 shrink-0 items-center justify-center bg-sable text-2xl" aria-hidden>
                    🍽️
                  </span>
                )}
                <span className="flex min-w-0 flex-col gap-0.5 py-2 pr-3">
                  <span className="font-medium leading-snug">{r.titre}</span>
                  <span className="text-[13px] text-texte-2">{r.manquants.length ? `Il te manque : ${r.manquants.join(", ").toLocaleLowerCase("fr")}` : "Tu as tout ce qu’il faut"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
