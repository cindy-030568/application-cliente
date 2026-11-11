"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { LienBouton, Message, ZoneTexte } from "@/components/ui";
import { enregistrerRetour } from "../actions";

export function FormulaireRetour({
  bilanId,
  initial,
  prenom,
  suivant,
}: {
  bilanId: string;
  initial: string;
  prenom: string;
  suivant: string | null;
}) {
  const [etat, envoyer] = useActionState(enregistrerRetour.bind(null, bilanId), {});
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <ZoneTexte
        label={`Ton retour à ${prenom}`}
        name="contenu"
        required
        maxLength={5000}
        defaultValue={initial}
        placeholder="Ce que tu retiens de son bilan, tes encouragements, les ajustements…"
        className="[&_textarea]:min-h-56"
      />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <BoutonEnvoi enCours="Envoi…" pleineLargeur>
        {initial ? "Mettre à jour mon retour" : "Envoyer et marquer comme traité"}
      </BoutonEnvoi>
      {etat.succes && suivant && (
        <LienBouton href={`/coach/bilans/${suivant}`} variante="sombre" pleineLargeur>
          Bilan suivant →
        </LienBouton>
      )}
      {etat.succes && !suivant && (
        <LienBouton href="/coach/bilans" variante="contour" pleineLargeur>
          Retour à la file
        </LienBouton>
      )}
    </form>
  );
}
