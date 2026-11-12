"use client";

import { useActionState, useState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Champ, LienBouton, Message } from "@/components/ui";
import { definirMotDePasse } from "./actions";

export function FormulaireMotDePasse({ email, retour }: { email: string; retour: string }) {
  const [etat, envoyer] = useActionState(definirMotDePasse, {});
  const [voir, setVoir] = useState(false);
  if (etat.succes) {
    return (
      <div className="flex flex-col gap-5">
        <Message ton="succes">{etat.succes}</Message>
        <LienBouton href={retour} pleineLargeur>
          Continuer
        </LienBouton>
      </div>
    );
  }
  return (
    <form action={envoyer} className="flex flex-col gap-5">
      {/* Aide les gestionnaires de mots de passe (trousseau iCloud, Google) à l'enregistrer. */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <Champ
        label="Nouveau mot de passe"
        name="mot_de_passe"
        type={voir ? "text" : "password"}
        autoComplete="new-password"
        minLength={8}
        required
        aide="Au moins 8 caractères."
      />
      <Champ
        label="Confirme-le"
        name="confirmation"
        type={voir ? "text" : "password"}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <label className="flex items-center gap-2 text-[14px] text-texte-2">
        <input type="checkbox" checked={voir} onChange={(e) => setVoir(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Afficher les mots de passe
      </label>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <BoutonEnvoi pleineLargeur enCours="Enregistrement…">
        Enregistrer mon mot de passe
      </BoutonEnvoi>
    </form>
  );
}
