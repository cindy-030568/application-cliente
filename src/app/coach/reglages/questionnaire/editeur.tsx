"use client";

import { useState, useTransition } from "react";
import { Bouton, CaseACocher, Champ, Message, ZoneTexte } from "@/components/ui";
import { CIBLES, TYPES_QUESTION, type QuestionArrivee, type TypeQuestion } from "@/lib/questionnaire";
import { changerQuestionnaireActif, enregistrerQuestion, enregistrerTexteAccueil, supprimerQuestion, type EtatQuestion } from "./actions";

const AVEC_OPTIONS: TypeQuestion[] = ["choix", "choix_multiple", "objectif", "aliments"];

export function EditeurQuestion({ question, ordreSuivant }: { question?: QuestionArrivee; ordreSuivant?: number }) {
  const [type, setType] = useState<TypeQuestion>(question?.type ?? "texte");
  const [etat, setEtat] = useState<EtatQuestion>({});
  const [enCours, demarrer] = useTransition();
  // Identifiants uniques par question (plusieurs formulaires sur la même page).
  const k = question?.id ?? "nouvelle";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const formulaire = e.currentTarget;
        demarrer(async () => {
          const r = await enregistrerQuestion(question?.id ?? null, fd);
          setEtat(r);
          if (r.succes && !question) formulaire.reset();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_220px_90px]">
        <Champ id={`libelle-${k}`} label="Question" name="libelle" required maxLength={300} defaultValue={question?.libelle ?? ""} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-chocolat" htmlFor={`type-${k}`}>
            Type de réponse
          </label>
          <select
            id={`type-${k}`}
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as TypeQuestion)}
            className="min-h-12 rounded-xl border border-ligne bg-white px-3 text-[15px]"
          >
            {Object.entries(TYPES_QUESTION).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <Champ id={`ordre-${k}`} label="Ordre" name="ordre" type="number" min={0} max={10000} defaultValue={question?.ordre ?? ordreSuivant ?? 0} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ id={`section-${k}`} label="Section (titre du groupe)" name="section" maxLength={80} defaultValue={question?.section ?? ""} />
        <Champ id={`aide-${k}`} label="Aide sous la question (facultatif)" name="aide" maxLength={500} defaultValue={question?.aide ?? ""} />
      </div>
      {AVEC_OPTIONS.includes(type) && (
        <ZoneTexte
          label={type === "objectif" ? "Les 4 réponses, une par ligne, dans l’ordre : perte de gras, maintien, prise de muscle, tonification" : "Réponses possibles, une par ligne"}
          name="options"
          id={`options-${k}`}
          defaultValue={question?.options.join("\n") ?? ""}
          className="[&_textarea]:min-h-28"
        />
      )}
      {(type === "nombre" || type === "date") && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-chocolat" htmlFor={`cible-${k}`}>
            Pré-remplir dans ses besoins (facultatif)
          </label>
          <select id={`cible-${k}`} name="cible" defaultValue={question?.cible ?? ""} className="min-h-12 max-w-sm rounded-xl border border-ligne bg-white px-3 text-[15px]">
            <option value="">Non</option>
            {Object.entries(CIBLES)
              .filter(([c]) => (type === "date") === (c === "date_naissance"))
              .map(([c, l]) => (
                <option key={c} value={c}>
                  {l}
                </option>
              ))}
          </select>
        </div>
      )}
      {type === "aliments" && (
        <p className="text-[13.5px] text-texte-2">Tous les aliments s’affichent déjà cochés : elle décoche ceux qu’elle ne veut pas et écrit ceux à ajouter.</p>
      )}
      {type === "exclusions" && (
        <p className="text-[13.5px] text-texte-2">La cliente coche des catégories d’aliments (gluten, porc…) : elles sont ajoutées à ses exclusions de recettes.</p>
      )}
      <div className="flex flex-wrap gap-5">
        {type !== "exclusions" && <CaseACocher name="obligatoire" label="Obligatoire" defaultChecked={question?.obligatoire ?? false} />}
        <CaseACocher name="actif" label="Posée aux nouvelles clientes" defaultChecked={question?.actif ?? true} />
        <CaseACocher name="condition" value="sport" label="Seulement si suivi sportif" defaultChecked={question?.condition === "sport"} />
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div className="flex flex-wrap items-center gap-4">
        <Bouton type="submit" disabled={enCours} className="min-h-11">
          {enCours ? "Enregistrement…" : question ? "Enregistrer" : "Ajouter la question"}
        </Bouton>
        {question && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => {
              if (!window.confirm("Supprimer cette question ? Les réponses déjà reçues ne changent pas.")) return;
              demarrer(async () => setEtat(await supprimerQuestion(question.id)));
            }}
            className="text-[14px] text-texte-2 underline underline-offset-4 hover:text-erreur"
          >
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}

export function InterrupteurQuestionnaire({ actif }: { actif: boolean }) {
  const [valeur, setValeur] = useState(actif);
  const [enCours, demarrer] = useTransition();
  return (
    <CaseACocher
      label="Proposer le questionnaire aux nouvelles clientes, à leur première connexion (après le contrat)"
      checked={valeur}
      disabled={enCours}
      onChange={(e) => {
        const v = e.target.checked;
        setValeur(v);
        demarrer(async () => {
          const r = await changerQuestionnaireActif(v);
          if (r.erreur) setValeur(!v);
        });
      }}
    />
  );
}

export function TexteAccueil({ texte }: { texte: string }) {
  const [etat, setEtat] = useState<EtatQuestion>({});
  const [enCours, demarrer] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const valeur = String(new FormData(e.currentTarget).get("intro") ?? "");
        demarrer(async () => setEtat(await enregistrerTexteAccueil(valeur)));
      }}
    >
      <ZoneTexte id="intro-questionnaire" label="Texte d’accueil, en haut du questionnaire" name="intro" maxLength={5000} defaultValue={texte} className="[&_textarea]:min-h-40" />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <Bouton type="submit" variante="contour" disabled={enCours} className="min-h-11">
          Enregistrer le texte d’accueil
        </Bouton>
      </div>
    </form>
  );
}
