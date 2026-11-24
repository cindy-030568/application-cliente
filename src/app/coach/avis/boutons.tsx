"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, Champ, Message } from "@/components/ui";
import { enregistrerLienInscription, marquerRecompense, supprimerAvisCoach, type EtatAvisCoach } from "./actions";

export function BoutonSupprimerAvis({ id }: { id: string }) {
  const [etat, setEtat] = useState<EtatAvisCoach>({});
  const [enCours, demarrer] = useTransition();
  if (etat.succes) return <span className="text-[13px] text-texte-2">Supprimé</span>;
  return (
    <>
      <Bouton
        variante="discret"
        disabled={enCours}
        onClick={() => {
          if (window.confirm("Supprimer ce témoignage ?")) demarrer(async () => setEtat(await supprimerAvisCoach(id)));
        }}
      >
        Supprimer
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </>
  );
}

export function CaseRecompense({ id, donnee }: { id: string; donnee: boolean }) {
  const [valeur, setValeur] = useState(donnee);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[14px]">
      <input
        type="checkbox"
        checked={valeur}
        disabled={enCours}
        onChange={(e) => {
          const v = e.target.checked;
          setValeur(v);
          demarrer(async () => {
            const r = await marquerRecompense(id, v);
            if (r.erreur) {
              setValeur(!v);
              setErreur(r.erreur);
            }
          });
        }}
        className="size-5 accent-[var(--accent)]"
      />
      Récompense donnée
      {erreur && <span className="text-erreur">{erreur}</span>}
    </label>
  );
}

export function FormulaireLienInscription({ lien }: { lien: string | null }) {
  const [etat, envoyer] = useActionState<EtatAvisCoach, FormData>(enregistrerLienInscription, {});
  return (
    <form action={envoyer} className="flex flex-col gap-3">
      <Champ
        label="Lien de ton formulaire d’inscription (Tally)"
        name="lien_inscription"
        type="url"
        defaultValue={lien ?? ""}
        placeholder="https://tally.so/r/…"
        aide="Chaque cliente reçoit ce lien avec son code de parrainage au bout (?parrain=CODE)."
      />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <BoutonEnvoi variante="contour">Enregistrer</BoutonEnvoi>
    </form>
  );
}
