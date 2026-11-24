"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { IconeExterne, IconePlus } from "@/components/icones";
import { Bouton, CaseACocher, Champ, Etiquette, Message, ZoneTexte, cx } from "@/components/ui";
import type { CategorieRessource, Ressource } from "@/lib/types";
import {
  ajouterCategorie,
  enregistrerRessource,
  renommerCategorie,
  supprimerCategorie,
  supprimerRessource,
  type EtatRessource,
} from "./actions";

export type RessourceAvecClientes = Ressource & { clientes: string[] };
export type ClienteChoix = { id: string; nom: string };

export function GestionRessources({
  categories,
  ressources,
  clientes,
  avecFiches = false,
}: {
  categories: CategorieRessource[];
  ressources: RessourceAvecClientes[];
  clientes: ClienteChoix[];
  /** Fiches écrites dans l'appli et brouillons (après la mise à jour 0037). */
  avecFiches?: boolean;
}) {
  const [edition, setEdition] = useState<string | "nouvelle" | null>(ressources.length ? null : "nouvelle");
  const [etat, setEtat] = useState<EtatRessource>({});
  const [enCours, demarrer] = useTransition();
  const nomCliente = new Map(clientes.map((c) => [c.id, c.nom]));

  const groupes = [
    ...categories.map((c) => ({ id: c.id, nom: c.nom })),
    { id: null as string | null, nom: "Autres" },
  ]
    .map((g) => ({ ...g, items: ressources.filter((r) => r.categorie_id === g.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {edition === "nouvelle" ? (
        <FormulaireRessource
          categories={categories}
          clientes={clientes}
          avecFiches={avecFiches}
          onFin={(r) => {
            setEtat(r);
            setEdition(null);
          }}
          onAnnuler={ressources.length ? () => setEdition(null) : undefined}
        />
      ) : (
        <div>
          <Bouton onClick={() => setEdition("nouvelle")}>
            <IconePlus className="size-5" /> Nouvelle ressource
          </Bouton>
        </div>
      )}

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}

      {groupes.map((g) => (
        <section key={g.id ?? "autres"} className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">{g.nom}</h2>
          <ul className="flex flex-col gap-3">
            {g.items.map((r) =>
              edition === r.id ? (
                <li key={r.id}>
                  <FormulaireRessource
                    categories={categories}
                    clientes={clientes}
                    avecFiches={avecFiches}
                    initiale={r}
                    onFin={(res) => {
                      setEtat(res);
                      setEdition(null);
                    }}
                    onAnnuler={() => setEdition(null)}
                  />
                </li>
              ) : (
                <li key={r.id} className="flex flex-wrap items-start gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium hover:text-accent"
                      >
                        {r.titre} <IconeExterne className="size-4 shrink-0" />
                      </a>
                    ) : (
                      <Link href={`/coach/ressources/${r.id}`} className="font-medium hover:text-accent">
                        {r.titre} <span className="text-[13px] font-normal text-texte-2">· fiche dans l’appli (aperçu)</span>
                      </Link>
                    )}
                    {r.description && <p className="text-[14px] text-texte-2">{r.description}</p>}
                    <div className="mt-1 flex flex-wrap gap-2">
                      {r.publiee === false && <Etiquette ton="rose">Brouillon : invisible pour tes clientes</Etiquette>}
                      {r.visibilite === "toutes" ? (
                        <Etiquette ton="vert">Toutes les clientes</Etiquette>
                      ) : (
                        <Etiquette ton="sable">
                          {r.clientes.map((id) => nomCliente.get(id) ?? "ancienne cliente").join(", ")}
                        </Etiquette>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 text-[14px]">
                    <button
                      type="button"
                      className="underline underline-offset-4 hover:text-accent"
                      onClick={() => setEdition(r.id)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      disabled={enCours}
                      className="text-texte-2 underline underline-offset-4 hover:text-erreur"
                      onClick={() => {
                        if (confirm(`Supprimer « ${r.titre} » ?`))
                          demarrer(async () => setEtat(await supprimerRessource(r.id)));
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FormulaireRessource({
  categories,
  clientes,
  avecFiches,
  initiale,
  onFin,
  onAnnuler,
}: {
  categories: CategorieRessource[];
  clientes: ClienteChoix[];
  avecFiches: boolean;
  initiale?: RessourceAvecClientes;
  onFin: (etat: EtatRessource) => void;
  onAnnuler?: () => void;
}) {
  const [visibilite, setVisibilite] = useState(initiale?.visibilite ?? "toutes");
  const [type, setType] = useState<"lien" | "fiche">(initiale && !initiale.url ? "fiche" : "lien");
  const [etat, envoyer] = useActionState(async (precedent: EtatRessource, fd: FormData) => {
    const r = await enregistrerRessource(precedent, fd);
    if (!r.erreur) onFin(r);
    return r;
  }, {});

  return (
    <form action={envoyer} className="flex flex-col gap-4 rounded-carte border border-ligne bg-blanc-casse p-5 shadow-douce">
      {initiale && <input type="hidden" name="id" value={initiale.id} />}
      {avecFiches && <input type="hidden" name="avec_fiches" value="1" />}
      <Champ label="Titre" name="titre" required maxLength={120} defaultValue={initiale?.titre} />
      {avecFiches && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm font-medium">Type de ressource</legend>
          {(["lien", "fiche"] as const).map((v) => (
            <label
              key={v}
              className={cx(
                "cursor-pointer rounded-full px-4 py-2 text-[14px] transition-colors",
                type === v ? "bg-chocolat text-creme" : "bg-creme text-chocolat hover:bg-sable",
              )}
            >
              <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
              {v === "lien" ? "Un lien (Drive, PDF…)" : "Une fiche écrite ici"}
            </label>
          ))}
        </fieldset>
      )}
      {type === "fiche" ? (
        <div className="flex flex-col gap-1.5">
          <ZoneTexte
            label="Contenu de la fiche"
            name="contenu"
            required
            maxLength={20000}
            defaultValue={initiale?.contenu ?? ""}
            className="[&_textarea]:min-h-96 [&_textarea]:text-[15px]"
          />
          <p className="text-[13px] text-texte-2">
            « ## » en début de ligne pour un intertitre, « - » pour une liste, **texte** pour le gras, une ligne vide entre deux paragraphes.
          </p>
        </div>
      ) : (
        <Champ
          label="Lien (Google Drive ou autre)"
          name="url"
          type="url"
          required
          placeholder="https://drive.google.com/…"
          defaultValue={initiale?.url ?? ""}
          aide="Dans Drive : Partager → « Tous les utilisateurs disposant du lien » → Copier le lien. Un dossier entier fonctionne aussi."
        />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="categorie_id" className="text-sm font-medium">
          Catégorie
        </label>
        <select
          id="categorie_id"
          name="categorie_id"
          defaultValue={initiale?.categorie_id ?? categories[0]?.id ?? ""}
          className="min-h-12 rounded-xl border border-ligne bg-white px-4 text-[16px]"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
          <option value="">Autres</option>
        </select>
      </div>
      <ZoneTexte
        label="Courte description (facultatif)"
        name="description"
        maxLength={500}
        defaultValue={initiale?.description ?? ""}
        className="[&_textarea]:min-h-20"
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Qui peut la voir ?</legend>
        <div className="flex flex-wrap gap-2">
          {(["toutes", "certaines"] as const).map((v) => (
            <label
              key={v}
              className={cx(
                "cursor-pointer rounded-full px-4 py-2 text-[14px] transition-colors",
                visibilite === v ? "bg-chocolat text-creme" : "bg-creme text-chocolat hover:bg-sable",
              )}
            >
              <input
                type="radio"
                name="visibilite"
                value={v}
                checked={visibilite === v}
                onChange={() => setVisibilite(v)}
                className="sr-only"
              />
              {v === "toutes" ? "Toutes les clientes" : "Certaines clientes"}
            </label>
          ))}
        </div>
        {visibilite === "certaines" && (
          <div className="grid gap-3 rounded-xl bg-creme/60 p-4 sm:grid-cols-2">
            {clientes.length === 0 && <p className="text-[14px] text-texte-2">Aucune cliente pour l’instant.</p>}
            {clientes.map((c) => (
              <CaseACocher
                key={c.id}
                name="clientes"
                value={c.id}
                label={c.nom}
                defaultChecked={initiale?.clientes.includes(c.id)}
              />
            ))}
          </div>
        )}
      </fieldset>
      {avecFiches && (
        <CaseACocher
          name="publiee"
          label="Publiée : visible par tes clientes (décoche pour la garder en brouillon)"
          defaultChecked={initiale?.publiee ?? true}
        />
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <div className="flex gap-3">
        <BoutonEnvoi enCours="Enregistrement…">{initiale ? "Enregistrer" : "Ajouter la ressource"}</BoutonEnvoi>
        {onAnnuler && (
          <Bouton type="button" variante="discret" onClick={onAnnuler}>
            Annuler
          </Bouton>
        )}
      </div>
    </form>
  );
}

export function GestionCategories({ categories }: { categories: CategorieRessource[] }) {
  const [etat, envoyer] = useActionState(ajouterCategorie, {});
  const [message, setMessage] = useState<EtatRessource>({});
  const [, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <input
              defaultValue={c.nom}
              aria-label={`Nom de la catégorie ${c.nom}`}
              maxLength={60}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-ligne bg-white px-3 text-[15px]"
              onBlur={(e) => {
                const nom = e.currentTarget.value;
                if (nom.trim() && nom !== c.nom) demarrer(async () => setMessage(await renommerCategorie(c.id, nom)));
              }}
            />
            <button
              type="button"
              className="shrink-0 px-1 text-[13px] text-texte-2 underline underline-offset-4 hover:text-erreur"
              onClick={() => {
                if (confirm(`Supprimer la catégorie « ${c.nom} » ?`))
                  demarrer(async () => setMessage(await supprimerCategorie(c.id)));
              }}
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
      <form action={envoyer} className="flex flex-col gap-3" key={categories.length}>
        <Champ label="Nouvelle catégorie" name="nom" maxLength={60} />
        <BoutonEnvoi variante="contour">Ajouter la catégorie</BoutonEnvoi>
      </form>
      {(etat.erreur || message.erreur) && <Message ton="erreur">{etat.erreur ?? message.erreur}</Message>}
      {message.succes && <Message ton="succes">{message.succes}</Message>}
    </div>
  );
}
