"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Champ, Message, ZoneTexte, cx } from "@/components/ui";
import { changerBrouillonClaude, enregistrerContrat } from "./contrat-actions";

export type ReglagesContrat = {
  contrat_texte: string | null;
  contrat_version: string | null;
  contrat_case_renonciation: string | null;
  contrat_depuis: string | null;
};

const VARIABLES: [string, string][] = [
  ["{{prenom}}", "son prénom"],
  ["{{nom}}", "son nom"],
  ["{{email}}", "son email"],
  ["{{adresse}}", "son adresse (elle la tape sur l’écran du contrat)"],
  ["{{date_naissance}}", "sa date de naissance (idem, pré-remplie si tu la connais)"],
  ["{{formule}}", "sa formule"],
  ["{{montant_total}}", "le montant total, ex. 750 €"],
  ["{{paiement}}", "« Intégral » ou « Échelonné (en 3 fois) »"],
  ["{{jour_echeance}}", "le jour du mois des versements"],
  ["{{date_debut}}", "la date de début du coaching"],
  ["{{date}}", "la date d’acceptation"],
];

export function FormulaireContrat({ contrat, acceptations }: { contrat: ReglagesContrat; acceptations: number }) {
  const [etat, envoyer] = useActionState(enregistrerContrat, {});
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      {contrat.contrat_version ? (
        <p className="rounded-xl bg-sable/50 px-4 py-3 text-[14px]">
          Version en cours : <strong className="font-medium">{contrat.contrat_version}</strong> · acceptée par {acceptations} cliente
          {acceptations > 1 ? "s" : ""}. Les clientes déjà en cours avant la mise en place du contrat ne sont pas bloquées.
        </p>
      ) : (
        <p className="rounded-xl bg-sable/50 px-4 py-3 text-[14px]">
          Pas encore de contrat : colle ton texte ci-dessous. Les nouvelles clientes devront l’accepter à leur première connexion,
          juste après l’écran sur leurs données.
        </p>
      )}
      <Champ
        label="Numéro de version"
        name="contrat_version"
        maxLength={40}
        placeholder="1"
        defaultValue={contrat.contrat_version ?? ""}
        aide="Change-le à chaque modification du texte : les nouvelles clientes acceptent la nouvelle version, celles qui ont accepté une version précédente ne sont pas redemandées."
      />
      <details className="rounded-xl bg-creme/70 px-4 py-3 text-[14px]">
        <summary className="cursor-pointer font-medium">Les informations remplies automatiquement pour chaque cliente</summary>
        <p className="mt-2 text-texte-2">Écris ces mots, avec les doubles accolades, là où l’information doit apparaître :</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {VARIABLES.map(([v, aide]) => (
            <li key={v}>
              <code className="rounded bg-sable/60 px-1.5 py-0.5 text-[13px]">{v}</code> <span className="text-texte-2">{aide}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-texte-2">
          Sa formule, le montant et le paiement viennent de sa fiche (Formule et paiement) : remplis-les avant de l’inviter. Une
          information manquante s’affiche « — ». Sur sa fiche, rubrique Contrat, tu peux voir son contrat tel qu’elle le lira.
        </p>
      </details>
      <ZoneTexte
        label="Texte de ton contrat"
        name="contrat_texte"
        maxLength={100000}
        defaultValue={contrat.contrat_texte ?? ""}
        placeholder="Colle ici le texte complet de ton contrat d’accompagnement."
        className="[&_textarea]:min-h-72"
      />
      <ZoneTexte
        label="Phrase de la case « renonciation au droit de rétractation »"
        name="contrat_case_renonciation"
        maxLength={2000}
        defaultValue={contrat.contrat_case_renonciation ?? ""}
        placeholder="La phrase exacte que ta cliente coche pour demander un début immédiat (celle de ton contrat ou de ton conseil juridique)."
        className="[&_textarea]:min-h-24"
      />
      <p className="text-[13px] text-texte-2">
        La première case dira simplement : « J’ai lu et j’accepte le contrat ci-dessus (version …). » Les deux cases sont obligatoires
        pour accéder à l’app. Le texte exact accepté, la version, la date et l’heure sont gardés comme preuve (export PDF sur sa fiche).
      </p>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <BoutonEnvoi enCours="Enregistrement…">Enregistrer le contrat</BoutonEnvoi>
      </div>
    </form>
  );
}

export function InterrupteurBrouillon({ actif, cleConfiguree }: { actif: boolean; cleConfiguree: boolean }) {
  const [valeur, setValeur] = useState(actif);
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="font-medium">Bouton « Proposer un brouillon » sur les bilans</span>
          <span className="text-[13.5px] text-texte-2">
            {cleConfiguree
              ? "Claude prépare une réponse à partir du bilan anonymisé. Tu relis et modifies : rien n’est jamais envoyé sans ton clic."
              : "La clé ANTHROPIC_API_KEY n’est pas encore dans ton hébergeur (voir le guide) : le bouton reste caché."}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={valeur}
          disabled={enCours}
          onChange={(e) => {
            const v = e.target.checked;
            setValeur(v);
            demarrer(async () => {
              const r = await changerBrouillonClaude(v);
              if (r.erreur) setValeur(!v);
              setEtat(r);
            });
          }}
          className="peer sr-only"
        />
        <span aria-hidden className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent", valeur ? "bg-succes" : "bg-chocolat/25")}>
          <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]", valeur ? "left-[22px]" : "left-0.5")} />
        </span>
      </label>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </div>
  );
}
