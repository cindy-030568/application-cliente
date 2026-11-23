"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bouton, Message, cx } from "@/components/ui";
import { parSection, type QuestionArrivee } from "@/lib/questionnaire";
import { envoyerQuestionnaire, type EtatQuestionnaire } from "./actions";

const champ = "rounded-xl border border-ligne bg-white px-4 py-3 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale";

export function FormulaireQuestionnaire({ questions, categories }: { questions: QuestionArrivee[]; categories: { id: string; nom: string }[] }) {
  const [etat, setEtat] = useState<EtatQuestionnaire>({});
  const [enCours, demarrer] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        demarrer(async () => {
          const r = await envoyerQuestionnaire(fd);
          setEtat(r);
          if (r.envoye) router.replace("/");
          else window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }}
    >
      {etat.erreur && (
        <Message ton="erreur">
          {etat.erreur}
          {etat.manquantes?.length ? ` (${etat.manquantes.join(" · ")})` : ""}
        </Message>
      )}
      {parSection(questions).map(({ section, questions: liste }) => (
        <fieldset key={section} className="flex flex-col gap-5 rounded-bloc bg-blanc-casse p-5 shadow-douce">
          {section && <legend className="mb-1 font-titre text-[20px] font-bold">{section}</legend>}
          {liste.map((q) => (
            <Question key={q.id} q={q} categories={categories} manquante={Boolean(etat.manquantes?.includes(q.libelle))} />
          ))}
        </fieldset>
      ))}
      <Bouton type="submit" pleineLargeur className="min-h-14 text-[16.5px]" disabled={enCours}>
        {enCours ? "Envoi…" : "Envoyer mes réponses ✨"}
      </Bouton>
    </form>
  );
}

function Question({ q, categories, manquante }: { q: QuestionArrivee; categories: { id: string; nom: string }[]; manquante: boolean }) {
  const nom = `q_${q.id}`;
  const titre = (
    <span className="text-[15.5px] font-medium">
      {q.libelle}
      {q.obligatoire && <span className="text-accent"> *</span>}
    </span>
  );
  const aide = q.aide ? <span className="text-[13.5px] text-texte-2">{q.aide}</span> : null;
  const cadre = cx("flex flex-col gap-2", manquante && "rounded-xl outline outline-2 outline-offset-4 outline-erreur");
  if (q.type === "texte" || q.type === "texte_long") {
    return (
      <label className={cadre}>
        {titre}
        {aide}
        {q.type === "texte" ? (
          <input name={nom} required={q.obligatoire} maxLength={300} className={champ} />
        ) : (
          <textarea name={nom} required={q.obligatoire} maxLength={2000} rows={3} className={champ} />
        )}
      </label>
    );
  }
  if (q.type === "exclusions") {
    return (
      <fieldset className={cadre}>
        <legend className="mb-2 flex flex-col gap-1">
          {titre}
          {aide}
        </legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Puce key={c.id} type="checkbox" nom={nom} valeur={c.id} libelle={c.nom} />
          ))}
        </div>
        <input name={`${nom}_autres`} maxLength={500} placeholder="Autres aliments (ex. champignons, avocat…)" className={champ} />
      </fieldset>
    );
  }
  const multiple = q.type === "choix_multiple";
  return (
    <fieldset className={cadre}>
      <legend className="mb-2 flex flex-col gap-1">
        {titre}
        {aide}
      </legend>
      <div className="flex flex-col gap-2">
        {q.options.map((o) => (
          <Puce key={o} type={multiple ? "checkbox" : "radio"} nom={nom} valeur={o} libelle={o} requis={!multiple && q.obligatoire} large />
        ))}
      </div>
    </fieldset>
  );
}

function Puce({ type, nom, valeur, libelle, requis = false, large = false }: { type: "radio" | "checkbox"; nom: string; valeur: string; libelle: string; requis?: boolean; large?: boolean }) {
  return (
    <label className={cx("cursor-pointer", large && "w-full")}>
      <input type={type} name={nom} value={valeur} required={requis} className="peer sr-only" />
      <span
        className={cx(
          "flex min-h-11 items-center rounded-xl border border-ligne bg-white px-4 py-2 text-[15px] transition-colors peer-checked:border-accent peer-checked:bg-accent-pale peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
          !large && "rounded-full",
        )}
      >
        {libelle}
      </span>
    </label>
  );
}
