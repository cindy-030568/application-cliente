"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Message, cx } from "@/components/ui";
import { formaterDate } from "@/lib/bilan";
import { bilanPaiement, etatEcheance, formaterEuros, type Echeance, type Paiement } from "@/lib/paiements";
import { ChampsPaiement } from "../champs-paiement";
import { basculerEcheance, enregistrerPaiement } from "../paiement-actions";

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
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const { paye, reste } = bilanPaiement(echeances);

  const basculer = (e: Echeance) =>
    demarrer(async () => {
      setErreur(undefined);
      const r = await basculerEcheance(e.id, !e.payee_le);
      if (r.erreur) setErreur(r.erreur);
    });

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
            {echeances.map((e, i) => {
              const statut = etatEcheance(e, aujourdhui);
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="w-7 text-[13px] text-texte-2 tabular-nums">{i + 1}.</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium tabular-nums">{formaterEuros(e.montant)}</span>
                    <span className="text-[13px] text-texte-2">{formaterDate(e.date_echeance)}</span>
                  </span>
                  <span
                    className={cx(
                      "rounded-full px-2.5 py-1 text-[12.5px] font-medium",
                      statut === "payee" && "bg-succes-pale text-succes",
                      statut === "en_retard" && "bg-accent-pale text-erreur",
                      statut === "a_venir" && "bg-sable text-chocolat",
                    )}
                  >
                    {statut === "payee"
                      ? "Payée ✓"
                      : statut === "en_retard"
                        ? "En retard"
                        : "À venir"}
                  </span>
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => basculer(e)}
                    className="min-h-10 text-[13.5px] underline underline-offset-4"
                  >
                    {e.payee_le ? "Annuler" : "Marquer payée"}
                  </button>
                </li>
              );
            })}
          </ul>
          {erreur && <Message ton="erreur">{erreur}</Message>}
        </div>
      )}

      <form action={envoyer} className="flex flex-col gap-4">
        <ChampsPaiement valeurs={paiement} premiereParDefaut={premiereParDefaut} formules={formules} />
        {echeances.some((e) => e.payee_le) && (
          <p className="text-[13px] text-texte-2">
            En enregistrant, les échéances déjà payées sont gardées ; les autres sont recalculées.
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
