"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Champ, Message } from "@/components/ui";
import type { Reglages } from "@/lib/types";
import { enregistrerTolerance } from "./actions";

const CHOIX = [
  {
    valeur: "masquer",
    titre: "Ne pas la proposer",
    aide: "Recommandé : la cliente ne voit que des recettes qui respectent ses cibles.",
  },
  {
    valeur: "badge",
    titre: "La proposer avec la mention « approximative »",
    aide: "Plus de choix, mais les quantités s’écartent un peu des cibles.",
  },
] as const;

export function FormulaireTolerance({ reglages }: { reglages: Reglages }) {
  const [etat, envoyer] = useActionState(enregistrerTolerance, {});
  return (
    <form action={envoyer} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          label="Écart accepté (%)"
          name="tolerance_pct"
          type="number"
          inputMode="decimal"
          min={1}
          max={30}
          step={0.5}
          required
          defaultValue={Number(reglages.tolerance_pct)}
          aide="Par macro, par rapport à la cible du repas."
        />
        <Champ
          label="… ou au moins (g)"
          name="tolerance_g"
          type="number"
          inputMode="decimal"
          min={0}
          max={15}
          step={0.5}
          required
          defaultValue={Number(reglages.tolerance_g)}
          aide="Utile pour les petites cibles : 10 % de 6 g, c’est trop serré."
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-chocolat">
          Si une recette ne peut pas atteindre les cibles
        </legend>
        {CHOIX.map((c) => (
          <label
            key={c.valeur}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-ligne bg-white p-3 has-checked:border-chocolat"
          >
            <input
              type="radio"
              name="hors_tolerance"
              value={c.valeur}
              defaultChecked={reglages.hors_tolerance === c.valeur}
              className="mt-1 size-4 accent-chocolat"
            />
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">{c.titre}</span>
              <span className="text-[13px] text-texte-2">{c.aide}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
      </div>
    </form>
  );
}
