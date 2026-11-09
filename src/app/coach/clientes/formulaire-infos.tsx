"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Champ, Message } from "@/components/ui";
import type { EtatAction } from "./actions";

export type ValeursInfos = {
  prenom: string;
  nom: string;
  email: string;
  date_debut: string | null;
  date_fin: string | null;
  frequence_bilan_jours: number;
  acces_formation: boolean;
  masquer_graph_poids: boolean;
};

export function FormulaireInfos({
  action,
  valeurs,
  creation = false,
}: {
  action: (etat: EtatAction, formData: FormData) => Promise<EtatAction>;
  valeurs?: ValeursInfos;
  creation?: boolean;
}) {
  const [etat, envoyer] = useActionState(action, {});
  return (
    <form action={envoyer} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ label="Prénom" name="prenom" required defaultValue={valeurs?.prenom} autoComplete="off" />
        <Champ label="Nom" name="nom" defaultValue={valeurs?.nom} autoComplete="off" />
      </div>
      <Champ
        label="Email"
        name="email"
        type="email"
        required
        defaultValue={valeurs?.email}
        autoComplete="off"
        aide={creation ? "C’est l’adresse qu’elle utilisera pour se connecter." : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ label="Début du coaching" name="date_debut" type="date" defaultValue={valeurs?.date_debut ?? ""} />
        <Champ label="Fin prévue" name="date_fin" type="date" defaultValue={valeurs?.date_fin ?? ""} />
        <Champ
          label="Bilan tous les… (jours)"
          name="frequence_bilan_jours"
          type="number"
          min={1}
          max={120}
          defaultValue={valeurs?.frequence_bilan_jours ?? 14}
        />
      </div>
      <div className="flex flex-col gap-4 rounded-xl bg-creme/70 p-4">
        <CaseACocher
          name="acces_formation"
          label="Accès à la formation (Fitw_cindy Academy)"
          aide="Sinon, la carte Formation apparaît verrouillée avec ton message doux."
          defaultChecked={valeurs?.acces_formation ?? true}
        />
        <CaseACocher
          name="masquer_graph_poids"
          label="Masquer le graphique du poids"
          aide="Les autres mesures restent visibles."
          defaultChecked={valeurs?.masquer_graph_poids ?? false}
        />
        {creation && (
          <CaseACocher
            name="envoyer_email"
            label="Lui envoyer tout de suite l’email de connexion"
            aide="Tu pourras aussi lui envoyer un lien par WhatsApp depuis sa fiche."
            defaultChecked
          />
        )}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <BoutonEnvoi enCours="Enregistrement…">
          {creation ? "Créer la cliente" : "Enregistrer"}
        </BoutonEnvoi>
      </div>
    </form>
  );
}
