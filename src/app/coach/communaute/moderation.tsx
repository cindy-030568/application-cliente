"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, CaseACocher, Etiquette, Message, ZoneTexte } from "@/components/ui";
import { formaterDate } from "@/lib/bilan";
import { jourParis } from "@/lib/communaute";
import { supprimerMessage } from "@/app/communaute-actions";
import { changerMembre, enregistrerCommunaute, traiterSignalements } from "./actions";

export type SignalementGroupe = {
  messageId: string;
  auteur: string;
  texte: string;
  photo: boolean;
  creeLe: string;
  signalements: { par: string; motif: string | null }[];
};

export type MembreCoach = {
  clienteId: string;
  nom: string;
  statut: "membre" | "exclue";
  accompagnementTermine: boolean;
  notifications: boolean;
  depuis: string;
};

export function ReglagesCommunaute({ ouverte, charte }: { ouverte: boolean; charte: string }) {
  const [etat, action] = useActionState(enregistrerCommunaute, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <h2 className="font-titre text-xl font-bold">Ouverture et charte</h2>
        <p className="text-[14px] text-texte-2">
          Fermée, la communauté disparaît de l’app des clientes (les messages sont conservés). Chaque cliente doit accepter la
          charte avant d’entrer.
        </p>
      </div>
      <CaseACocher name="ouverte" defaultChecked={ouverte} label="Communauté ouverte" aide="Visible sur l’accueil de tes clientes." />
      <ZoneTexte name="charte" label="Charte" defaultValue={charte} maxLength={3000} rows={8} required />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <BoutonEnvoi className="self-start">Enregistrer</BoutonEnvoi>
    </form>
  );
}

export function ListeSignalements({ groupes }: { groupes: SignalementGroupe[] }) {
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const faire = (f: () => Promise<{ erreur?: string }>) =>
    demarrer(async () => {
      setErreur(undefined);
      const r = await f();
      if (r.erreur) setErreur(r.erreur);
    });
  return (
    <ul className="flex flex-col gap-4">
      {erreur && <Message ton="erreur">{erreur}</Message>}
      {groupes.map((g) => (
        <li key={g.messageId} className="flex flex-col gap-3 rounded-xl bg-sable/50 p-4">
          <p className="text-[13px] text-texte-2">
            Message de <strong className="text-chocolat">{g.auteur}</strong> · {formaterDate(jourParis(g.creeLe))}
          </p>
          {g.texte && <p className="whitespace-pre-wrap break-words text-[15px]">{g.texte}</p>}
          {g.photo && <p className="text-[13.5px] text-texte-2">📷 avec une photo (visible dans le fil ci-dessous)</p>}
          <ul className="flex flex-col gap-1 text-[13.5px]">
            {g.signalements.map((s, i) => (
              <li key={i}>
                Signalé par {s.par}
                {s.motif ? ` : « ${s.motif} »` : ""}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Bouton
              variante="danger"
              disabled={enCours}
              className="min-h-10 px-4"
              onClick={() => {
                if (window.confirm(`Supprimer le message de ${g.auteur} ?`)) faire(() => supprimerMessage(g.messageId));
              }}
            >
              Supprimer le message
            </Bouton>
            <Bouton variante="contour" disabled={enCours} className="min-h-10 px-4" onClick={() => faire(() => traiterSignalements(g.messageId))}>
              Garder le message
            </Bouton>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ListeMembres({ membres }: { membres: MembreCoach[] }) {
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  if (!membres.length) return <p className="text-[14px] text-texte-2">Aucune cliente n’a encore rejoint la communauté.</p>;
  const faire = (m: MembreCoach, action: "retirer" | "reintegrer" | "effacer", question: string) => {
    if (!window.confirm(question)) return;
    demarrer(async () => {
      setErreur(undefined);
      const r = await changerMembre(m.clienteId, action);
      if (r.erreur) setErreur(r.erreur);
    });
  };
  return (
    <div className="flex flex-col gap-3">
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <ul className="flex flex-col divide-y divide-ligne">
        {membres.map((m) => (
          <li key={m.clienteId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">{m.nom}</span>
              <span className="text-[13px] text-texte-2">
                Depuis le {formaterDate(jourParis(m.depuis))}
                {m.notifications ? " · notifications activées" : ""}
              </span>
            </span>
            {m.statut === "exclue" && <Etiquette ton="sombre">Retirée</Etiquette>}
            {m.accompagnementTermine && <Etiquette ton="sable">Accompagnement terminé</Etiquette>}
            {m.statut === "membre" ? (
              <button
                type="button"
                disabled={enCours}
                onClick={() => faire(m, "retirer", `Retirer ${m.nom} de la communauté ? Elle ne pourra plus y accéder ni revenir seule.`)}
                className="text-[13.5px] text-erreur underline underline-offset-4"
              >
                Retirer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => faire(m, "reintegrer", `Réintégrer ${m.nom} dans la communauté ?`)}
                  className="text-[13.5px] underline underline-offset-4"
                >
                  Réintégrer
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() =>
                    faire(m, "effacer", `Effacer l’adhésion de ${m.nom} ? Elle pourra de nouveau rejoindre seule la communauté.`)
                  }
                  className="text-[13.5px] text-texte-2 underline underline-offset-4"
                >
                  Lui permettre de revenir
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
