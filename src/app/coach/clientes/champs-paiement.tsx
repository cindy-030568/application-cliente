"use client";

import { useState } from "react";
import { CaseACocher, Champ, ZoneTexte } from "@/components/ui";
import { formaterDate } from "@/lib/bilan";
import { MOYENS, NB_FOIS_MAX, formaterEuros, genererEcheances, lireCentimes, premierParDefaut, type Paiement } from "@/lib/paiements";

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
  const [premier, setPremier] = useState(
    valeurs?.premier_montant != null ? String(valeurs.premier_montant).replace(".", ",") : "",
  );
  const centimes = lireCentimes(montant);
  const montantOk = centimes !== null && !Number.isNaN(centimes) && centimes > 0;
  const premierCentimes = lireCentimes(premier);
  const premierOk = premierCentimes === null || (!Number.isNaN(premierCentimes) && premierCentimes <= (centimes ?? 0));
  const apercu =
    montantOk && premiere && premierOk ? genererEcheances(centimes, nbFois, premiere, premierCentimes) : [];
  const suite = apercu.slice(1);

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
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          label={nbFois === 1 ? "Date du paiement" : "Date du 1er paiement"}
          name="pai_premiere"
          type="date"
          value={premiere}
          onChange={(e) => setPremiere(e.target.value)}
        />
        {nbFois > 1 && (
          <Champ
            label="Montant du 1er paiement (€)"
            name="pai_premier"
            inputMode="decimal"
            value={premier}
            onChange={(e) => setPremier(e.target.value)}
            placeholder={montantOk ? `50 % : ${formaterEuros(premierParDefaut(centimes) / 100)}` : "50 % du total"}
            aide="Vide : 50 % du montant total."
            autoComplete="off"
          />
        )}
      </div>
      {suite.length > 0 && (
        <p className="rounded-xl bg-sable/50 px-4 py-3 text-[14px]">
          1er paiement de <strong>{formaterEuros(apercu[0].montant)}</strong> le{" "}
          {formaterDate(apercu[0].date_echeance, { year: undefined })}, puis{" "}
          {suite.length === 1
            ? <>1 mensualité de <strong>{formaterEuros(suite[0].montant)}</strong> le {formaterDate(suite[0].date_echeance)}</>
            : <>
                {suite.length} mensualités de <strong>{formaterEuros(suite.at(-1)!.montant)}</strong>
                {suite[0].montant !== suite.at(-1)!.montant && ` (la première à ${formaterEuros(suite[0].montant)})`}, du{" "}
                {formaterDate(suite[0].date_echeance, { year: undefined })} au {formaterDate(suite.at(-1)!.date_echeance)}
              </>}
          .
        </p>
      )}
      <input type="hidden" name="pai_rappels_present" value="1" />
      <CaseACocher
        name="pai_rappels"
        label="Lui envoyer un rappel le jour de chaque échéance"
        aide="Par email et notification, le matin. Elle voit aussi son échéancier dans son profil."
        defaultChecked={valeurs?.rappels ?? true}
      />
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
