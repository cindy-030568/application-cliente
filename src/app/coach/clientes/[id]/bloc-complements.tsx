"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, Champ, Message } from "@/components/ui";
import { MOMENTS, libelleMoment, type Complement } from "@/lib/complements";
import { ajouterComplement, modifierComplement, supprimerComplement, type EtatComplement } from "../complements-actions";

const selecteur = "min-h-12 rounded-xl border border-ligne bg-white px-3 text-[16px] text-chocolat";

function Champs({ c, prefixe }: { c?: Complement; prefixe: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1.4fr_1.4fr]">
      <Champ id={`${prefixe}-nom`} label="Complément" name="nom" required maxLength={80} defaultValue={c?.nom} placeholder="ex. Magnésium bisglycinate" />
      <Champ id={`${prefixe}-quantite`} label="Combien" name="quantite" required maxLength={80} defaultValue={c?.quantite} placeholder="ex. 2 gélules" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixe}-moment`} className="text-sm font-medium">
          Quand
        </label>
        <select id={`${prefixe}-moment`} name="moment" defaultValue={c?.moment ?? "matin"} className={selecteur}>
          {MOMENTS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.libelle}
            </option>
          ))}
        </select>
      </div>
      <Champ
        id={`${prefixe}-note`}
        className="sm:col-span-3"
        label="Précision (facultatif)"
        name="note"
        maxLength={300}
        defaultValue={c?.note ?? ""}
        placeholder="ex. pendant le repas, en cure de 3 mois…"
      />
    </div>
  );
}

function Ligne({ clienteId, c }: { clienteId: string; c: Complement }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, envoyer] = useActionState<EtatComplement, FormData>(modifierComplement.bind(null, clienteId, c.id), {});
  const [retrait, setRetrait] = useState<EtatComplement>({});
  const [enCours, demarrer] = useTransition();
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={c.actif ? "" : "opacity-60"}>
          <p className="font-medium">
            {c.nom} <span className="font-normal text-texte-2">· {c.quantite}</span>
            {!c.actif && <span className="ml-2 text-[12.5px] text-texte-2">(en pause)</span>}
          </p>
          <p className="text-[13.5px] text-texte-2">
            {libelleMoment(c.moment)}
            {c.note ? ` · ${c.note}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Bouton variante="discret" onClick={() => setOuvert((o) => !o)}>
            {ouvert ? "Fermer" : "Modifier"}
          </Bouton>
          <Bouton
            variante="discret"
            disabled={enCours}
            onClick={() => {
              if (window.confirm(`Retirer « ${c.nom} » de sa liste ?`)) demarrer(async () => setRetrait(await supprimerComplement(clienteId, c.id)));
            }}
          >
            Retirer
          </Bouton>
        </div>
      </div>
      {retrait.erreur && <Message ton="erreur">{retrait.erreur}</Message>}
      {ouvert && (
        <form action={envoyer} className="flex flex-col gap-3 rounded-xl bg-creme/70 p-4">
          <Champs c={c} prefixe={`c-${c.id}`} />
          <label className="flex items-center gap-2 text-[14.5px]">
            <input type="checkbox" name="actif" defaultChecked={c.actif} className="size-5 accent-[var(--accent)]" />
            À prendre en ce moment (décoche pour mettre en pause sans l’effacer)
          </label>
          {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
          {etat.succes && <Message ton="succes">{etat.succes}</Message>}
          <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
        </form>
      )}
    </li>
  );
}

/** Fiche cliente : ses compléments (quoi, quand, combien). */
export function BlocComplements({ clienteId, complements, prisCetteSemaine }: { clienteId: string; complements: Complement[]; prisCetteSemaine: number }) {
  const [etat, envoyer] = useActionState<EtatComplement, FormData>(ajouterComplement.bind(null, clienteId), {});
  return (
    <div className="flex flex-col gap-4">
      {complements.length > 0 ? (
        <>
          <ul className="flex flex-col divide-y divide-ligne">
            {complements.map((c) => (
              <Ligne key={c.id} clienteId={clienteId} c={c} />
            ))}
          </ul>
          <p className="text-[13.5px] text-texte-2">
            Cochés par elle ces 7 derniers jours : {prisCetteSemaine} prise{prisCetteSemaine > 1 ? "s" : ""}.
          </p>
        </>
      ) : (
        <p className="text-[14px] text-texte-2">Aucun complément pour l’instant.</p>
      )}
      <form action={envoyer} key={etat.succes} className="flex flex-col gap-3 rounded-xl border border-dashed border-caramel-clair p-4">
        <p className="font-medium">Ajouter un complément</p>
        <Champs prefixe="nouveau-complement" />
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        {etat.succes && <Message ton="succes">{etat.succes}</Message>}
        <BoutonEnvoi enCours="Ajout…">Ajouter à sa liste</BoutonEnvoi>
      </form>
    </div>
  );
}
