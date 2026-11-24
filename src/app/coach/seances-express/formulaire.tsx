"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton, CaseACocher, Champ, Message, ZoneTexte, cx } from "@/components/ui";
import { DUREES_EXPRESS, NIVEAUX_EXPRESS, type SeanceExpress } from "@/lib/seances-express";
import { enregistrerSeanceExpress, publierSeanceExpress, supprimerSeanceExpress, type EtatExpress } from "./actions";

const selecteur = "min-h-12 rounded-xl border border-ligne bg-white px-3 text-[16px] text-chocolat";

/** Création ou modification d'une séance express (le contenu vient de Claude, collé dans la zone). */
export function FormulaireSeanceExpress({
  initiale,
  listes,
  clientes,
  avecContenuActuel = false,
}: {
  initiale?: Omit<SeanceExpress, "contenu"> & { clientes: string[] };
  listes: { materiel: string[]; types: string[] };
  clientes: { id: string; nom: string }[];
  /** Modification : la zone « contenu » peut rester vide (on garde la séance actuelle). */
  avecContenuActuel?: boolean;
}) {
  const router = useRouter();
  const [etat, envoyer, enCours] = useActionState<EtatExpress, FormData>(async (avant, fd) => {
    const r = await enregistrerSeanceExpress(initiale?.id ?? null, avant, fd);
    if (r.succes && !initiale && r.id) router.push(`/coach/seances-express/${r.id}`);
    return r;
  }, {});
  const [visibilite, setVisibilite] = useState(initiale?.visibilite ?? "toutes");
  const types = initiale?.type && !listes.types.includes(initiale.type) ? [...listes.types, initiale.type] : listes.types;
  const materiels = [...listes.materiel, ...(initiale?.materiel ?? []).filter((m) => !listes.materiel.includes(m))];
  return (
    <form
      // Envoi manuel : en cas d'erreur, le texte collé reste là.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => envoyer(fd));
      }}
      className="flex flex-col gap-5"
    >
      <Champ label="Titre" name="titre" required maxLength={100} defaultValue={initiale?.titre} placeholder="ex. Cardio salon sans matériel" />
      <ZoneTexte label="Petite description (facultatif)" name="description" maxLength={500} defaultValue={initiale?.description ?? ""} className="[&_textarea]:min-h-20" />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Durée</span>
          <select name="duree" defaultValue={initiale?.duree_minutes ?? 15} className={selecteur}>
            {DUREES_EXPRESS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Type</span>
          <select name="type" defaultValue={initiale?.type ?? types[0]} className={selecteur}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Niveau</span>
          <select name="niveau" defaultValue={initiale?.niveau ?? "tous"} className={selecteur}>
            {NIVEAUX_EXPRESS.map((n) => (
              <option key={n.code} value={n.code}>
                {n.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Matériel</legend>
        <div className="flex flex-wrap gap-2">
          {materiels.map((m) => (
            <label key={m}>
              <input type="checkbox" name="materiel" value={m} defaultChecked={initiale?.materiel.includes(m)} className="peer sr-only" />
              <span className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-ligne bg-white px-3.5 text-[14px] peer-checked:border-chocolat peer-checked:bg-chocolat peer-checked:text-creme peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                {m}
              </span>
            </label>
          ))}
        </div>
        <span className="text-[12.5px] text-texte-2">Rien de coché = sans matériel. La liste se modifie dans Réglages.</span>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Qui peut la voir ?</legend>
        <div className="flex flex-wrap gap-2">
          {(["toutes", "certaines"] as const).map((v) => (
            <label key={v} className={cx("cursor-pointer rounded-full px-4 py-2 text-[14px]", visibilite === v ? "bg-chocolat text-creme" : "bg-creme hover:bg-sable")}>
              <input type="radio" name="visibilite" value={v} checked={visibilite === v} onChange={() => setVisibilite(v)} className="sr-only" />
              {v === "toutes" ? "Toutes les clientes" : "Certaines clientes"}
            </label>
          ))}
        </div>
        {visibilite === "certaines" && (
          <div className="grid gap-3 rounded-xl bg-creme/60 p-4 sm:grid-cols-2">
            {clientes.map((c) => (
              <CaseACocher key={c.id} name="clientes" value={c.id} label={c.nom} defaultChecked={initiale?.clientes.includes(c.id)} />
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <ZoneTexte
          label={avecContenuActuel ? "Nouvelle version de la séance (facultatif)" : "La séance, collée depuis Claude"}
          name="contenu"
          required={!avecContenuActuel}
          placeholder={'```json\n{ "nom": "…", "blocs": [ … ] }\n```'}
          className="[&_textarea]:min-h-48 [&_textarea]:font-mono [&_textarea]:text-[13px]"
        />
        <p className="text-[13px] text-texte-2">
          {avecContenuActuel ? "Laisse vide pour garder la séance actuelle. " : ""}Colle la réponse de Claude telle quelle (le bloc de code JSON).
        </p>
      </div>
      {!initiale && (
        <>
          <input type="hidden" name="avec_publication" value="1" />
          <CaseACocher name="publiee" label="Publiée tout de suite : visible par tes clientes (sinon, elle reste en brouillon)" defaultChecked={false} />
        </>
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <Bouton type="submit" disabled={enCours} className="w-fit">
        {enCours ? "Enregistrement…" : initiale ? "Enregistrer" : "Créer la séance"}
      </Bouton>
    </form>
  );
}

export function ActionsSeanceExpress({ id, publiee }: { id: string; publiee: boolean }) {
  const [etat, setEtat] = useState<EtatExpress>({});
  const [enCours, demarrer] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Bouton variante="contour" disabled={enCours} onClick={() => demarrer(async () => setEtat(await publierSeanceExpress(id, !publiee)))}>
        {publiee ? "Repasser en brouillon" : "Publier"}
      </Bouton>
      <Bouton
        variante="discret"
        disabled={enCours}
        onClick={() => {
          if (window.confirm("Supprimer cette séance express ? Les séances déjà faites par tes clientes restent dans leur historique."))
            demarrer(async () => {
              const r = await supprimerSeanceExpress(id);
              if (r.erreur) setEtat(r);
              else router.push("/coach/seances-express");
            });
        }}
      >
        Supprimer
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
