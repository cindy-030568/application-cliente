"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, LienBouton, Message, ZoneTexte } from "@/components/ui";
import { enregistrerRetour, proposerBrouillonRetour } from "../actions";

export function FormulaireRetour({
  bilanId,
  initial,
  prenom,
  suivant,
  avecBrouillon = false,
}: {
  bilanId: string;
  initial: string;
  prenom: string;
  suivant: string | null;
  /** Bouton « Proposer un brouillon » (Claude), si la coach l'a activé et que la clé est configurée. */
  avecBrouillon?: boolean;
}) {
  const [etat, envoyer] = useActionState(enregistrerRetour.bind(null, bilanId), {});
  const [contenu, setContenu] = useState(initial);
  const [brouillon, setBrouillon] = useState<{ erreur?: string; pret?: boolean }>({});
  const [enCours, demarrer] = useTransition();

  const proposer = () => {
    if (contenu.trim() && !window.confirm("Remplacer le texte déjà écrit par le brouillon de Claude ?")) return;
    demarrer(async () => {
      setBrouillon({});
      const r = await proposerBrouillonRetour(bilanId);
      if (r.texte) {
        setContenu(r.texte);
        setBrouillon({ pret: true });
      } else setBrouillon({ erreur: r.erreur ?? "Le brouillon n’a pas pu être préparé." });
    });
  };

  return (
    <form action={envoyer} className="flex flex-col gap-4">
      {avecBrouillon && (
        <div className="flex flex-col gap-2">
          <Bouton type="button" variante="contour" className="min-h-11" disabled={enCours} onClick={proposer}>
            {enCours ? "Claude prépare un brouillon… (jusqu’à 1 minute)" : "✨ Proposer un brouillon"}
          </Bouton>
          {brouillon.pret && (
            <Message ton="info">Brouillon prêt : relis-le et adapte-le. Il ne part que lorsque tu cliques sur « Envoyer ».</Message>
          )}
          {brouillon.erreur && <Message ton="erreur">{brouillon.erreur}</Message>}
        </div>
      )}
      <ZoneTexte
        label={`Ton retour à ${prenom}`}
        name="contenu"
        required
        maxLength={5000}
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
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
