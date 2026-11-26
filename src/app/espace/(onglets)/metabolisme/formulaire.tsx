"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Champ, Message, cx } from "@/components/ui";
import { ACTIVITES, type DonneesMetabolisme } from "@/lib/metabolisme";
import { enregistrerMetabolisme, type EtatMetabolisme } from "../../actions";

export function FormulaireMetabolisme({ initial }: { initial: DonneesMetabolisme | null }) {
  const [etat, envoyer] = useActionState<EtatMetabolisme, FormData>(enregistrerMetabolisme, {});
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Champ label="Née en" name="annee_naissance" inputMode="numeric" required placeholder="1988" defaultValue={initial?.annee_naissance} />
        <Champ label="Taille (cm)" name="taille_cm" inputMode="decimal" required placeholder="165" defaultValue={initial?.taille_cm} />
        <Champ label="Poids (kg)" name="poids_kg" inputMode="decimal" required placeholder="64" defaultValue={initial?.poids_kg} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Ton quotidien</legend>
        {ACTIVITES.map((a) => (
          <label key={a.code} className="cursor-pointer">
            <input type="radio" name="activite" value={a.code} defaultChecked={(initial?.activite ?? "legere") === a.code} className="peer sr-only" />
            <span className={cx("flex flex-col rounded-xl border-2 border-transparent bg-blanc-casse px-4 py-3 shadow-douce peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent")}>
              <span className="font-medium">{a.libelle}</span>
              <span className="text-[13.5px] text-texte-2">{a.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <BoutonEnvoi pleineLargeur>{initial ? "Mettre à jour" : "Voir mes repères"}</BoutonEnvoi>
    </form>
  );
}
