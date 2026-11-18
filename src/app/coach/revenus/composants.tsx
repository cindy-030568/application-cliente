"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, useTransition } from "react";
import { Bouton, Message, cx } from "@/components/ui";
import { formaterDate } from "@/lib/bilan";
import { MOYENS, formaterEuros } from "@/lib/paiements";
import { joursDeRetard, type Mouvement } from "@/lib/revenus";
import { encaisserEcheance, modifierEcheance, modifierRevenu, supprimerRevenu, type EtatRevenu } from "./actions";

type Cliente = { id: string; nom: string };
const champ = "min-h-11 w-full rounded-xl border border-ligne bg-white px-3 text-[15px]";
const libelle = "text-[13px] font-medium text-texte-2";
const euros = (x: number) => String(x.toFixed(2)).replace(".", ",").replace(",00", "");

function Statut({ m, aujourdhui }: { m: Mouvement; aujourdhui: string }) {
  const retard = joursDeRetard(m, aujourdhui);
  if (retard > 0)
    return (
      <span className="rounded-full bg-accent-pale px-2.5 py-1 text-[12.5px] font-medium text-erreur">
        En retard · {retard} j
      </span>
    );
  return <span className="rounded-full bg-sable px-2.5 py-1 text-[12.5px] font-medium">À venir</span>;
}

/** Une ligne de revenu (échéance ou revenu hors échéancier), avec ses actions. */
export function LigneMouvement({ m, aujourdhui, clientes, lienCliente = true }: { m: Mouvement; aujourdhui: string; clientes: Cliente[]; lienCliente?: boolean }) {
  const [mode, setMode] = useState<"" | "encaisser" | "modifier">("");
  const [etat, setEtat] = useState<EtatRevenu>({});
  const [enCours, demarrer] = useTransition();
  const [dateEnc, setDateEnc] = useState(aujourdhui);
  const lancer = (f: () => Promise<EtatRevenu>) =>
    demarrer(async () => {
      const r = await f();
      setEtat(r);
      if (!r.erreur) setMode("");
    });
  const decale = m.payee_le && m.type === "echeance" && m.payee_le !== m.date_prevue;

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-1 basis-56 flex-col">
          <span className="truncate text-[15px] font-medium">
            {m.cliente && m.cliente_id && lienCliente ? (
              <Link href={`/coach/clientes/${m.cliente_id}`} className="hover:text-accent">
                {m.cliente}
              </Link>
            ) : (
              (m.cliente ?? m.libelle)
            )}
          </span>
          <span className="text-[13px] text-texte-2">
            {[m.cliente ? m.libelle : null, m.formule, m.moyen ? MOYENS[m.moyen] : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex flex-col text-right text-[13px] text-texte-2">
          <span>{m.payee_le ? `Encaissé le ${formaterDate(m.payee_le)}` : `Prévu le ${formaterDate(m.date_prevue)}`}</span>
          {decale && <span>prévu le {formaterDate(m.date_prevue)}</span>}
        </span>
        <span className="w-24 text-right text-[15.5px] font-semibold tabular-nums">{formaterEuros(m.montant)}</span>
        {!m.payee_le && <Statut m={m} aujourdhui={aujourdhui} />}
      </div>
      {m.note && <p className="text-[13px] italic text-texte-2">{m.note}</p>}

      {mode === "" && (
        <div className="flex flex-wrap gap-3 text-[13.5px]">
          {!m.payee_le && (
            <button type="button" onClick={() => setMode("encaisser")} className="font-medium text-accent hover:underline">
              Encaissé
            </button>
          )}
          <button type="button" onClick={() => setMode("modifier")} className="underline underline-offset-4">
            {m.payee_le || m.type === "divers" ? "Modifier" : "Reporter / modifier"}
          </button>
        </div>
      )}

      {mode === "encaisser" && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-sable/40 p-3">
          <label className="flex flex-col gap-1">
            <span className={libelle}>Encaissé le</span>
            <input type="date" value={dateEnc} onChange={(e) => setDateEnc(e.target.value)} className={cx(champ, "w-44")} />
          </label>
          <Bouton type="button" className="min-h-11" disabled={enCours} onClick={() => lancer(() => encaisserEcheance(m.id, dateEnc))}>
            Valider
          </Bouton>
          <button type="button" onClick={() => setMode("")} className="min-h-11 px-2 text-[14px] text-texte-2">
            Annuler
          </button>
        </div>
      )}

      {mode === "modifier" && m.type === "echeance" && <FormEcheance m={m} enCours={enCours} annuler={() => setMode("")} lancer={lancer} />}
      {mode === "modifier" && m.type === "divers" && (
        <FormRevenu
          clientes={clientes}
          valeurs={m}
          action={modifierRevenu.bind(null, m.id)}
          annuler={() => setMode("")}
          onSucces={() => setMode("")}
          supprimer={() => {
            if (window.confirm("Supprimer ce revenu ?")) lancer(() => supprimerRevenu(m.id));
          }}
        />
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </li>
  );
}

function FormEcheance({ m, enCours, annuler, lancer }: { m: Mouvement; enCours: boolean; annuler: () => void; lancer: (f: () => Promise<EtatRevenu>) => void }) {
  const [date, setDate] = useState(m.date_prevue);
  const [montant, setMontant] = useState(euros(m.montant));
  const [payee, setPayee] = useState(Boolean(m.payee_le));
  const [datePayee, setDatePayee] = useState(m.payee_le ?? m.date_prevue);
  const [note, setNote] = useState(m.note ?? "");
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-sable/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={libelle}>Date prévue (reporter le virement)</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={libelle}>Montant (€)</span>
          <input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} className={champ} />
        </label>
        <label className="flex items-center gap-2 text-[14.5px]">
          <input type="checkbox" checked={payee} onChange={(e) => setPayee(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          Encaissé
        </label>
        {payee && (
          <label className="flex flex-col gap-1">
            <span className={libelle}>Encaissé le</span>
            <input type="date" value={datePayee} onChange={(e) => setDatePayee(e.target.value)} className={champ} />
          </label>
        )}
      </div>
      <label className="flex flex-col gap-1">
        <span className={libelle}>Note (facultatif)</span>
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="ex. virement reçu en deux fois" className={champ} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Bouton
          type="button"
          className="min-h-11"
          disabled={enCours}
          onClick={() => lancer(() => modifierEcheance(m.id, { date_prevue: date, montant, payee_le: payee ? datePayee : null, note }))}
        >
          Enregistrer
        </Bouton>
        <button type="button" onClick={annuler} className="min-h-11 px-2 text-[14px] text-texte-2">
          Annuler
        </button>
      </div>
    </div>
  );
}

/** Formulaire d'un revenu hors échéancier (ajout ou modification). */
export function FormRevenu({
  clientes,
  valeurs,
  action,
  aujourdhui,
  annuler,
  onSucces,
  supprimer,
}: {
  clientes: Cliente[];
  valeurs?: Mouvement;
  action: (e: EtatRevenu, f: FormData) => Promise<EtatRevenu>;
  aujourdhui?: string;
  annuler?: () => void;
  onSucces?: () => void;
  supprimer?: () => void;
}) {
  const [cle, setCle] = useState(0);
  const [etat, envoyer, enCours] = useActionState<EtatRevenu, FormData>(async (e, f) => {
    const r = await action(e, f);
    if (r.succes) {
      onSucces?.();
      if (!valeurs) setCle((k) => k + 1); // formulaire d'ajout vidé après succès
    }
    return r;
  }, {});
  return (
    <form
      key={cle}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        startTransition(() => envoyer(f));
      }}
      className={cx("flex flex-col gap-3", valeurs && "rounded-xl bg-sable/40 p-3")}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={libelle}>Date</span>
          <input type="date" name="date" required defaultValue={valeurs?.date_prevue ?? aujourdhui} className={champ} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={libelle}>Montant (€)</span>
          <input name="montant" required inputMode="decimal" defaultValue={valeurs ? euros(valeurs.montant) : ""} className={champ} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={libelle}>Libellé</span>
          <input name="libelle" required maxLength={120} defaultValue={valeurs?.libelle ?? ""} placeholder="ex. Séance individuelle, atelier, ebook…" className={champ} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={libelle}>Moyen de paiement</span>
          <select name="moyen" defaultValue={valeurs?.moyen ?? ""} className={champ}>
            <option value="">—</option>
            {Object.entries(MOYENS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={libelle}>Cliente (facultatif)</span>
          <select name="cliente_id" defaultValue={valeurs?.cliente_id ?? ""} className={champ}>
            <option value="">—</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={libelle}>Note (facultatif)</span>
          <input name="note" maxLength={500} defaultValue={valeurs?.note ?? ""} className={champ} />
        </label>
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && !valeurs && <Message ton="succes">{etat.succes}</Message>}
      <div className="flex flex-wrap gap-2">
        <Bouton type="submit" className="min-h-11" disabled={enCours}>
          {valeurs ? "Enregistrer" : "Ajouter le revenu"}
        </Bouton>
        {annuler && (
          <button type="button" onClick={annuler} className="min-h-11 px-2 text-[14px] text-texte-2">
            Annuler
          </button>
        )}
        {supprimer && (
          <button type="button" onClick={supprimer} className="ml-auto min-h-11 px-2 text-[14px] text-erreur">
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
