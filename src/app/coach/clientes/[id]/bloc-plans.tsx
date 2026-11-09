"use client";

import { useRef, useState, useTransition } from "react";
import { IconeExterne } from "@/components/icones";
import { Bouton, Champ, Etiquette, Message, cx } from "@/components/ui";
import { clientDepot } from "@/lib/supabase/navigateur";
import {
  LIBELLES_SOURCE_PLAN,
  LIBELLES_TYPE_PLAN,
  TAILLE_MAX_PDF,
  type SourcePlan,
  type TypePlan,
} from "@/lib/types";
import { lienPlanCoach, preparerDepotPdf, publierPlan, supprimerPlan } from "../plans-actions";

export type PlanAffiche = {
  id: string;
  titre: string;
  source: SourcePlan;
  actif: boolean;
  date: string;
  vu: string | null;
};

export function BlocPlan({
  clienteId,
  type,
  plans,
}: {
  clienteId: string;
  type: TypePlan;
  plans: PlanAffiche[];
}) {
  const sources: SourcePlan[] = type === "nutrition" ? ["pdf", "drive", "nutrium"] : ["pdf", "drive"];
  const [source, setSource] = useState<SourcePlan>("pdf");
  const [ouvert, setOuvert] = useState(plans.length === 0);
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [etape, setEtape] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const formulaire = useRef<HTMLFormElement>(null);

  const actuel = plans.find((p) => p.actif);
  const historique = plans.filter((p) => !p.actif);

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("source", source);
    demarrer(async () => {
      setEtat({});
      if (source === "pdf") {
        const fichier = fd.get("fichier");
        if (!(fichier instanceof File) || fichier.size === 0) {
          setEtat({ erreur: "Choisis un fichier PDF." });
          return;
        }
        if (fichier.type !== "application/pdf" && !fichier.name.toLowerCase().endsWith(".pdf")) {
          setEtat({ erreur: "Le fichier doit être un PDF." });
          return;
        }
        if (fichier.size > TAILLE_MAX_PDF) {
          setEtat({ erreur: "Le fichier dépasse 25 Mo. Compresse-le (ilovepdf.com) puis réessaie." });
          return;
        }
        setEtape("Envoi du PDF…");
        const prep = await preparerDepotPdf(clienteId, type);
        if (prep.erreur || !prep.chemin || !prep.jeton) {
          setEtape(undefined);
          setEtat({ erreur: prep.erreur ?? "Le dépôt a échoué." });
          return;
        }
        const { error } = await clientDepot()
          .storage.from("plans")
          .uploadToSignedUrl(prep.chemin, prep.jeton, fichier, { contentType: "application/pdf" });
        if (error) {
          setEtape(undefined);
          setEtat({ erreur: "L’envoi du PDF a échoué. Vérifie ta connexion et réessaie." });
          return;
        }
        fd.set("chemin", prep.chemin);
        fd.delete("fichier");
      }
      setEtape("Publication…");
      const resultat = await publierPlan(clienteId, type, {}, fd);
      setEtape(undefined);
      setEtat(resultat);
      if (!resultat.erreur) {
        formulaire.current?.reset();
        setOuvert(false);
      }
    });
  }

  function voir(planId: string) {
    const fenetre = window.open("", "_blank");
    demarrer(async () => {
      const r = await lienPlanCoach(clienteId, planId);
      if (r.url && fenetre) fenetre.location.href = r.url;
      else {
        fenetre?.close();
        setEtat({ erreur: r.erreur ?? "Impossible d’ouvrir ce plan." });
      }
    });
  }

  function supprimer(planId: string, actif: boolean) {
    const message = actif
      ? "Supprimer la version actuelle ? La version précédente redeviendra visible par la cliente."
      : "Supprimer cette ancienne version ?";
    if (!confirm(message)) return;
    demarrer(async () => setEtat(await supprimerPlan(clienteId, planId)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-titre text-lg font-bold">{LIBELLES_TYPE_PLAN[type]}</h3>
        {!ouvert && (
          <Bouton variante="contour" className="min-h-10 px-4 text-[14px]" onClick={() => setOuvert(true)}>
            {actuel ? "Nouvelle version" : "Ajouter"}
          </Bouton>
        )}
      </div>

      {actuel ? (
        <LignePlan plan={actuel} onVoir={voir} onSupprimer={supprimer} enCours={enCours} />
      ) : (
        <p className="text-[14px] text-texte-2">Aucun plan pour l’instant.</p>
      )}

      {ouvert && (
        <form
          ref={formulaire}
          onSubmit={envoyer}
          className="flex flex-col gap-4 rounded-xl border border-ligne bg-creme/50 p-4"
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Comment partager ce plan ?</legend>
            <div className="flex flex-wrap gap-2">
              {sources.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={source === s}
                  onClick={() => setSource(s)}
                  className={cx(
                    "rounded-full px-4 py-2 text-[14px] transition-colors",
                    source === s ? "bg-chocolat text-creme" : "bg-white text-chocolat hover:bg-sable",
                  )}
                >
                  {LIBELLES_SOURCE_PLAN[s]}
                </button>
              ))}
            </div>
          </fieldset>

          {source === "pdf" ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`fichier-${type}`} className="text-sm font-medium">
                Fichier PDF (25 Mo max)
              </label>
              <input
                id={`fichier-${type}`}
                name="fichier"
                type="file"
                accept="application/pdf,.pdf"
                required
                className="rounded-xl border border-dashed border-caramel-clair bg-white p-3 text-[14px] file:mr-3 file:rounded-full file:border-0 file:bg-accent-pale file:px-4 file:py-2 file:text-chocolat"
              />
              <p className="text-[13px] text-texte-2">
                Stocké de façon privée en France, visible uniquement par elle et toi.
              </p>
            </div>
          ) : (
            <Champ
              label={source === "nutrium" ? "Lien de son plan Nutrium" : "Lien Google Drive du PDF"}
              name="url"
              type="url"
              required
              placeholder="https://…"
              aide={
                source === "drive"
                  ? "Dans Drive : Partager → « Tous les utilisateurs disposant du lien » → Copier le lien."
                  : undefined
              }
            />
          )}

          <Champ
            label="Titre (facultatif)"
            name="titre"
            maxLength={120}
            placeholder={`${LIBELLES_TYPE_PLAN[type]} du …`}
          />

          {actuel && (
            <p className="text-[13px] text-texte-2">
              La version actuelle passera dans l’historique, toujours consultable par la cliente.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Bouton type="submit" disabled={enCours}>
              {etape ?? "Publier"}
            </Bouton>
            {plans.length > 0 && (
              <Bouton type="button" variante="discret" onClick={() => setOuvert(false)}>
                Annuler
              </Bouton>
            )}
          </div>
        </form>
      )}

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}

      {historique.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[14px] text-texte-2 hover:text-chocolat">
            Versions précédentes ({historique.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {historique.map((p) => (
              <li key={p.id}>
                <LignePlan plan={p} onVoir={voir} onSupprimer={supprimer} enCours={enCours} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LignePlan({
  plan,
  onVoir,
  onSupprimer,
  enCours,
}: {
  plan: PlanAffiche;
  onVoir: (id: string) => void;
  onSupprimer: (id: string, actif: boolean) => void;
  enCours: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-xl p-3",
        plan.actif ? "bg-succes-pale/60" : "bg-creme/70",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{plan.titre}</span>
        <span className="text-[13px] text-texte-2">
          {LIBELLES_SOURCE_PLAN[plan.source]} · {plan.date}
        </span>
      </div>
      {plan.actif && (
        <Etiquette ton={plan.vu ? "vert" : "sable"}>{plan.vu ? `Vu le ${plan.vu}` : "Pas encore ouvert"}</Etiquette>
      )}
      <div className="flex gap-3 text-[14px]">
        <button
          type="button"
          disabled={enCours}
          onClick={() => onVoir(plan.id)}
          className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-accent"
        >
          Voir <IconeExterne className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => onSupprimer(plan.id, plan.actif)}
          className="text-texte-2 underline underline-offset-4 hover:text-erreur"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
