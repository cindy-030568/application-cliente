"use client";

import { useState, useTransition } from "react";
import { Bouton, Message, cx } from "@/components/ui";
import { definirSuiviCycle } from "@/app/journal-actions";
import type { ModeCycle } from "@/lib/cycle";

const CHOIX: { mode: ModeCycle; titre: string; detail: string }[] = [
  { mode: "aucun", titre: "Rien", detail: "Je ne souhaite rien suivre." },
  { mode: "cycle", titre: "Mon cycle", detail: "Jour et phase du cycle, à partir des jours de règles cochés dans mon journal." },
  { mode: "perimenopause", titre: "Ma périménopause", detail: "Je coche mes symptômes du jour dans mon journal." },
];

/** Profil : suivi du cycle ou de la périménopause (facultatif). */
export function ReglageCycle({ mode, duree }: { mode: ModeCycle; duree: number }) {
  const [choix, setChoix] = useState(mode);
  const [jours, setJours] = useState(duree);
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, demarrer] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        demarrer(async () => setEtat(await definirSuiviCycle(choix, jours)));
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Ce que je suis</legend>
        {CHOIX.map((c) => (
          <label
            key={c.mode}
            className={cx("flex cursor-pointer items-start gap-3 rounded-xl border p-3", choix === c.mode ? "border-chocolat bg-sable/50" : "border-ligne bg-white")}
          >
            <input type="radio" name="mode" value={c.mode} checked={choix === c.mode} onChange={() => setChoix(c.mode)} className="mt-1 size-4 accent-[var(--accent)]" />
            <span className="flex flex-col">
              <span className="font-medium">{c.titre}</span>
              <span className="text-[13px] text-texte-2">{c.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {choix === "cycle" && (
        <label className="flex items-center justify-between gap-3 text-[14.5px]">
          Durée habituelle de mon cycle
          <select
            value={jours}
            onChange={(e) => setJours(Number(e.target.value))}
            className="min-h-11 rounded-xl border border-ligne bg-white px-3 text-[16px]"
          >
            {Array.from({ length: 25 }, (_, i) => 21 + i).map((n) => (
              <option key={n} value={n}>
                {n} jours
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-[12.5px] text-texte-2">Visible seulement par toi et moi. Ce ne sont que des repères, jamais un avis médical.</p>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <Bouton type="submit" variante="contour" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </form>
  );
}
