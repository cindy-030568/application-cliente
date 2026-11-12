"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, CaseACocher, Champ, Message } from "@/components/ui";
import { kcalDesMacros } from "@/lib/nutrition";
import type { Aliment, CategorieAliment } from "@/lib/types";
import { enregistrerAliment, supprimerAliment } from "./actions";

export function FormulaireAliment({ aliment, categories }: { aliment?: Aliment; categories: CategorieAliment[] }) {
  const [etat, envoyer] = useActionState(enregistrerAliment.bind(null, aliment?.id ?? null), {});
  const [enSuppression, demarrer] = useTransition();
  const [erreurSuppr, setErreurSuppr] = useState<string>();
  const perso = !aliment || aliment.source === "perso";
  const [m, setM] = useState({
    p: aliment ? String(aliment.proteines_100) : "",
    g: aliment ? String(aliment.glucides_100) : "",
    l: aliment ? String(aliment.lipides_100) : "",
  });
  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  const kcalCalculees = Math.round(kcalDesMacros(n(m.p), n(m.g), n(m.l)));

  return (
    <form action={envoyer} className="flex flex-col gap-6">
      {perso ? (
        <>
          <Champ label="Nom de l’aliment" name="nom" required maxLength={200} defaultValue={aliment?.nom} placeholder="Skyr nature 0 %" />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">Valeurs pour 100 g (lis l’étiquette)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Champ label="Protéines (g)" name="proteines_100" inputMode="decimal" required value={m.p} onChange={(e) => setM({ ...m, p: e.target.value })} />
              <Champ label="Glucides (g)" name="glucides_100" inputMode="decimal" required value={m.g} onChange={(e) => setM({ ...m, g: e.target.value })} />
              <Champ label="Lipides (g)" name="lipides_100" inputMode="decimal" required value={m.l} onChange={(e) => setM({ ...m, l: e.target.value })} />
              <Champ
                label="Kcal"
                name="kcal_100"
                inputMode="decimal"
                defaultValue={aliment ? String(aliment.kcal_100) : ""}
                placeholder={String(kcalCalculees)}
                aide="Vide = calculé"
              />
            </div>
          </fieldset>
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl bg-creme/70 p-4 text-[14px]">
          <p>
            <strong className="font-medium">Table Ciqual (ANSES)</strong> · code {aliment.code_ciqual}
            {aliment.sous_groupe ? ` · ${aliment.sous_groupe}` : ""}
          </p>
          <p className="tabular-nums text-texte-2">
            Pour 100 g : {aliment.proteines_100} g protéines · {aliment.glucides_100} g glucides · {aliment.lipides_100} g lipides ·{" "}
            {aliment.kcal_100} kcal
          </p>
          {aliment.incomplet && (
            <p className="text-erreur">
              Valeurs incomplètes dans Ciqual (une valeur manquante est comptée 0). Préfère un autre aliment ou crée un aliment perso.
            </p>
          )}
        </div>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Vendu ou utilisé à l’unité ? (facultatif)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Nom de l’unité" name="nom_unite" maxLength={30} defaultValue={aliment?.nom_unite ?? ""} placeholder="œuf, tranche, carré…" />
          <Champ
            label="Poids moyen d’une unité (g)"
            name="poids_unite_g"
            inputMode="decimal"
            defaultValue={aliment?.poids_unite_g ? String(aliment.poids_unite_g) : ""}
            placeholder="50"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Catégories d’exclusion</legend>
        {aliment && !aliment.categories_verifiees && aliment.source === "ciqual" && (
          <Message ton="info">Catégories proposées automatiquement : vérifie-les, surtout pour les allergies.</Message>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories.map((c) => (
            <CaseACocher key={c.id} name="categories" value={c.id} label={c.nom} defaultChecked={aliment?.categories.includes(c.id)} />
          ))}
        </div>
      </fieldset>

      <CaseACocher
        name="actif"
        label="Proposé dans les recherches"
        aide="Décoche pour cacher un aliment que tu n’utilises jamais."
        defaultChecked={aliment?.actif ?? true}
      />

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      {erreurSuppr && <Message ton="erreur">{erreurSuppr}</Message>}
      <div className="flex flex-wrap gap-3">
        <BoutonEnvoi enCours="Enregistrement…">{aliment ? "Enregistrer" : "Ajouter l’aliment"}</BoutonEnvoi>
        {aliment?.source === "perso" && (
          <Bouton
            type="button"
            variante="danger"
            disabled={enSuppression}
            onClick={() => {
              if (confirm(`Supprimer « ${aliment.nom} » ?`)) demarrer(async () => setErreurSuppr((await supprimerAliment(aliment.id))?.erreur));
            }}
          >
            Supprimer
          </Bouton>
        )}
      </div>
    </form>
  );
}
