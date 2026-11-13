"use client";

import Link from "next/link";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { IconeCoche, IconePartager, IconePlus } from "@/components/icones";
import { Message, classesBouton, cx } from "@/components/ui";
import { quantiteArticle, texteCourses, type SectionCourses } from "@/lib/courses";
import { ajouterArticle, cocherArticles, retirerCoches, retirerRecetteDesCourses, viderListe } from "../actions";

type RecetteListe = { lot: string; titre: string; portions: number };

export function ListeCourses({ sections, recettes }: { sections: SectionCourses[]; recettes: RecetteListe[] }) {
  const [affichees, cocherAffiche] = useOptimistic(sections, (etat, { cle, coche }: { cle: string; coche: boolean }) =>
    etat.map((s) => ({ ...s, articles: s.articles.map((a) => (a.cle === cle ? { ...a, coche } : a)) })),
  );
  const [erreur, setErreur] = useState<string>();
  const [partage, setPartage] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const total = affichees.reduce((n, s) => n + s.articles.length, 0);
  const coches = affichees.reduce((n, s) => n + s.articles.filter((a) => a.coche).length, 0);

  const basculer = (cle: string, ids: string[], coche: boolean) =>
    demarrer(async () => {
      cocherAffiche({ cle, coche });
      const r = await cocherArticles(ids, coche);
      setErreur(r.erreur);
    });

  const partager = async () => {
    const texte = texteCourses(affichees);
    if (!texte) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ma liste de courses", text: texte });
        return;
      }
      await navigator.clipboard.writeText(texte);
      setPartage("Liste copiée : colle-la dans un message ou une note.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPartage("Le partage n’est pas disponible sur cet appareil.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-bloc border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-10 text-center">
          <p className="font-titre text-lg font-bold">Ta liste est vide</p>
          <p className="max-w-xs text-[14.5px] text-texte-2">
            Sur une recette, touche « Ajouter à ma liste de courses » : les ingrédients arrivent ici avec tes quantités.
          </p>
          <Link href="/recettes" className={cx(classesBouton("contour"), "mt-2")}>
            Voir les recettes
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={partager} className={classesBouton("principal")}>
              <IconePartager className="size-5" /> Envoyer ma liste
            </button>
          </div>
          {partage && <Message ton="succes">{partage}</Message>}
          {erreur && <Message ton="erreur">{erreur}</Message>}

          {affichees.map((s) => (
            <section key={s.rayon} className="flex flex-col gap-2" aria-labelledby={`rayon-${s.rayon}`}>
              <h2 id={`rayon-${s.rayon}`} className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-caramel-texte">
                {s.rayon}
              </h2>
              <ul className="flex flex-col divide-y divide-ligne rounded-carte bg-blanc-casse shadow-douce">
                {s.articles.map((a) => {
                  const q = quantiteArticle(a);
                  return (
                    <li key={a.cle}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={a.coche}
                          onChange={(e) => basculer(a.cle, a.ids, e.target.checked)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden
                          className={cx(
                            "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
                            a.coche ? "border-succes bg-succes text-white" : "border-chocolat/40",
                          )}
                        >
                          {a.coche && <IconeCoche className="size-4" strokeWidth={2.4} />}
                        </span>
                        <span className={cx("flex-1 text-[15px]", a.coche && "text-texte-2 line-through")}>{a.nom}</span>
                        {q && (
                          <span className={cx("shrink-0 text-[14.5px] tabular-nums", a.coche ? "text-texte-2" : "font-semibold")}>
                            {q}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      <AjoutArticle />

      {recettes.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="titre-recettes-liste">
          <h2 id="titre-recettes-liste" className="font-titre text-lg font-bold">
            Recettes dans ta liste
          </h2>
          <ul className="flex flex-col gap-2">
            {recettes.map((r) => (
              <li key={r.lot} className="flex items-center justify-between gap-3 rounded-xl bg-blanc-casse px-4 py-2.5 shadow-douce">
                <span className="text-[14.5px]">
                  {r.titre}
                  {r.portions > 1 && <span className="text-texte-2"> · {r.portions} portions</span>}
                </span>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => demarrer(async () => setErreur((await retirerRecetteDesCourses(r.lot)).erreur))}
                  className="min-h-11 shrink-0 px-1 text-[13.5px] text-texte-2 underline underline-offset-4"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {total > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {coches > 0 && (
            <button
              type="button"
              disabled={enCours}
              onClick={() => demarrer(async () => setErreur((await retirerCoches()).erreur))}
              className={classesBouton("contour")}
            >
              Retirer les {coches} article{coches > 1 ? "s" : ""} coché{coches > 1 ? "s" : ""}
            </button>
          )}
          <button
            type="button"
            disabled={enCours}
            onClick={() => {
              if (window.confirm("Vider toute la liste de courses ?")) demarrer(async () => setErreur((await viderListe()).erreur));
            }}
            className={classesBouton("discret")}
          >
            Vider la liste
          </button>
        </div>
      )}
    </div>
  );
}

function AjoutArticle() {
  const [etat, envoyer, enCours] = useActionState(ajouterArticle, {});
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (etat.succes && champ.current) champ.current.value = "";
  }, [etat]);
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <label htmlFor="article-libre" className="text-[14px] font-medium">
        Ajouter autre chose
      </label>
      <div className="flex gap-2">
        <input
          ref={champ}
          id="article-libre"
          name="nom"
          maxLength={120}
          required
          placeholder="Pain, éponges, café…"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-ligne bg-white px-4 text-[16px] focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale"
        />
        <button type="submit" disabled={enCours} aria-label="Ajouter" className={cx(classesBouton("principal"), "px-4")}>
          <IconePlus className="size-5" />
        </button>
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </form>
  );
}
