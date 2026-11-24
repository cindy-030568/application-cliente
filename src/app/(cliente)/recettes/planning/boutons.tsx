"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { planifierRecette, remplirCoursesSemaine, retirerDuPlanning, type EtatAction } from "../actions";

export function BoutonRemplirCourses({ lundi, vide }: { lundi: string; vide: boolean }) {
  const [etat, setEtat] = useState<EtatAction>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Bouton pleineLargeur disabled={enCours || vide} onClick={() => demarrer(async () => setEtat(await remplirCoursesSemaine(lundi)))}>
        {enCours ? "Ajout…" : "🛒 Ajouter ma semaine à ma liste de courses"}
      </Bouton>
      {vide && <p className="text-center text-[13px] text-texte-2">Choisis d’abord quelques repas de la semaine.</p>}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}

export function BoutonRetirer({ jour, repasCibleId, titre }: { jour: string; repasCibleId: string; titre: string }) {
  const [enCours, demarrer] = useTransition();
  return (
    <button
      type="button"
      aria-label={`Retirer ${titre}`}
      disabled={enCours}
      onClick={() => demarrer(async () => void (await retirerDuPlanning(jour, repasCibleId)))}
      className="shrink-0 rounded-full px-2 py-1 text-[18px] leading-none text-texte-2 hover:bg-sable"
    >
      ×
    </button>
  );
}

export function BoutonChoisir({ jour, index, recetteId, retour }: { jour: string; index: number; recetteId: string; retour: string }) {
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1">
      <Bouton
        variante="sombre"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await planifierRecette(jour, index, recetteId);
            if (r.erreur) setErreur(r.erreur);
            else router.push(retour);
          })
        }
      >
        {enCours ? "…" : "Choisir"}
      </Bouton>
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </div>
  );
}
