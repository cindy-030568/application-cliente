"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Champ, Etiquette, Message, ZoneTexte, cx } from "@/components/ui";
import { parSection } from "@/lib/champs";
import type { ChampMesure, TypeChamp } from "@/lib/types";
import {
  ajouterChamp,
  basculerChamp,
  deplacerChamp,
  modifierChamp,
  reglerFenetre,
  reglerIntro,
  renommerSection,
} from "./champs-actions";

const TYPES: Record<TypeChamp, string> = {
  texte: "Réponse libre",
  choix: "Choix",
  echelle: "Note de 1 à 10",
  nombre: "Mesure (nombre)",
};

export function GestionChamps({
  champs,
  fenetre,
  intro,
}: {
  champs: ChampMesure[];
  fenetre: number;
  intro: string;
}) {
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const [etatAjout, ajouter] = useActionState(ajouterChamp, {});
  const [etatFenetre, regler] = useActionState(reglerFenetre, {});
  const [etatIntro, enregistrerIntro] = useActionState(reglerIntro, {});
  const [type, setType] = useState<TypeChamp>("texte");
  const lancer = (fn: () => Promise<{ erreur?: string }>) => demarrer(async () => setErreur((await fn()).erreur));

  const ordonnes = [...champs].sort((a, b) => a.ordre - b.ordre);
  const sections = parSection(ordonnes);

  return (
    <div className="flex flex-col gap-7">
      <form action={enregistrerIntro} className="flex flex-col gap-3">
        <ZoneTexte
          label="Texte d’introduction du bilan"
          name="intro_bilan"
          maxLength={600}
          defaultValue={intro}
          className="[&_textarea]:min-h-24"
        />
        <p className="-mt-1 text-[12.5px] text-texte-2">
          Astuce : écris <code>{"{jours}"}</code> pour afficher le rythme de bilan de chaque cliente (ex. « ces 15 derniers
          jours »). Ça marche aussi dans les questions.
        </p>
        {etatIntro.erreur && <Message ton="erreur">{etatIntro.erreur}</Message>}
        <div className="flex items-center gap-3">
          <BoutonEnvoi variante="contour">Enregistrer le texte</BoutonEnvoi>
          {etatIntro.succes && <span className="text-[14px] text-succes">{etatIntro.succes}</span>}
        </div>
      </form>

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

      {sections.map(({ section, champs: liste }) => (
        <div key={section} className="flex flex-col gap-2">
          <input
            defaultValue={section}
            aria-label={`Nom de la rubrique ${section}`}
            maxLength={60}
            className="min-h-10 w-full max-w-md rounded-lg border border-transparent bg-transparent px-2 font-titre text-lg font-bold hover:border-ligne focus:border-chocolat focus:bg-white focus:outline-none"
            onBlur={(e) => {
              const v = e.currentTarget.value;
              if (v.trim() && v !== section) lancer(() => renommerSection(section, v));
            }}
          />
          <ul className="flex flex-col gap-2">
            {liste.map((c) => {
              const i = ordonnes.findIndex((x) => x.id === c.id);
              return (
                <li
                  key={c.id}
                  className={cx(
                    "flex flex-wrap items-center gap-3 rounded-xl border border-ligne p-3",
                    !c.actif && "opacity-55",
                  )}
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
                      disabled={enCours || i === ordonnes.length - 1}
                      onClick={() => lancer(() => deplacerChamp(c.id, 1))}
                      className="text-[12px] leading-none text-texte-2 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    defaultValue={c.libelle}
                    aria-label="Question"
                    maxLength={140}
                    className="min-h-10 min-w-0 flex-1 basis-64 rounded-lg border border-ligne bg-white px-3 text-[15px]"
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
                        if (v !== (c.unite ?? ""))
                          lancer(() => modifierChamp(c.id, { libelle: c.libelle, aide: c.aide ?? "", unite: v }));
                      }}
                    />
                  )}
                  <Etiquette ton={c.groupe === "mesure" ? "sable" : "rose"}>
                    {TYPES[c.type]}
                    {c.avec_precision ? " + précision" : ""}
                  </Etiquette>
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
                  <input
                    defaultValue={c.aide ?? ""}
                    aria-label={`Aide de ${c.libelle}`}
                    placeholder="Aide affichée sous la question (facultatif)"
                    maxLength={160}
                    className="min-h-9 w-full rounded-lg border border-dashed border-ligne bg-white/60 px-3 text-[13.5px] text-texte-2"
                    onBlur={(e) => {
                      const v = e.currentTarget.value;
                      if (v !== (c.aide ?? ""))
                        lancer(() => modifierChamp(c.id, { libelle: c.libelle, aide: v, unite: c.unite ?? "" }));
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {erreur && <Message ton="erreur">{erreur}</Message>}

      <form action={ajouter} className="flex flex-col gap-4 rounded-xl bg-creme/60 p-4" key={champs.length}>
        <p className="font-medium">Ajouter une question au bilan</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ label="Question" name="libelle" required maxLength={140} placeholder="Comment s’est passée ta semaine ?" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="type-champ" className="text-sm font-medium">
              Type de réponse
            </label>
            <select
              id="type-champ"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as TypeChamp)}
              className="min-h-12 rounded-xl border border-ligne bg-white px-4 text-[16px]"
            >
              {Object.entries(TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="section-champ" className="text-sm font-medium">
              Rubrique
            </label>
            <input
              id="section-champ"
              name="section"
              list="sections-existantes"
              defaultValue={type === "nombre" ? "Mes mesures" : sections[0]?.section}
              key={type}
              maxLength={60}
              className="min-h-12 rounded-xl border border-ligne bg-white px-4 text-[16px]"
            />
            <datalist id="sections-existantes">
              {sections.map((s) => (
                <option key={s.section} value={s.section} />
              ))}
            </datalist>
          </div>
          {type === "nombre" && <Champ label="Unité" name="unite" maxLength={10} placeholder="cm, kg, pas…" />}
          {type === "choix" && (
            <Champ label="Choix possibles (séparés par des virgules)" name="options" placeholder="Oui, Plutôt oui, Pas vraiment" />
          )}
          <Champ label="Aide (facultatif)" name="aide" maxLength={160} placeholder="Une précision sous la question" />
        </div>
        {(type === "choix" || type === "echelle") && (
          <CaseACocher
            name="avec_precision"
            label="Proposer « Préciser si tu veux »"
            aide="Ajoute une petite zone de texte facultative sous la réponse."
          />
        )}
        {etatAjout.erreur && <Message ton="erreur">{etatAjout.erreur}</Message>}
        {etatAjout.succes && <Message ton="succes">{etatAjout.succes}</Message>}
        <div>
          <BoutonEnvoi variante="sombre">Ajouter</BoutonEnvoi>
        </div>
      </form>
      <p className="text-[13px] text-texte-2">
        Une question décochée n’est plus posée dans les nouveaux bilans, mais les anciennes réponses sont conservées.
      </p>
    </div>
  );
}
