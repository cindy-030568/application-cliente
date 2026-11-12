"use client";

import { useState, useTransition } from "react";
import { Bouton, Message } from "@/components/ui";
import { FAMILLES, type FamilleFiltre, type FiltreVideo } from "@/lib/types";
import { ajouterFiltre, renommerFiltre, supprimerFiltre } from "./actions";

export function GestionFiltres({ filtres }: { filtres: FiltreVideo[] }) {
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const [nouveaux, setNouveaux] = useState<Record<FamilleFiltre, string>>({ groupe: "", materiel: "", categorie: "" });
  const lancer = (fn: () => Promise<{ erreur?: string }>) => demarrer(async () => setErreur((await fn()).erreur));

  return (
    <div className="flex flex-col gap-5">
      {FAMILLES.map(({ valeur, libelle }) => (
        <details key={valeur} className="group">
          <summary className="cursor-pointer font-medium">
            {libelle} <span className="text-texte-2">({filtres.filter((f) => f.famille === valeur).length})</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {filtres
              .filter((f) => f.famille === valeur)
              .map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <input
                    defaultValue={f.nom}
                    aria-label={`Nom du filtre ${f.nom}`}
                    maxLength={40}
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-ligne bg-white px-3 text-[15px]"
                    onBlur={(e) => {
                      const nom = e.currentTarget.value;
                      if (nom.trim() && nom !== f.nom) lancer(() => renommerFiltre(f.id, nom));
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 px-1 text-[13px] text-texte-2 underline underline-offset-4 hover:text-erreur"
                    onClick={() => {
                      if (confirm(`Supprimer « ${f.nom} » ? Il sera retiré des vidéos qui l’utilisent.`))
                        lancer(() => supprimerFiltre(f.id));
                    }}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              value={nouveaux[valeur]}
              onChange={(e) => setNouveaux((n) => ({ ...n, [valeur]: e.target.value }))}
              placeholder="Ajouter…"
              aria-label={`Nouveau filtre : ${libelle}`}
              maxLength={40}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-dashed border-caramel-clair bg-white px-3 text-[15px]"
            />
            <Bouton
              type="button"
              variante="contour"
              className="min-h-10 px-4 text-[14px]"
              disabled={enCours || !nouveaux[valeur].trim()}
              onClick={() =>
                lancer(async () => {
                  const r = await ajouterFiltre(valeur, nouveaux[valeur]);
                  if (!r.erreur) setNouveaux((n) => ({ ...n, [valeur]: "" }));
                  return r;
                })
              }
            >
              Ajouter
            </Bouton>
          </div>
        </details>
      ))}
      {erreur && <Message ton="erreur">{erreur}</Message>}
    </div>
  );
}
