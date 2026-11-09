"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Champ, Message } from "@/components/ui";
import { actionConnexion, type EtatConnexion } from "./actions";

export function FormulaireConnexion() {
  const [etat, action] = useActionState<EtatConnexion, FormData>(actionConnexion, {
    etape: "email",
  });

  if (etat.etape === "code") {
    return (
      <form action={action} className="flex flex-col gap-5" key="code">
        <input type="hidden" name="etape" value="code" />
        <input type="hidden" name="email" value={etat.email} />
        <p className="text-[15px] text-texte-2">
          Si <strong className="font-medium text-chocolat">{etat.email}</strong> est bien ton
          adresse de coaching, tu viens de recevoir un email. Tape le code qu’il contient, ou
          touche simplement le bouton de connexion dans l’email.
        </p>
        <Champ
          label="Code reçu par email"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={9}
          placeholder="123456"
          required
          autoFocus
          className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.4em]"
        />
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        <BoutonEnvoi pleineLargeur enCours="Vérification…">
          Me connecter
        </BoutonEnvoi>
        <p className="text-center text-[13px] text-texte-2">
          Rien reçu ? Regarde dans tes spams, puis{" "}
          <a href="/connexion" className="underline underline-offset-4 hover:text-chocolat">
            recommence
          </a>
          .
        </p>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" key="email">
      <input type="hidden" name="etape" value="email" />
      <Champ
        label="Ton adresse email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="prenom@exemple.fr"
        defaultValue={etat.email}
        required
        autoFocus
      />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <BoutonEnvoi pleineLargeur enCours="Envoi en cours…">
        Recevoir mon code de connexion
      </BoutonEnvoi>
      <p className="text-center text-[13px] text-texte-2">
        Pas de mot de passe à retenir : on t’envoie un code à chaque connexion.
      </p>
    </form>
  );
}
