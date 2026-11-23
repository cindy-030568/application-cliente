"use client";

import { useState, useTransition } from "react";
import { Message } from "@/components/ui";
import { supprimerDemande } from "./actions";

export function BoutonSupprimerDemande({ id, prenom }: { id: string; prenom: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();
  return (
    <>
      <button
        type="button"
        disabled={enCours}
        onClick={() => {
          if (!window.confirm(`Supprimer la demande de ${prenom} ? Ses réponses seront effacées.`)) return;
          demarrer(async () => {
            const r = await supprimerDemande(id);
            if (r.erreur) setErreur(r.erreur);
          });
        }}
        className="text-[14px] text-texte-2 underline underline-offset-4 hover:text-chocolat disabled:opacity-50"
      >
        {enCours ? "Suppression…" : "Supprimer la demande"}
      </button>
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </>
  );
}
