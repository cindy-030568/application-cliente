"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { Bouton, Message, classesBouton } from "@/components/ui";
import { importerProgramme, publierProgramme, renommerProgramme, supprimerProgramme, type EtatProgramme } from "../../programme-actions";

/** Copie un texte (consigne ou programme) pour le coller dans Claude. */
export function BoutonCopier({ texte, libelle, aide }: { texte: string; libelle: string; aide: string }) {
  const [etat, setEtat] = useState<"" | "ok" | "erreur">("");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Bouton
          type="button"
          variante="contour"
          className="min-h-11"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texte);
              setEtat("ok");
            } catch {
              setEtat("erreur");
            }
          }}
        >
          {etat === "ok" ? "Copié ✓" : libelle}
        </Bouton>
        <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" className="text-[14px] underline underline-offset-4">
          Ouvrir Claude
        </a>
      </div>
      <p className="text-[13px] text-texte-2">{aide}</p>
      {etat === "erreur" && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-erreur">La copie automatique n’a pas marché : affiche le texte</summary>
          <textarea readOnly value={texte} rows={10} className="mt-2 w-full rounded-lg border border-ligne bg-white p-2 text-[13px]" onFocus={(e) => e.currentTarget.select()} />
        </details>
      )}
    </div>
  );
}

/** Zone où la coach colle la réponse de Claude (nouveau programme, ou nouvelle version d'un programme). */
export function FormulaireImport({ clienteId, programmeId = null }: { clienteId: string; programmeId?: string | null }) {
  const [etat, action, enCours] = useActionState<EtatProgramme, FormData>(importerProgramme.bind(null, clienteId, programmeId), {});
  return (
    <form
      // Envoi manuel : en cas d'erreur, le texte collé reste là (une action de formulaire viderait le champ).
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => action(donnees));
      }}
      className="flex flex-col gap-3"
    >
      {!programmeId && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-texte-2">Titre (facultatif : sinon celui de Claude)</span>
          <input name="titre" maxLength={100} className="min-h-11 rounded-xl border border-ligne bg-white px-3 text-[15px]" />
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-texte-2">Réponse de Claude (colle tout, même le texte autour)</span>
        <textarea
          name="reponse"
          required
          rows={8}
          placeholder={'```json\n{\n  "titre": "…",\n  "seances": [ … ]\n}\n```'}
          className="rounded-xl border border-ligne bg-white px-3 py-2 font-mono text-[13px]"
        />
      </label>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <Bouton type="submit" disabled={enCours}>
          {enCours ? "Lecture…" : programmeId ? "Remplacer par cette version" : "Importer le programme"}
        </Bouton>
      </div>
    </form>
  );
}

export function ActionsProgramme({ clienteId, programmeId, publie, prenom, titre }: { clienteId: string; programmeId: string; publie: boolean; prenom: string; titre: string }) {
  const [etat, setEtat] = useState<EtatProgramme>({});
  const [enCours, demarrer] = useTransition();
  const [nom, setNom] = useState(titre);
  const lancer = (f: () => Promise<EtatProgramme>) => demarrer(async () => setEtat(await f()));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Titre du programme"
          value={nom}
          maxLength={100}
          onChange={(e) => setNom(e.target.value)}
          className="min-h-11 min-w-0 flex-1 basis-60 rounded-xl border border-ligne bg-white px-3 text-[15px]"
        />
        {nom.trim() !== titre && (
          <button type="button" disabled={enCours} onClick={() => lancer(() => renommerProgramme(clienteId, programmeId, nom))} className={classesBouton("contour").replace("min-h-12", "min-h-11")}>
            Renommer
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Bouton type="button" disabled={enCours} onClick={() => lancer(() => publierProgramme(clienteId, programmeId, true))}>
          {publie ? "Republier (la prévenir)" : `Publier pour ${prenom}`}
        </Bouton>
        {publie && (
          <Bouton type="button" variante="contour" disabled={enCours} onClick={() => lancer(() => publierProgramme(clienteId, programmeId, false))}>
            Retirer de son appli
          </Bouton>
        )}
        <Bouton
          type="button"
          variante="danger"
          disabled={enCours}
          onClick={() => {
            if (window.confirm("Supprimer ce programme ? Il disparaîtra aussi de son application s’il est publié.")) lancer(() => supprimerProgramme(clienteId, programmeId));
          }}
        >
          Supprimer
        </Bouton>
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
