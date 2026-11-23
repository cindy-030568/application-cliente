"use client";

import { startTransition, useActionState, useState } from "react";
import { Bouton, Message, cx } from "@/components/ui";
import {
  COULEURS_MACROS,
  FORMULES,
  NIVEAUX_ACTIVITE,
  REPERES_MACROS,
  ageEn,
  grammesMacros,
  metabolismeBase,
  reequilibrer,
  type Formule,
  type Repartition,
  type Sexe,
} from "@/lib/plan-alimentaire";
import type { Besoins } from "@/lib/plan-alimentaire-serveur";
import { OBJECTIFS } from "@/lib/analyse-cliente";
import { enregistrerBesoins, type EtatPlanAlim } from "../../plan-alimentaire-actions";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const lire = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() && Number.isFinite(n) ? n : null;
};
const texte = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

const NOMS: Record<keyof Repartition, string> = { lipides: "Lipides", glucides: "Glucides", proteines: "Protéines" };

function imc(poids: number | null, taille: number | null): number | null {
  return poids && taille ? poids / (taille / 100) ** 2 : null;
}

export function FormulaireBesoins({
  clienteId,
  initiaux,
  aujourdhui,
  poidsJournal,
}: {
  clienteId: string;
  initiaux: Besoins;
  aujourdhui: string;
  poidsJournal: number | null;
}) {
  const [etat, action, enCours] = useActionState<EtatPlanAlim, FormData>(enregistrerBesoins.bind(null, clienteId), {});
  const [sexe, setSexe] = useState<Sexe>(initiaux.sexe);
  const [naissance, setNaissance] = useState(initiaux.date_naissance ?? "");
  const [taille, setTaille] = useState(texte(initiaux.taille_cm));
  const [poids, setPoids] = useState(texte(initiaux.poids_kg ?? poidsJournal));
  const [poidsObj, setPoidsObj] = useState(texte(initiaux.poids_objectif_kg));
  const [mg, setMg] = useState(texte(initiaux.masse_grasse_pct));
  const [formule, setFormule] = useState<Formule>(initiaux.formule);
  const [napA, setNapA] = useState(texte(initiaux.nap_actuel));
  const [napO, setNapO] = useState(texte(initiaux.nap_objectif));
  const [kcal, setKcal] = useState(texte(initiaux.kcal_objectif));
  const [pct, setPct] = useState<Repartition>({
    lipides: initiaux.pct_lipides,
    glucides: initiaux.pct_glucides,
    proteines: initiaux.pct_proteines,
  });
  const [fibres, setFibres] = useState(texte(initiaux.fibres_g));

  const age = /^\d{4}-\d{2}-\d{2}$/.test(naissance) ? ageEn(naissance, aujourdhui) : null;
  const P = lire(poids), T = lire(taille), PO = lire(poidsObj);
  const mbActuel = P && T && age ? metabolismeBase({ formule, sexe, poids: P, taille: T, age }) : null;
  const mbObjectif = PO && T && age ? metabolismeBase({ formule, sexe, poids: PO, taille: T, age }) : null;
  const depenseActuelle = mbActuel && lire(napA) ? mbActuel * lire(napA)! : null;
  const depenseObjectif = mbObjectif && lire(napO) ? mbObjectif * lire(napO)! : null;
  const K = lire(kcal);
  const g = K ? grammesMacros(K, pct) : null;

  const champ = "min-h-11 w-full rounded-xl border border-ligne bg-white px-3 text-[15px] tabular-nums";
  const libelle = "text-[13px] font-medium text-texte-2";

  return (
    <form
      // Envoi manuel : une action de formulaire remettrait les listes déroulantes à zéro après l'enregistrement.
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => action(donnees));
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="sexe" value={sexe} />
      <input type="hidden" name="formule" value={formule} />
      {(Object.keys(pct) as (keyof Repartition)[]).map((k) => (
        <input key={k} type="hidden" name={`pct_${k}`} value={pct[k]} />
      ))}

      <fieldset className="min-w-0 grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 font-titre text-lg font-bold">Sa morphologie</legend>
        <div className="flex flex-col gap-1.5">
          <span className={libelle}>Sexe</span>
          <div className="flex gap-2">
            {(["femme", "homme"] as Sexe[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sexe === s}
                onClick={() => setSexe(s)}
                className={cx("min-h-11 flex-1 rounded-xl border text-[15px]", sexe === s ? "border-chocolat bg-chocolat text-creme" : "border-ligne bg-white")}
              >
                {s === "femme" ? "Femme" : "Homme"}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={libelle}>Date de naissance {age != null && <span className="font-normal">({age} ans)</span>}</span>
          <input type="date" name="date_naissance" value={naissance} onChange={(e) => setNaissance(e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={libelle}>Taille (cm)</span>
          <input name="taille_cm" inputMode="decimal" value={taille} onChange={(e) => setTaille(e.target.value)} className={champ} placeholder="165" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={libelle}>
            Poids actuel (kg) {imc(P, T) && <span className="font-normal">· IMC {nf1.format(imc(P, T)!)}</span>}
          </span>
          <input name="poids_kg" inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} className={champ} />
          {poidsJournal != null && initiaux.poids_kg == null && (
            <span className="text-[12.5px] text-texte-2">Pré-rempli avec le dernier poids de son journal.</span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={libelle}>
            Poids objectif (kg) {imc(PO, T) && <span className="font-normal">· IMC {nf1.format(imc(PO, T)!)}</span>}
          </span>
          <input name="poids_objectif_kg" inputMode="decimal" value={poidsObj} onChange={(e) => setPoidsObj(e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={libelle}>Masse grasse (%) · facultatif</span>
          <input name="masse_grasse_pct" inputMode="decimal" value={mg} onChange={(e) => setMg(e.target.value)} className={champ} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={libelle}>Son objectif</span>
          <select name="objectif" defaultValue={initiaux.objectif ?? ""} className={champ}>
            <option value="">— (déduit du poids objectif)</option>
            {Object.entries(OBJECTIFS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className={libelle}>Ce qu’elle mange aujourd’hui (kcal/jour, estimation) · facultatif</span>
          <input
            name="kcal_actuelles"
            inputMode="numeric"
            defaultValue={initiaux.kcal_actuelles ?? ""}
            placeholder="ex. 1200 (d’après son journal alimentaire ou Nutrium)"
            className={champ}
          />
          <span className="text-[12.5px] text-texte-2">Sert à l’analyse : si elle mange nettement sous ses besoins, l’appli te propose une remontée progressive.</span>
        </label>
      </fieldset>

      <fieldset className="min-w-0 flex flex-col gap-4">
        <legend className="mb-3 font-titre text-lg font-bold">Calcul des besoins</legend>
        <label className="flex flex-col gap-1.5 sm:max-w-sm">
          <span className={libelle}>Formule du métabolisme de base</span>
          <select value={formule} onChange={(e) => setFormule(e.target.value as Formule)} className={champ}>
            {Object.entries(FORMULES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoixActivite nom="nap_actuel" titre="Activité actuelle" valeur={napA} onChange={setNapA} />
          <ChoixActivite nom="nap_objectif" titre="Activité visée" valeur={napO} onChange={setNapO} />
        </div>
        <dl className="grid gap-3 rounded-xl bg-sable/50 p-4 text-[14px] sm:grid-cols-3">
          <Valeur titre="Métabolisme de base" valeur={mbActuel} aide="au poids actuel" />
          <Valeur titre="Dépense actuelle" valeur={depenseActuelle} aide="métabolisme × activité actuelle" />
          <Valeur titre="Dépense au poids objectif" valeur={depenseObjectif} aide="avec l’activité visée" />
        </dl>
        {!(P && T && age) && (
          <p className="text-[13px] text-texte-2">Renseigne la date de naissance, la taille et le poids pour voir le calcul.</p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={libelle}>Objectif calorique (kcal/jour)</span>
            <input name="kcal_objectif" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className={cx(champ, "w-40")} />
          </label>
          {[depenseActuelle, depenseObjectif].map(
            (d, i) =>
              d && (
                <button
                  key={i}
                  type="button"
                  onClick={() => setKcal(String(Math.round(d / 10) * 10))}
                  className="min-h-11 rounded-full border border-ligne bg-white px-4 text-[14px] hover:border-chocolat"
                >
                  Prendre {nf.format(Math.round(d / 10) * 10)} kcal
                </button>
              ),
          )}
        </div>
      </fieldset>

      <fieldset className="min-w-0 flex flex-col gap-3">
        <legend className="mb-3 font-titre text-lg font-bold">Répartition des macronutriments</legend>
        {(Object.keys(NOMS) as (keyof Repartition)[]).map((k) => (
          <div key={k} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[110px_1fr_170px]">
            <label htmlFor={`curseur-${k}`} className="text-[15px] font-medium">
              {NOMS[k]} <span className="tabular-nums">{pct[k]} %</span>
            </label>
            <input
              id={`curseur-${k}`}
              type="range"
              min={0}
              max={80}
              value={pct[k]}
              onChange={(e) => setPct((p) => reequilibrer(p, k, Number(e.target.value)))}
              style={{ accentColor: COULEURS_MACROS[k] }}
              className="w-full"
            />
            <p className="text-[13.5px] tabular-nums text-texte-2">
              {g ? `${nf.format(g[k])} g` : "—"}
              {g && P ? ` · ${nf2.format(g[k] / P)} g/kg` : ""}
              <span className="block text-[12px]">repère {REPERES_MACROS[k]}</span>
            </p>
          </div>
        ))}
        <label className="flex flex-col gap-1.5 sm:max-w-[200px]">
          <span className={libelle}>Fibres (g/jour)</span>
          <input name="fibres_g" inputMode="numeric" value={fibres} onChange={(e) => setFibres(e.target.value)} className={champ} />
        </label>
      </fieldset>

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <Bouton type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer les besoins"}
        </Bouton>
      </div>
    </form>
  );
}

function ChoixActivite({ nom, titre, valeur, onChange }: { nom: string; titre: string; valeur: string; onChange: (v: string) => void }) {
  const n = lire(valeur);
  const niveau = NIVEAUX_ACTIVITE.find((x) => n != null && Math.abs(x.nap - n) < 0.001);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-texte-2">{titre}</span>
      <div className="flex gap-2">
        <select
          aria-label={`${titre} : niveau`}
          value={niveau ? String(niveau.nap) : ""}
          onChange={(e) => e.target.value && onChange(e.target.value.replace(".", ","))}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-ligne bg-white px-3 text-[15px]"
        >
          <option value="">Personnalisé</option>
          {NIVEAUX_ACTIVITE.map((x) => (
            <option key={x.nap} value={String(x.nap)}>
              {x.libelle} (NAP {nf2.format(x.nap)})
            </option>
          ))}
        </select>
        <input
          name={nom}
          aria-label={`${titre} : NAP`}
          inputMode="decimal"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-16 shrink-0 rounded-xl border border-ligne bg-white px-3 text-center text-[15px] tabular-nums"
        />
      </div>
    </div>
  );
}

function Valeur({ titre, valeur, aide }: { titre: string; valeur: number | null; aide: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[13px] text-texte-2">{titre}</dt>
      <dd className="font-titre text-xl font-bold tabular-nums">{valeur ? `${nf.format(valeur)} kcal` : "—"}</dd>
      <dd className="text-[12px] text-texte-2">{aide}</dd>
    </div>
  );
}
