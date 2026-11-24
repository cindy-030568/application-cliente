"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Message, ZoneTexte } from "@/components/ui";
import { definirAccesExpress, enregistrerListesExpress, type EtatExpress } from "./actions";

/** Réglages : listes de matériel et de types des séances express. */
export function FormulaireListesExpress({ materiel, types }: { materiel: string[]; types: string[] }) {
  const [etat, envoyer] = useActionState<EtatExpress, FormData>(enregistrerListesExpress, {});
  return (
    <form action={envoyer} className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <ZoneTexte label="Matériel (un par ligne)" name="materiel" defaultValue={materiel.join("\n")} className="[&_textarea]:min-h-44" />
        <ZoneTexte label="Types de séance (un par ligne)" name="types" defaultValue={types.join("\n")} className="[&_textarea]:min-h-44" />
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <BoutonEnvoi variante="contour">Enregistrer les listes</BoutonEnvoi>
    </form>
  );
}

/** Fiche cliente : accès aux séances express après la fin du suivi, jusqu'à une date. */
export function FormulaireAccesExpress({ clienteId, jusquAu }: { clienteId: string; jusquAu: string | null }) {
  const [etat, envoyer] = useActionState<EtatExpress, FormData>(definirAccesExpress.bind(null, clienteId), {});
  return (
    <form action={envoyer} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Accès après la fin de son suivi, jusqu’au
        <input type="date" name="express_jusqu_au" defaultValue={jusquAu ?? ""} className="min-h-12 rounded-xl border border-ligne bg-white px-3 text-[16px]" />
      </label>
      <BoutonEnvoi variante="contour">Enregistrer</BoutonEnvoi>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </form>
  );
}
