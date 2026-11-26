"use client";

import { startTransition, useActionState, useState } from "react";
import { Bouton, CaseACocher, Champ, Message, cx } from "@/components/ui";
import { commencerAbonnement, type EtatInscription } from "./actions";

export type OffreFormule = { code: "mensuel" | "annuel"; titre: string; prix: string };

/** Formulaire d'inscription : formule, prénom, email, conditions, puis paiement Stripe. */
export function FormulaireAbonnement({ formules, lienCgv, emailConnu, prenomConnu }: { formules: OffreFormule[]; lienCgv: string | null; emailConnu?: string; prenomConnu?: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatInscription, FormData>(commencerAbonnement, {});
  const [formule, setFormule] = useState(formules.find((f) => f.code === "annuel") ? "annuel" : formules[0]?.code);
  return (
    <form
      // Envoi manuel : en cas d'erreur, ce qui a été écrit reste là.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => envoyer(fd));
      }}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Ta formule</legend>
        {formules.map((f) => (
          <label
            key={f.code}
            className={cx("flex cursor-pointer items-center justify-between gap-3 rounded-carte border-2 bg-blanc-casse p-4", formule === f.code ? "border-accent" : "border-transparent shadow-douce")}
          >
            <span className="flex items-center gap-3">
              <input type="radio" name="formule" value={f.code} checked={formule === f.code} onChange={() => setFormule(f.code)} className="size-5 accent-[var(--accent)]" />
              <span className="font-medium">{f.titre}</span>
            </span>
            <span className="font-titre text-[18px] font-bold">{f.prix}</span>
          </label>
        ))}
        <span className="text-[13px] text-texte-2">Sans engagement : tu arrêtes quand tu veux, depuis ton espace.</span>
      </fieldset>
      <Champ label="Ton prénom" name="prenom" required maxLength={60} autoComplete="given-name" defaultValue={prenomConnu} />
      <Champ label="Ton adresse email" name="email" type="email" required autoComplete="email" defaultValue={emailConnu} aide="C’est avec elle que tu te connecteras à ton espace." />
      <CaseACocher
        name="cgv"
        required
        label="J’accepte les conditions de vente"
      />
      {lienCgv && (
        <a href={lienCgv} target="_blank" rel="noopener noreferrer" className="-mt-3 ml-8 w-fit text-[13.5px] underline underline-offset-4">
          Lire les conditions de vente
        </a>
      )}
      <CaseACocher
        name="renonciation"
        required
        label="Je veux accéder à mon espace tout de suite"
        aide="Je reconnais qu’en commençant tout de suite, je renonce à mon droit de rétractation de 14 jours."
      />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <Bouton type="submit" pleineLargeur disabled={enCours} className="min-h-14 text-[16.5px]">
        {enCours ? "Un instant…" : "Continuer vers le paiement sécurisé"}
      </Bouton>
      <p className="text-center text-[13px] text-texte-2">Paiement par carte avec Stripe. Je ne vois jamais ta carte bancaire.</p>
    </form>
  );
}
