"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Message, cx } from "@/components/ui";
import { enregistrerJournee, type EtatJournal } from "@/app/journal-actions";
import type { EntreeJournal } from "@/lib/journal";
import { SYMPTOMES } from "@/lib/cycle";

const champ =
  "min-h-12 w-full rounded-xl border border-ligne bg-white px-4 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale";
const fr = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const heures = (h: number | null | undefined) => {
  if (h === null || h === undefined) return "";
  const entier = Math.floor(h);
  const min = Math.round((h - entier) * 60);
  return min ? `${entier}h${String(min).padStart(2, "0")}` : `${entier}h`;
};

function Saisie({ label, aide, unite, ...props }: React.ComponentProps<"input"> & { label: string; aide?: string; unite?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="relative">
        <input className={cx(champ, unite && "pr-12")} autoComplete="off" {...props} />
        {unite && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-texte-2">{unite}</span>}
      </span>
      {aide && <span className="text-[12.5px] text-texte-2">{aide}</span>}
    </label>
  );
}

function Notes({ nom, label, legende, valeurs, initiale }: { nom: string; label: string; legende: string; valeurs: number[]; initiale: number | null }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-2">
        {valeurs.map((v) => (
          <label key={v} className="flex-1">
            <input type="radio" name={nom} value={v} defaultChecked={initiale === v} className="peer sr-only" />
            <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-ligne bg-white text-[15px] font-medium transition-colors peer-checked:border-chocolat peer-checked:bg-chocolat peer-checked:text-creme peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
              {v}
            </span>
          </label>
        ))}
      </div>
      <span className="text-[12.5px] text-texte-2">{legende}</span>
    </fieldset>
  );
}

/** Saisie d'une journée du journal (pré-remplie si elle existe déjà). */
export function FormulaireJournee({
  jour,
  entree,
  sansChiffres,
  suivant,
  symptomes,
  simple = false,
  base = "/suivi/journal",
}: {
  /** Adresse de la page du journal (pour « jour oublié suivant »). */
  base?: string;
  /** Journal simple (abonnées) : poids facultatif, eau, sommeil, pas, énergie, stress, digestion. */
  simple?: boolean;
  jour: string;
  entree: EntreeJournal | null;
  sansChiffres: boolean;
  /** Suivi de la périménopause choisi : symptômes du jour déjà notés (sinon, pas de case proposée). */
  symptomes?: string[] | null;
  /** Prochain jour oublié à remplir, proposé après l'enregistrement. */
  suivant?: { jour: string; libelle: string } | null;
}) {
  const [etat, envoyer] = useActionState<EtatJournal, FormData>(enregistrerJournee, {});
  return (
    <form action={envoyer} className="flex flex-col gap-5">
      <input type="hidden" name="jour" value={jour} />
      {!sansChiffres && !simple && (
        <div className="grid grid-cols-2 gap-3">
          <Saisie label="Poids" name="poids" inputMode="decimal" unite="kg" defaultValue={fr(entree?.poids)} placeholder="ex. 61,4" aide="À jeun, après passage aux toilettes" />
          <Saisie label="Tour de taille" name="tour_taille" inputMode="decimal" unite="cm" defaultValue={fr(entree?.tour_taille)} placeholder="ex. 77" />
        </div>
      )}
      {simple && (
        <>
          <input type="hidden" name="energie_proposee" value="1" />
          <Notes nom="energie" label="Mon énergie" legende="1 = à plat · 5 = en pleine forme" valeurs={[1, 2, 3, 4, 5]} initiale={entree?.energie ?? null} />
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Saisie label="Sommeil" name="sommeil" inputMode="text" defaultValue={heures(entree?.sommeil)} placeholder="ex. 7h30" aide="Nombre d’heures" />
        <Saisie label="Hydratation" name="hydratation" inputMode="decimal" unite="L" defaultValue={fr(entree?.hydratation)} placeholder="ex. 1,8" />
      </div>
      {simple ? (
        <Saisie label="Pas" name="pas" inputMode="numeric" defaultValue={entree?.pas ?? ""} placeholder="ex. 8500" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Saisie label="Pas (NEAT)" name="pas" inputMode="numeric" defaultValue={entree?.pas ?? ""} placeholder="ex. 8500" />
          <Notes nom="trainings" label="Trainings" legende="Séances du jour" valeurs={[0, 1, 2]} initiale={entree?.trainings ?? null} />
        </div>
      )}
      <Notes nom="stress" label="Stress" legende="1 = pas de stress · 5 = stress +++" valeurs={[1, 2, 3, 4, 5]} initiale={entree?.stress ?? null} />
      <Notes nom="digestion" label="Digestion" legende="1 = mauvaise digestion · 5 = digestion ok" valeurs={[1, 2, 3, 4, 5]} initiale={entree?.digestion ?? null} />
      {!simple && (
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" name="regles" defaultChecked={entree?.regles ?? false} className="size-5 accent-[var(--accent)]" />
          <span className="text-[15px]">J’ai mes règles aujourd’hui</span>
        </label>
      )}
      {simple && !sansChiffres && (
        <Saisie label="Poids (facultatif)" name="poids" inputMode="decimal" unite="kg" defaultValue={fr(entree?.poids)} placeholder="ex. 61,4" aide="Seulement si tu en as envie. Tu peux masquer les chiffres dans ton profil." />
      )}
      {symptomes && (
        <fieldset className="flex flex-col gap-2">
          <input type="hidden" name="symptomes_proposes" value="1" />
          <legend className="text-sm font-medium">Mes symptômes du jour</legend>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMES.map((x) => (
              <label key={x.code}>
                <input type="checkbox" name="symptomes" value={x.code} defaultChecked={symptomes.includes(x.code)} className="peer sr-only" />
                <span className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-ligne bg-white px-3.5 text-[14px] transition-colors peer-checked:border-chocolat peer-checked:bg-chocolat peer-checked:text-creme peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  {x.libelle}
                </span>
              </label>
            ))}
          </div>
          <span className="text-[12.5px] text-texte-2">Coche ce que tu ressens, rien si tout va bien. Visible seulement par toi et moi.</span>
        </fieldset>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Observations</span>
        <textarea
          name="observations"
          rows={3}
          maxLength={1000}
          defaultValue={entree?.observations ?? ""}
          placeholder={simple ? "Faim, moral, un petit mot pour toi…" : "Énergie, faim, moral, événement particulier…"}
          className="rounded-xl border border-ligne bg-white px-4 py-3 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale"
        />
      </label>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      {etat.doux && <Message ton="info">{etat.doux}</Message>}
      {etat.succes && suivant && (
        <Link href={`${base}?jour=${suivant.jour}`} className="self-center text-[14.5px] font-medium underline underline-offset-4">
          Remplir le jour oublié suivant : {suivant.libelle} →
        </Link>
      )}
      <BoutonEnvoi pleineLargeur enCours="Enregistrement…">
        {entree ? "Mettre à jour ma journée" : "Enregistrer ma journée"}
      </BoutonEnvoi>
      <p className="-mt-2 text-center text-[12.5px] text-texte-2">Remplis ce que tu peux : tout est facultatif.</p>
    </form>
  );
}
