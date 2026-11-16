"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Message } from "@/components/ui";
import { definirRappelJournal } from "@/app/journal-actions";

/** Réglage du rappel quotidien du journal (notification à l'heure choisie). */
export function RappelJournal({ heure, appareil }: { heure: string | null; appareil: boolean }) {
  const [actif, setActif] = useState(heure !== null);
  const [valeur, setValeur] = useState((heure ?? "20:30").slice(0, 5));
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, demarrer] = useTransition();
  const enregistrer = (a: boolean, h: string) =>
    demarrer(async () => {
      setEtat(await definirRappelJournal(a ? h : null));
    });
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sable/50 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="font-medium">Me le rappeler chaque jour</span>
          <span className="text-[13px] text-texte-2">Une notification si ta journée n’est pas encore remplie.</span>
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
          <button
            type="button"
            disabled={enCours}
            onClick={() => enregistrer(true, valeur)}
            className="min-h-11 rounded-full bg-chocolat px-5 text-[15px] font-medium text-creme"
          >
            Enregistrer
          </button>
        </div>
      )}
      {actif && !appareil && (
        <p className="text-[13px] text-texte-2">
          Pour recevoir la notification, active d’abord les notifications sur ce téléphone dans{" "}
          <Link href="/profil" className="underline underline-offset-4">ton profil</Link>.
        </p>
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
