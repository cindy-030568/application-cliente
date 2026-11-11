"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Champ, Etiquette, Message, cx } from "@/components/ui";
import type { ChampMesure } from "@/lib/types";
import { ajouterChamp, basculerChamp, deplacerChamp, modifierChamp, reglerFenetre } from "./champs-actions";

const TYPES = { nombre: "Mesure (nombre)", echelle: "Ressenti de 1 à 10", choix: "Choix" } as const;

export function GestionChamps({ champs, fenetre }: { champs: ChampMesure[]; fenetre: number }) {
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const [etatAjout, ajouter] = useActionState(ajouterChamp, {});
  const [etatFenetre, regler] = useActionState(reglerFenetre, {});
  const [type, setType] = useState<keyof typeof TYPES>("nombre");
  const lancer = (fn: () => Promise<{ erreur?: string }>) =>
    demarrer(async () => setErreur((await fn()).erreur));

  return (
    <div className="flex flex-col gap-6">
      <form action={regler} className="flex flex-wrap items-end gap-3">
        <Champ
          label="Le bilan s’ouvre … jours avant la date prévue"
          name="fenetre_bilan_jours"
          type="number"
          min={0}
          max={14}
          defaultValue={fenetre}
          className="w-64"
        />
        <BoutonEnvoi variante="contour">Enregistrer</BoutonEnvoi>
        {etatFenetre.erreur && <Message ton="erreur">{etatFenetre.erreur}</Message>}
        {etatFenetre.succes && <span className="text-[14px] text-succes">{etatFenetre.succes}</span>}
      </form>

      <ul className="flex flex-col gap-2">
        {champs.map((c, i) => (
          <li
            key={c.id}
            className={cx("flex flex-wrap items-center gap-3 rounded-xl border border-ligne p-3", !c.actif && "opacity-60")}
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Monter ${c.libelle}`}
                disabled={enCours || i === 0}
                onClick={() => lancer(() => deplacerChamp(c.id, -1))}
                className="text-[12px] leading-none text-texte-2 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={`Descendre ${c.libelle}`}
                disabled={enCours || i === champs.length - 1}
                onClick={() => lancer(() => deplacerChamp(c.id, 1))}
                className="text-[12px] leading-none text-texte-2 disabled:opacity-30"
              >
                ▼
              </button>
            </div>
            <input
              defaultValue={c.libelle}
              aria-label="Nom du champ"
              maxLength={60}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-ligne bg-white px-3 text-[15px]"
              onBlur={(e) => {
                const v = e.currentTarget.value;
                if (v.trim() && v !== c.libelle)
                  lancer(() => modifierChamp(c.id, { libelle: v, aide: c.aide ?? "", unite: c.unite ?? "" }));
              }}
            />
            {c.type === "nombre" && (
              <input
                defaultValue={c.unite ?? ""}
                aria-label={`Unité de ${c.libelle}`}
                placeholder="unité"
                maxLength={10}
                className="min-h-10 w-20 rounded-lg border border-ligne bg-white px-3 text-[15px]"
                onBlur={(e) => {
                  const v = e.currentTarget.value;
                  if (v !== (c.unite ?? "")) lancer(() => modifierChamp(c.id, { libelle: c.libelle, aide: c.aide ?? "", unite: v }));
                }}
              />
            )}
            <Etiquette ton={c.groupe === "mesure" ? "sable" : "rose"}>{TYPES[c.type]}</Etiquette>
            <label className="flex cursor-pointer items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={c.actif}
                disabled={enCours}
                onChange={(e) => lancer(() => basculerChamp(c.id, e.target.checked))}
                className="size-5 accent-[var(--accent)]"
              />
              Visible
            </label>
          </li>
        ))}
      </ul>
      {erreur && <Message ton="erreur">{erreur}</Message>}

      <form action={ajouter} className="flex flex-col gap-4 rounded-xl bg-creme/60 p-4" key={champs.length}>
        <p className="font-medium">Ajouter un champ au bilan</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ label="Nom" name="libelle" required maxLength={60} placeholder="Tour de mollet, Hydratation…" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="type-champ" className="text-sm font-medium">
              Type
            </label>
            <select
              id="type-champ"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as keyof typeof TYPES)}
              className="min-h-12 rounded-xl border border-ligne bg-white px-4 text-[16px]"
            >
              {Object.entries(TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {type === "nombre" && <Champ label="Unité" name="unite" maxLength={10} placeholder="cm, kg, pas…" />}
          {type === "choix" && (
            <Champ label="Choix possibles (séparés par des virgules)" name="options" placeholder="Oui, Non, Un peu" />
          )}
          <Champ label="Aide (facultatif)" name="aide" maxLength={160} placeholder="Comment mesurer, que signifie 1 et 10…" />
        </div>
        {etatAjout.erreur && <Message ton="erreur">{etatAjout.erreur}</Message>}
        {etatAjout.succes && <Message ton="succes">{etatAjout.succes}</Message>}
        <div>
          <BoutonEnvoi variante="sombre">Ajouter</BoutonEnvoi>
        </div>
      </form>
      <p className="text-[13px] text-texte-2">
        Un champ décoché n’est plus proposé dans les nouveaux bilans, mais son historique est conservé.
      </p>
    </div>
  );
}
