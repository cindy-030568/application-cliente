"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Message } from "@/components/ui";
import { bilanPaiement, formaterEuros, type Echeance, type Paiement } from "@/lib/paiements";
import { LigneMouvement } from "../../revenus/composants";
import { ChampsPaiement } from "../champs-paiement";
import { enregistrerPaiement } from "../paiement-actions";

export function BlocPaiement({
  clienteId,
  paiement,
  echeances,
  formules,
  premiereParDefaut,
  aujourdhui,
}: {
  clienteId: string;
  paiement: Paiement | null;
  echeances: Echeance[];
  formules: string[];
  premiereParDefaut: string;
  aujourdhui: string;
}) {
  const [etat, envoyer] = useActionState(enregistrerPaiement.bind(null, clienteId), {});
  const { paye, reste } = bilanPaiement(echeances);

  return (
    <div className="flex flex-col gap-5">
      {echeances.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium">Échéancier</h3>
            <p className="text-[14px] text-texte-2">
              Payé : <strong className="text-chocolat">{formaterEuros(paye)}</strong>
              {reste > 0 && (
                <>
                  {" "}
                  · Reste : <strong className="text-chocolat">{formaterEuros(reste)}</strong>
                </>
              )}
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-ligne rounded-xl border border-ligne bg-white">
            {echeances.map((e, i) => (
              <LigneMouvement
                key={e.id}
                aujourdhui={aujourdhui}
                clientes={[]}
                lienCliente={false}
                m={{
                  id: e.id,
                  type: "echeance",
                  cliente_id: clienteId,
                  cliente: null,
                  formule: null,
                  libelle: echeances.length > 1 ? `Échéance ${i + 1}/${echeances.length}` : "Paiement",
                  date_prevue: e.date_echeance,
                  montant: e.montant,
                  payee_le: e.payee_le,
                  moyen: paiement?.moyen ?? null,
                  note: e.note ?? null,
                }}
              />
            ))}
          </ul>
          <p className="text-[12.5px] text-texte-2">
            Tous tes encaissements sont aussi dans le menu <a href="/coach/revenus" className="underline underline-offset-2">Revenus</a>.
          </p>
        </div>
      )}

      <form action={envoyer} className="flex flex-col gap-4">
        <ChampsPaiement valeurs={paiement} premiereParDefaut={premiereParDefaut} formules={formules} />
        {echeances.some((e) => e.payee_le) && (
          <p className="text-[13px] text-texte-2">
            En enregistrant, les échéances payées sont gardées. Les autres ne sont recalculées que si tu changes le montant, le nombre de fois ou la 1re date.
          </p>
        )}
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        {etat.succes && <Message ton="succes">{etat.succes}</Message>}
        <BoutonEnvoi enCours="Enregistrement…" className="self-start">
          Enregistrer
        </BoutonEnvoi>
      </form>
    </div>
  );
}
