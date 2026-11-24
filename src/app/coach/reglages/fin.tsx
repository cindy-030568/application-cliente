"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, Champ, Message, ZoneTexte } from "@/components/ui";
import type { Offre } from "@/lib/bilan-fin";
import { enregistrerFinSuivi, traiterDemandeSuite, type EtatFin } from "./fin-actions";

/** Réglages : texte et offres du bloc « Continuer avec moi ». */
export function FormulaireFinSuivi({ texte, offres }: { texte: string; offres: Offre[] }) {
  const [etat, envoyer] = useActionState<EtatFin, FormData>(enregistrerFinSuivi, {});
  const [lignes, setLignes] = useState(offres.length ? offres.map((o, i) => ({ ...o, cle: i })) : [{ titre: "", description: "", cle: 0 }]);
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <ZoneTexte label="Ton texte" name="fin_texte" required maxLength={1500} defaultValue={texte} className="[&_textarea]:min-h-24" />
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Tes offres (6 au plus)</p>
        {lignes.map((o, i) => (
          <div key={o.cle} className="flex flex-col gap-2 rounded-xl border border-ligne bg-creme/50 p-4">
            <Champ id={`offre-titre-${o.cle}`} label={`Offre ${i + 1}`} name="offre_titre" maxLength={120} defaultValue={o.titre} placeholder="ex. Programme 3 mois" />
            <ZoneTexte
              id={`offre-description-${o.cle}`}
              label="Description (et le prix si tu veux l’indiquer)"
              name="offre_description"
              maxLength={500}
              defaultValue={o.description}
              className="[&_textarea]:min-h-20"
            />
            <Bouton type="button" variante="discret" className="w-fit" onClick={() => setLignes((l) => l.filter((x) => x.cle !== o.cle))}>
              Retirer cette offre
            </Bouton>
          </div>
        ))}
        {lignes.length < 6 && (
          <Bouton type="button" variante="contour" className="w-fit" onClick={() => setLignes((l) => [...l, { titre: "", description: "", cle: Math.max(0, ...l.map((x) => x.cle)) + 1 }])}>
            Ajouter une offre
          </Bouton>
        )}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}

/** Fiche cliente : une demande « continuer avec moi », à marquer comme traitée. */
export function BoutonTraiterSuite({ id }: { id: string }) {
  const [etat, setEtat] = useState<EtatFin>({});
  const [enCours, demarrer] = useTransition();
  if (etat.succes) return <span className="text-[13.5px] text-succes">Traitée ✓</span>;
  return (
    <>
      <Bouton variante="contour" disabled={enCours} onClick={() => demarrer(async () => setEtat(await traiterDemandeSuite(id)))}>
        Marquer comme traitée
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </>
  );
}
