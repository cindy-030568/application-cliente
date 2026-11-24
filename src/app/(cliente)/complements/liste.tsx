"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Message, cx } from "@/components/ui";
import { cocherComplement, definirRappelComplements, type EtatComplements } from "@/app/complements-actions";

type Groupe = { moment: string; libelle: string; complements: { id: string; nom: string; quantite: string; note: string | null }[] };

/** Liste du jour, à cocher (enregistré tout de suite). */
export function ListeComplements({ groupes, pris }: { groupes: Groupe[]; pris: string[] }) {
  const [coches, setCoches] = useOptimistic(new Set(pris), (avant: Set<string>, [id, v]: [string, boolean]) => {
    const s = new Set(avant);
    if (v) s.add(id);
    else s.delete(id);
    return s;
  });
  const [erreur, setErreur] = useState<string>();
  const [, demarrer] = useTransition();
  const total = groupes.reduce((n, g) => n + g.complements.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14.5px] text-texte-2" aria-live="polite">
        {coches.size >= total ? "Tout est pris aujourd’hui ✓ Bravo 💛" : `Aujourd’hui : ${coches.size} sur ${total}`}
      </p>
      {groupes.map((g) => (
        <section key={g.moment} className="flex flex-col gap-2">
          <h2 className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">{g.libelle}</h2>
          <ul className="flex flex-col gap-2">
            {g.complements.map((c) => {
              const ok = coches.has(c.id);
              return (
                <li key={c.id}>
                  <label className={cx("flex cursor-pointer items-start gap-3 rounded-carte p-4 shadow-douce transition-colors", ok ? "bg-accent-pale" : "bg-blanc-casse")}>
                    <input
                      type="checkbox"
                      checked={ok}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setErreur(undefined);
                        demarrer(async () => {
                          setCoches([c.id, v]);
                          const r = await cocherComplement(c.id, v);
                          if (r.erreur) setErreur(r.erreur);
                        });
                      }}
                      className="mt-0.5 size-6 shrink-0 accent-[var(--accent)]"
                    />
                    <span className="flex flex-col">
                      <span className={cx("font-medium", ok && "line-through decoration-1")}>{c.nom}</span>
                      <span className="text-[14px] text-texte-2">
                        {c.quantite}
                        {c.note ? ` · ${c.note}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </div>
  );
}

/** Rappel discret, une fois par jour, à l'heure choisie (coupé par défaut). */
export function RappelComplements({ heure, appareil }: { heure: string | null; appareil: boolean }) {
  const [actif, setActif] = useState(heure !== null);
  const [valeur, setValeur] = useState((heure ?? "08:00").slice(0, 5));
  const [etat, setEtat] = useState<EtatComplements>({});
  const [enCours, demarrer] = useTransition();
  const enregistrer = (a: boolean, h: string) => demarrer(async () => setEtat(await definirRappelComplements(a ? h : null)));
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sable/50 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="font-medium">Me le rappeler chaque jour</span>
          <span className="text-[13px] text-texte-2">Une notification discrète, seulement s’il reste quelque chose à prendre.</span>
        </span>
        <input
          type="checkbox"
          checked={actif}
          disabled={enCours}
          onChange={(e) => {
            setActif(e.target.checked);
            enregistrer(e.target.checked, valeur);
          }}
          className="size-5 shrink-0 accent-[var(--accent)]"
        />
      </label>
      {actif && (
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-[13px] text-texte-2">
            À quelle heure ?
            <input
              type="time"
              step={900}
              value={valeur}
              onChange={(e) => setValeur(e.target.value)}
              className="min-h-11 rounded-xl border border-ligne bg-white px-3 text-[16px] text-chocolat"
            />
          </label>
          <button type="button" disabled={enCours} onClick={() => enregistrer(true, valeur)} className="min-h-11 rounded-full bg-chocolat px-5 text-[15px] font-medium text-creme">
            Enregistrer
          </button>
        </div>
      )}
      {actif && !appareil && (
        <p className="text-[13px] text-texte-2">
          Pour recevoir la notification, active d’abord les notifications sur ce téléphone dans{" "}
          <Link href="/profil" className="underline underline-offset-4">
            ton profil
          </Link>
          .
        </p>
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
