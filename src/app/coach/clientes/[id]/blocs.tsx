"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { IconeEnveloppe, IconeLien } from "@/components/icones";
import { Bouton, Champ, Message, ZoneTexte, cx } from "@/components/ui";
import { LIBELLES_STATUT, type StatutCliente } from "@/lib/types";
import {
  ajouterNote,
  changerStatut,
  envoyerEmailConnexion,
  genererLienConnexion,
  supprimerCliente,
  supprimerNote,
  type EtatAction,
} from "../actions";

export function BlocConnexion({ id, prenom }: { id: string; prenom: string }) {
  const [etat, setEtat] = useState<EtatAction>({});
  const [copie, setCopie] = useState(false);
  const [enCours, demarrer] = useTransition();

  const lancer = (fn: () => Promise<EtatAction>) =>
    demarrer(async () => {
      setCopie(false);
      setEtat(await fn());
    });

  const copier = async () => {
    if (!etat.lien) return;
    await navigator.clipboard.writeText(etat.lien);
    setCopie(true);
  };

  const texteWhatsApp = etat.lien
    ? `Coucou ${prenom} ! Voici ton lien pour ouvrir ton espace coaching (valable 1 heure) : ${etat.lien}`
    : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Bouton variante="sombre" disabled={enCours} onClick={() => lancer(() => envoyerEmailConnexion(id))}>
          <IconeEnveloppe className="size-5" /> Envoyer l’email
        </Bouton>
        <Bouton variante="contour" disabled={enCours} onClick={() => lancer(() => genererLienConnexion(id))}>
          <IconeLien className="size-5" /> Créer un lien à partager
        </Bouton>
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      {etat.lien && (
        <div className="flex flex-col gap-3 rounded-xl bg-creme/70 p-4">
          <p className="text-[13.5px] text-texte-2">
            Lien personnel, <strong>valable 1 heure et utilisable une seule fois</strong>. Ne
            l’envoie qu’à {prenom}.
          </p>
          <code className="break-all rounded-lg bg-white p-3 text-[12px]">{etat.lien}</code>
          <div className="flex flex-wrap gap-3">
            <Bouton variante="contour" onClick={copier}>
              {copie ? "Copié ✓" : "Copier le lien"}
            </Bouton>
            <a
              className="inline-flex min-h-12 items-center rounded-full bg-[#25D366] px-6 text-[15px] font-medium text-white"
              href={`https://wa.me/?text=${encodeURIComponent(texteWhatsApp)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Envoyer par WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const DESCRIPTIONS: Record<StatutCliente, string> = {
  active: "Accès complet et rappels de bilan.",
  terminee: "Garde son compte et ses contenus, sans rappels de bilan.",
  fermee: "Ne peut plus se connecter. Données conservées 3 ans.",
};

export function BlocStatut({ id, statut }: { id: string; statut: StatutCliente }) {
  const [etat, setEtat] = useState<EtatAction>({});
  const [enCours, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {(Object.keys(LIBELLES_STATUT) as StatutCliente[]).map((s) => (
        <button
          key={s}
          type="button"
          disabled={enCours || s === statut}
          onClick={() => {
            if (s === "fermee" && !confirm("Fermer l’accès ? Elle ne pourra plus se connecter.")) return;
            demarrer(async () => setEtat(await changerStatut(id, s)));
          }}
          className={cx(
            "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors",
            s === statut
              ? "border-chocolat bg-chocolat text-creme"
              : "border-ligne bg-white hover:border-chocolat",
          )}
        >
          <span className="font-medium">{LIBELLES_STATUT[s]}</span>
          <span className={cx("text-[13px]", s === statut ? "text-texte-clair" : "text-texte-2")}>
            {DESCRIPTIONS[s]}
          </span>
        </button>
      ))}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </div>
  );
}

export function BlocNotes({
  id,
  notes,
}: {
  id: string;
  notes: { id: string; contenu: string; date: string }[];
}) {
  const [etat, envoyer] = useActionState(ajouterNote.bind(null, id), {});
  const [, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <form action={envoyer} className="flex flex-col gap-3" key={notes.length}>
        <ZoneTexte label="Nouvelle note" name="contenu" placeholder="Visible uniquement par toi." />
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        <div>
          <BoutonEnvoi variante="sombre">Ajouter la note</BoutonEnvoi>
        </div>
      </form>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-creme/70 p-4">
              <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px] text-texte-2">
                <span>{n.date}</span>
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-erreur"
                  onClick={() => {
                    if (confirm("Supprimer cette note ?")) demarrer(() => supprimerNote(id, n.id));
                  }}
                >
                  Supprimer
                </button>
              </div>
              <p className="whitespace-pre-wrap text-[15px]">{n.contenu}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlocSuppression({ id, prenom }: { id: string; prenom: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, envoyer] = useActionState(supprimerCliente.bind(null, id), {});
  if (!ouvert) {
    return (
      <Bouton variante="danger" onClick={() => setOuvert(true)}>
        Supprimer définitivement
      </Bouton>
    );
  }
  return (
    <form action={envoyer} className="flex flex-col gap-3">
      <Message ton="erreur">
        Action irréversible : le compte, la fiche, les notes et toutes les données de {prenom}{" "}
        seront effacés.
      </Message>
      <Champ label={`Tape « ${prenom || "supprimer"} » pour confirmer`} name="confirmation" autoComplete="off" />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <div className="flex gap-3">
        <BoutonEnvoi variante="danger" enCours="Suppression…">
          Supprimer
        </BoutonEnvoi>
        <Bouton type="button" variante="discret" onClick={() => setOuvert(false)}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
