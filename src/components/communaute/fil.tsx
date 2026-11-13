"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { IconePlus } from "@/components/icones";
import { Bouton, Message, cx } from "@/components/ui";
import {
  LISTE_REACTIONS,
  REACTIONS,
  TEXTE_MAX,
  momentRelatif,
  ordonner,
  type MessageCommunaute,
  type Reaction,
} from "@/lib/communaute";
import { compresserPhoto } from "@/lib/image";
import { clientDepot } from "@/lib/supabase/navigateur";
import {
  chargerFil,
  preparerPhotoCommunaute,
  publierMessage,
  reagir,
  signalerMessage,
  supprimerMessage,
} from "@/app/communaute-actions";
import { epinglerMessage } from "@/app/coach/communaute/actions";

type Props = {
  moi: string;
  coach?: boolean;
  initial: { messages: MessageCommunaute[]; encore: boolean; maintenant: string };
};

const RAFRAICHISSEMENT_MS = 30_000;

/** Fil de la communauté : écrire, réagir, supprimer ses messages, signaler (clientes) ou modérer (coach). */
export function FilCommunaute({ moi, coach = false, initial }: Props) {
  const [messages, setMessages] = useState(initial.messages);
  const [encore, setEncore] = useState(initial.encore);
  const [maintenant, setMaintenant] = useState(initial.maintenant);
  const [erreur, setErreur] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [chargement, demarrer] = useTransition();
  const nbRef = useRef(messages.length);
  useEffect(() => {
    nbRef.current = messages.length;
  }, [messages.length]);

  const recharger = useCallback(async () => {
    const r = await chargerFil(null, Math.min(Math.max(nbRef.current, 30), 120));
    if (r.messages) {
      setMessages((anciens) => {
        // Garde les pages plus anciennes déjà chargées.
        const plusAncien = r.messages!.filter((m) => !m.epingle).at(-1)?.creeLe;
        const reste = plusAncien ? anciens.filter((m) => !m.epingle && m.creeLe < plusAncien) : [];
        const ids = new Set(r.messages!.map((m) => m.id));
        return [...r.messages!, ...reste.filter((m) => !ids.has(m.id))];
      });
      if (r.maintenant) setMaintenant(r.maintenant);
    }
  }, []);

  // Nouveaux messages : toutes les 30 s quand l'écran est visible, et au retour sur l'app.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void recharger();
    }, RAFRAICHISSEMENT_MS);
    const auRetour = () => {
      if (document.visibilityState === "visible") void recharger();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [recharger]);

  const plusAnciens = () =>
    demarrer(async () => {
      const dernier = messages.filter((m) => !m.epingle).at(-1)?.creeLe ?? messages.at(-1)?.creeLe;
      if (!dernier) return;
      const r = await chargerFil(dernier);
      if (r.erreur) return setErreur(r.erreur);
      const ids = new Set(messages.map((m) => m.id));
      setMessages([...messages, ...(r.messages ?? []).filter((m) => !ids.has(m.id))]);
      setEncore(Boolean(r.encore));
    });

  const majMessage = (id: string, f: (m: MessageCommunaute) => MessageCommunaute | null) =>
    setMessages((liste) => liste.flatMap((m) => (m.id === id ? (f(m) ?? []) : [m])));

  const basculerReaction = async (m: MessageCommunaute, r: Reaction) => {
    const actif = !m.miennes.includes(r);
    majMessage(m.id, (x) => ({
      ...x,
      miennes: actif ? [...x.miennes, r] : x.miennes.filter((y) => y !== r),
      reactions: { ...x.reactions, [r]: Math.max(0, x.reactions[r] + (actif ? 1 : -1)) },
    }));
    const res = await reagir(m.id, r, actif);
    if (res.erreur) {
      setErreur(res.erreur);
      void recharger();
    }
  };

  const supprimer = async (m: MessageCommunaute) => {
    const qui = m.auteurId === moi ? "ton message" : `le message de ${m.prenom}`;
    if (!window.confirm(`Supprimer ${qui} ? C’est définitif.`)) return;
    const res = await supprimerMessage(m.id);
    if (res.erreur) return setErreur(res.erreur);
    majMessage(m.id, () => null);
  };

  const signaler = async (m: MessageCommunaute) => {
    const motif = window.prompt(
      `Signaler ce message à Cindy ?\nTu peux préciser pourquoi (facultatif) :`,
      "",
    );
    if (motif === null) return;
    const res = await signalerMessage(m.id, motif);
    if (res.erreur) return setErreur(res.erreur);
    setInfo(res.succes);
    majMessage(m.id, (x) => ({ ...x, signale: true }));
  };

  const epingler = async (m: MessageCommunaute) => {
    const res = await epinglerMessage(m.id, !m.epingle);
    if (res.erreur) return setErreur(res.erreur);
    majMessage(m.id, (x) => ({ ...x, epingle: !x.epingle }));
  };

  const maintenantDate = new Date(maintenant);
  const ordonnes = ordonner(messages);

  return (
    <div className="flex flex-col gap-4">
      <Redaction coach={coach} apresEnvoi={recharger} />
      {erreur && (
        <div onClick={() => setErreur(undefined)}>
          <Message ton="erreur">{erreur}</Message>
        </div>
      )}
      {info && (
        <div onClick={() => setInfo(undefined)}>
          <Message ton="succes">{info}</Message>
        </div>
      )}

      {ordonnes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-carte border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-10 text-center">
          <span className="text-3xl" aria-hidden>
            💬
          </span>
          <p className="font-titre text-lg font-bold">Aucun message pour l’instant</p>
          <p className="max-w-xs text-[14.5px] text-texte-2">Lance la conversation : présente-toi, partage une victoire ou une recette !</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordonnes.map((m) => (
            <li key={m.id}>
              <CarteMessage
                m={m}
                moi={moi}
                coach={coach}
                maintenant={maintenantDate}
                onReaction={(r) => basculerReaction(m, r)}
                onSupprimer={() => supprimer(m)}
                onSignaler={() => signaler(m)}
                onEpingler={() => epingler(m)}
              />
            </li>
          ))}
        </ul>
      )}

      {encore && (
        <Bouton variante="contour" onClick={plusAnciens} disabled={chargement} className="self-center">
          {chargement ? "Chargement…" : "Voir les messages plus anciens"}
        </Bouton>
      )}
    </div>
  );
}

function CarteMessage({
  m,
  moi,
  coach,
  maintenant,
  onReaction,
  onSupprimer,
  onSignaler,
  onEpingler,
}: {
  m: MessageCommunaute;
  moi: string;
  coach: boolean;
  maintenant: Date;
  onReaction: (r: Reaction) => void;
  onSupprimer: () => void;
  onSignaler: () => void;
  onEpingler: () => void;
}) {
  const [agrandie, setAgrandie] = useState(false);
  const mien = m.auteurId === moi;
  return (
    <article
      className={cx(
        "flex flex-col gap-3 rounded-carte p-4 shadow-douce",
        m.coach ? "bg-accent-pale" : "bg-blanc-casse",
        m.epingle && "ring-2 ring-caramel-clair",
      )}
    >
      {m.epingle && <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-caramel-texte">📌 Épinglé par Cindy</p>}
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-full font-titre text-[17px] font-bold",
            m.coach ? "bg-chocolat text-caramel-clair" : "bg-sable text-chocolat",
          )}
        >
          {m.prenom.slice(0, 1).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 font-medium">
            <span className="truncate">{mien ? "Toi" : m.prenom}</span>
            {m.coach && <span className="rounded-full bg-chocolat px-2 py-0.5 text-[11px] font-medium text-creme">Coach</span>}
          </span>
          <time dateTime={m.creeLe} className="text-[12.5px] text-texte-2">
            {momentRelatif(m.creeLe, maintenant)}
          </time>
        </span>
      </header>

      {m.texte && <p className="whitespace-pre-wrap break-words text-[15.5px] leading-relaxed">{m.texte}</p>}
      {m.photo && (
        <button type="button" onClick={() => setAgrandie(true)} className="overflow-hidden rounded-2xl" aria-label="Agrandir la photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.photo} alt={`Photo partagée par ${m.prenom}`} loading="lazy" className="max-h-96 w-full object-cover" />
        </button>
      )}
      {agrandie && m.photo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          onClick={() => setAgrandie(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.photo} alt={`Photo partagée par ${m.prenom}`} className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/90 px-4 py-2 text-[14px] font-medium text-chocolat">
            Fermer
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {LISTE_REACTIONS.map((r) => {
          const n = m.reactions[r];
          const mienne = m.miennes.includes(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => onReaction(r)}
              aria-pressed={mienne}
              aria-label={`${REACTIONS[r].label}${n ? ` (${n})` : ""}`}
              className={cx(
                "inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-[14px] transition-colors",
                mienne ? "border-accent bg-white text-chocolat" : "border-ligne bg-white/60 text-texte-2 hover:border-caramel-clair",
                !n && !mienne && "opacity-70",
              )}
            >
              <span aria-hidden>{REACTIONS[r].emoji}</span>
              {n > 0 && <span className="tabular-nums">{n}</span>}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-3 text-[13px]">
          {coach && (
            <button type="button" onClick={onEpingler} className="text-texte-2 underline underline-offset-4 hover:text-chocolat">
              {m.epingle ? "Désépingler" : "Épingler"}
            </button>
          )}
          {(mien || coach) && (
            <button type="button" onClick={onSupprimer} className="text-texte-2 underline underline-offset-4 hover:text-erreur">
              Supprimer
            </button>
          )}
          {!mien && !coach && !m.coach && (
            <button
              type="button"
              onClick={onSignaler}
              disabled={m.signale}
              className="text-texte-2 underline underline-offset-4 hover:text-chocolat disabled:no-underline"
            >
              {m.signale ? "Signalé" : "Signaler"}
            </button>
          )}
        </span>
      </div>
    </article>
  );
}

function Redaction({ coach, apresEnvoi }: { coach: boolean; apresEnvoi: () => Promise<void> }) {
  const [texte, setTexte] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; apercu: string } | null>(null);
  const [etape, setEtape] = useState<string>();
  const [erreur, setErreur] = useState<string>();
  const champPhoto = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.apercu);
  }, [photo]);

  const choisirPhoto = async (fichier: File | undefined) => {
    if (!fichier) return;
    setErreur(undefined);
    try {
      setEtape("Préparation de la photo…");
      const blob = await compresserPhoto(fichier, 1600, 0.82);
      setPhoto({ blob, apercu: URL.createObjectURL(blob) });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Cette photo ne peut pas être utilisée.");
    } finally {
      setEtape(undefined);
      if (champPhoto.current) champPhoto.current.value = "";
    }
  };

  const envoyer = async () => {
    if (etape) return;
    setErreur(undefined);
    let chemin: string | null = null;
    try {
      if (photo) {
        setEtape("Envoi de la photo…");
        const prep = await preparerPhotoCommunaute();
        if (!prep.chemin || !prep.jeton) throw new Error(prep.erreur ?? "La photo n’a pas pu être envoyée.");
        const { error } = await clientDepot()
          .storage.from("communaute")
          .uploadToSignedUrl(prep.chemin, prep.jeton, photo.blob, { contentType: "image/jpeg" });
        if (error) throw new Error("La photo n’a pas pu être envoyée. Vérifie ta connexion et réessaie.");
        chemin = prep.chemin;
      }
      setEtape("Publication…");
      const r = await publierMessage(texte, chemin);
      if (r.erreur) throw new Error(r.erreur);
      setTexte("");
      setPhoto(null);
      await apresEnvoi();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Ton message n’a pas pu être publié.");
    } finally {
      setEtape(undefined);
    }
  };

  const vide = !texte.trim() && !photo;
  return (
    <form
      className="flex flex-col gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce"
      onSubmit={(e) => {
        e.preventDefault();
        void envoyer();
      }}
    >
      <label htmlFor="message-communaute" className="sr-only">
        Ton message
      </label>
      <textarea
        id="message-communaute"
        value={texte}
        onChange={(e) => setTexte(e.target.value.slice(0, TEXTE_MAX))}
        rows={texte ? 4 : 2}
        maxLength={TEXTE_MAX}
        placeholder={coach ? "Un mot pour tes clientes…" : "Partage une victoire, une question, une recette…"}
        className="min-h-16 resize-y rounded-xl border border-ligne bg-white px-4 py-3 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale"
      />
      {photo && (
        <div className="relative self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.apercu} alt="Photo à envoyer" className="max-h-48 rounded-xl" />
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className="absolute right-2 top-2 rounded-full bg-white/95 px-3 py-1 text-[13px] font-medium text-chocolat shadow-douce"
          >
            Retirer
          </button>
        </div>
      )}
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => champPhoto.current?.click()}
          disabled={Boolean(etape)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[14.5px] font-medium text-chocolat hover:bg-sable/60"
        >
          <IconePlus className="size-5" /> Photo
        </button>
        <input
          ref={champPhoto}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void choisirPhoto(e.target.files?.[0])}
        />
        <span className="flex items-center gap-3">
          {texte.length > TEXTE_MAX - 200 && (
            <span className="text-[12.5px] text-texte-2 tabular-nums">{TEXTE_MAX - texte.length}</span>
          )}
          <Bouton type="submit" disabled={vide || Boolean(etape)} className="min-h-11 px-5">
            {etape ?? "Publier"}
          </Bouton>
        </span>
      </div>
      {!coach && (
        <p className="text-[12.5px] text-texte-2">
          Visible par les membres de la communauté, avec ton prénom. Évite les infos personnelles (adresse, téléphone…).
        </p>
      )}
    </form>
  );
}
