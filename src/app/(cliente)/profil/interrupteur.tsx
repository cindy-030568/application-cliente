"use client";

import { useState, useTransition } from "react";
import { Message, cx } from "@/components/ui";
import { definirPreference, type Preference } from "./rappels-actions";

/** Un interrupteur de préférence (enregistré tout de suite). */
export function InterrupteurPreference({ cle, actif, titre, detail }: { cle: Preference; actif: boolean; titre: string; detail: string }) {
  const [valeur, setValeur] = useState(actif);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="font-medium">{titre}</span>
          <span className="text-[13.5px] text-texte-2">{detail}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={valeur}
          disabled={enCours}
          onChange={(e) => {
            const v = e.target.checked;
            setValeur(v);
            setErreur(undefined);
            demarrer(async () => {
              const r = await definirPreference(cle, v);
              if (r.erreur) {
                setValeur(!v);
                setErreur(r.erreur);
              }
            });
          }}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cx(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
            valeur ? "bg-succes" : "bg-chocolat/25",
          )}
        >
          <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]", valeur ? "left-[22px]" : "left-0.5")} />
        </span>
      </label>
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </div>
  );
}
