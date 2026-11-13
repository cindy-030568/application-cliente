"use client";

import { useState } from "react";
import { Champ, ZoneTexte } from "@/components/ui";
import { formaterDate } from "@/lib/bilan";
import { MOYENS, NB_FOIS_MAX, formaterEuros, genererEcheances, lireCentimes, type Paiement } from "@/lib/paiements";

const classeSelect =
  "min-h-12 rounded-xl border border-ligne bg-white px-4 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale";

/** Champs « Formule et paiement » (noms pai_*), avec l'aperçu des mensualités. */
export function ChampsPaiement({
  valeurs,
  premiereParDefaut,
  formules,
}: {
  valeurs?: Paiement | null;
  premiereParDefaut: string;
  formules: string[];
}) {
  const [montant, setMontant] = useState(valeurs?.montant_total != null ? String(valeurs.montant_total).replace(".", ",") : "");
  const [nbFois, setNbFois] = useState(valeurs?.nb_fois ?? 1);
  const [premiere, setPremiere] = useState(premiereParDefaut);
  const centimes = lireCentimes(montant);
  const apercu =
    centimes && !Number.isNaN(centimes) && premiere ? genererEcheances(centimes, nbFois, premiere) : [];

  return (
    <div className="flex flex-col gap-4">
      <Champ
        label="Formule choisie"
        name="pai_formule"
        list="formules-existantes"
        defaultValue={valeurs?.formule ?? ""}
        placeholder="Ex. : Coaching nutrition + sport 3 mois"
        maxLength={120}
        autoComplete="off"
      />
      <datalist id="formules-existantes">
        {formules.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <div className="grid gap-4 sm:grid-cols-3">
        <Champ
          label="Montant total (€)"
          name="pai_montant"
          inputMode="decimal"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          placeholder="Ex. : 450"
          autoComplete="off"
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pai_moyen" className="text-sm font-medium text-chocolat">
            Moyen de paiement
          </label>
          <select id="pai_moyen" name="pai_moyen" defaultValue={valeurs?.moyen ?? ""} className={classeSelect}>
            <option value="">—</option>
            {Object.entries(MOYENS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pai_nb_fois" className="text-sm font-medium text-chocolat">
            Payé en
          </label>
          <select
            id="pai_nb_fois"
            name="pai_nb_fois"
            value={nbFois}
            onChange={(e) => setNbFois(Number(e.target.value))}
            className={classeSelect}
          >
            {Array.from({ length: NB_FOIS_MAX }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "1 fois" : `${n} fois`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Champ
        label={nbFois === 1 ? "Date du paiement" : "Date du 1er paiement"}
        name="pai_premiere"
        type="date"
        value={premiere}
        onChange={(e) => setPremiere(e.target.value)}
        className="sm:max-w-xs"
      />
      {apercu.length > 1 && (
        <p className="rounded-xl bg-sable/50 px-4 py-3 text-[14px]">
          {apercu.every((e) => e.montant === apercu[0].montant)
            ? `${apercu.length} mensualités de ${formaterEuros(apercu[0].montant)}`
            : `${apercu.length} mensualités : ${formaterEuros(apercu[0].montant)} puis ${formaterEuros(apercu[1].montant)}`}
          , du {formaterDate(apercu[0].date_echeance, { year: undefined })} au {formaterDate(apercu.at(-1)!.date_echeance)}.
        </p>
      )}
      <ZoneTexte
        label="Note (facultatif)"
        name="pai_note"
        defaultValue={valeurs?.note ?? ""}
        maxLength={500}
        rows={2}
        placeholder="Ex. : code promo, facture envoyée…"
      />
    </div>
  );
}
