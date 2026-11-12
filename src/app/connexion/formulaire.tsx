"use client";

import { useActionState, useState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Champ, Message } from "@/components/ui";
import { actionConnexion, type EtatConnexion } from "./actions";

function ResterConnectee() {
  return (
    <CaseACocher
      name="rester"
      label="Rester connectée"
      aide="Décoche sur un téléphone ou un ordinateur partagé."
      defaultChecked
    />
  );
}

function LienMode({ vers, children }: { vers: "vers-code" | "vers-motdepasse"; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      name="etape"
      value={vers}
      formNoValidate
      className="text-center text-[14px] text-texte-2 underline underline-offset-4 hover:text-chocolat"
    >
      {children}
    </button>
  );
}

export function FormulaireConnexion() {
  const [etat, action] = useActionState<EtatConnexion, FormData>(actionConnexion, { etape: "motdepasse" });
  const [voir, setVoir] = useState(false);

  if (etat.etape === "code") {
    return (
      <form action={action} className="flex flex-col gap-5" key="code">
        <input type="hidden" name="etape" value="code" />
        <input type="hidden" name="email" value={etat.email} />
        <p className="text-[15px] text-texte-2">
          Si <strong className="font-medium text-chocolat">{etat.email}</strong> est bien ton adresse de coaching, tu viens
          de recevoir un email. Tape le code qu’il contient, ou touche simplement le bouton dans l’email.
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
        <ResterConnectee />
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        <BoutonEnvoi pleineLargeur enCours="Vérification…">
          Me connecter
        </BoutonEnvoi>
        <p className="text-center text-[13px] text-texte-2">
          Rien reçu ? Regarde dans tes spams, puis{" "}
          <a href="/connexion" className="underline underline-offset-4 hover:text-chocolat">
            recommence
          </a>
          .
        </p>
      </form>
    );
  }

  if (etat.etape === "email") {
    return (
      <form action={action} className="flex flex-col gap-5" key="email">
        <p className="text-[15px] text-texte-2">
          Première connexion ou mot de passe oublié ? On t’envoie un code par email.
        </p>
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
          Recevoir mon code
        </BoutonEnvoi>
        <input type="hidden" name="etape" value="email" />
        <LienMode vers="vers-motdepasse">J’ai un mot de passe</LienMode>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5" key="motdepasse">
      <input type="hidden" name="etape" value="motdepasse" />
      <Champ
        label="Ton adresse email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        placeholder="prenom@exemple.fr"
        defaultValue={etat.email}
        required
        autoFocus={!etat.email}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mot_de_passe" className="text-sm font-medium">
          Ton mot de passe
        </label>
        <div className="relative">
          <input
            id="mot_de_passe"
            name="mot_de_passe"
            type={voir ? "text" : "password"}
            autoComplete="current-password"
            required
            autoFocus={Boolean(etat.email)}
            className="min-h-12 w-full rounded-xl border border-ligne bg-white pl-4 pr-20 text-[16px] focus:border-chocolat focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent-pale"
          />
          <button
            type="button"
            onClick={() => setVoir((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-texte-2 underline underline-offset-2"
            aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {voir ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>
      <ResterConnectee />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <BoutonEnvoi pleineLargeur enCours="Connexion…">
        Me connecter
      </BoutonEnvoi>
      <div className="flex flex-col items-center gap-1 rounded-xl bg-blanc-casse/70 p-3">
        <p className="text-[13.5px] text-texte-2">Première connexion ou mot de passe oublié ?</p>
        <LienMode vers="vers-code">Recevoir un code par email</LienMode>
      </div>
    </form>
  );
}
