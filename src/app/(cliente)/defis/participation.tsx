"use client";

import { useState, useTransition } from "react";
import { Bouton, CaseACocher, Message, cx } from "@/components/ui";
import { afficherPrenomDefi, quitterDefi, releverDefi, type EtatDefiCliente } from "@/app/defis-actions";

export function Jauge({ part, couleur = "accent" }: { part: number; couleur?: "accent" | "caramel" }) {
  const p = Math.max(0, Math.min(1, part));
  return (
    <span className="block h-3 overflow-hidden rounded-full bg-sable" role="presentation">
      <span className={cx("block h-full rounded-full transition-[width] duration-500", couleur === "accent" ? "bg-accent" : "bg-caramel-clair")} style={{ width: `${Math.max(p * 100, p > 0 ? 4 : 0)}%` }} />
    </span>
  );
}

const TEXTE_PRENOM = "Afficher mon prénom dans la communauté quand je réussis";
const AIDE_PRENOM = "Pour que le groupe fête ta réussite avec toi. Sinon, elle reste entre nous.";

/** « Je relève le défi » (participation volontaire). */
export function ReleverDefi({ id, communaute }: { id: string; communaute: boolean }) {
  const [prenom, setPrenom] = useState(false);
  const [etat, setEtat] = useState<EtatDefiCliente>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {communaute && <CaseACocher label={TEXTE_PRENOM} aide={AIDE_PRENOM} checked={prenom} onChange={(e) => setPrenom(e.target.checked)} />}
      <Bouton pleineLargeur disabled={enCours} onClick={() => demarrer(async () => setEtat(await releverDefi(id, prenom)))}>
        {enCours ? "Un instant…" : "Je relève le défi 💪"}
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </div>
  );
}

/** Déjà inscrite : choix du prénom, et abandon possible tant que ce n'est pas réussi. */
export function ParticipationDefi({ id, afficherPrenom, reussi, enCours: defiEnCours, communaute }: { id: string; afficherPrenom: boolean; reussi: boolean; enCours: boolean; communaute: boolean }) {
  const [prenom, setPrenom] = useState(afficherPrenom);
  const [etat, setEtat] = useState<EtatDefiCliente>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {communaute && reussi && afficherPrenom ? (
        <p className="text-[14px] text-texte-2">Ton prénom a été fêté dans la communauté 🎉</p>
      ) : communaute && (
        <CaseACocher
          label={TEXTE_PRENOM}
          aide={AIDE_PRENOM}
          checked={prenom}
          disabled={enCours}
          onChange={(e) => {
            const v = e.target.checked;
            setPrenom(v);
            demarrer(async () => setEtat(await afficherPrenomDefi(id, v)));
          }}
        />
      )}
      {!reussi && defiEnCours && (
        <button
          type="button"
          disabled={enCours}
          className="w-fit text-[13.5px] text-texte-2 underline underline-offset-4"
          onClick={() => {
            if (window.confirm("Quitter ce défi ? Tu pourras le reprendre tant qu’il est en cours."))
              demarrer(async () => setEtat(await quitterDefi(id)));
          }}
        >
          Quitter le défi
        </button>
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
