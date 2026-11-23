"use client";

import { useEffect, useState, useTransition } from "react";
import { useAppareil } from "@/components/pwa";
import { Bouton, Message, cx } from "@/components/ui";
import type { PrefsNotifCoach } from "@/lib/notifications-coach";
import { changerNotifCoach, enregistrerAppareilCoach, retirerAppareilCoach, testerNotifCoach } from "./notifications-actions";

function versOctets(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

function nomAppareil() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Ordinateur";
  return "Appareil";
}

type Ligne = { cle: keyof PrefsNotifCoach; titre: string; aide: string; v0024?: boolean };
const LIGNES: Ligne[] = [
  {
    cle: "notif_coach_alertes",
    titre: "Note à lire vite ⚠️",
    aide: "Quand une cliente écrit (notes de sa journée, commentaire de séance) quelque chose qui parle de douleur, de santé, de moral ou d’une demande pour toi.",
    v0024: true,
  },
  { cle: "notif_coach_bilans", titre: "Bilan envoyé", aide: "Dès qu’une cliente envoie son bilan." },
  { cle: "notif_coach_journal", titre: "Journée remplie", aide: "Une fois par jour et par cliente. Notification seulement, jamais par email.", v0024: true },
  { cle: "notif_coach_seances", titre: "Séance de sport faite", aide: "Dès qu’une cliente valide une séance. Notification seulement, jamais par email.", v0024: true },
  {
    cle: "notif_coach_programmes",
    titre: "Programme sportif à changer",
    aide: "7 jours et 3 jours avant, le jour J, puis une relance tous les 3 jours tant que le suivant n’est pas dans l’appli.",
    v0024: true,
  },
  { cle: "notif_coach_signalements", titre: "Message signalé", aide: "Quand une cliente signale un message de la communauté." },
  { cle: "notif_coach_messages", titre: "Nouveau message dans la communauté", aide: "Au plus une notification par heure, jamais par email." },
  { cle: "notif_coach_email", titre: "Recevoir aussi un email", aide: "À ton adresse de connexion, en plus des notifications (bilans, notes à lire vite, programmes, signalements)." },
];

export function NotificationsCoach({
  prefs,
  sans0024,
  clePublique,
  nbAppareils,
}: {
  prefs: PrefsNotifCoach;
  sans0024: boolean;
  clePublique: string | null;
  nbAppareils: number;
}) {
  const appareil = useAppareil();
  const [valeurs, setValeurs] = useState(prefs);
  const [abonne, setAbonne] = useState<boolean | null>(null);
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, demarrer] = useTransition();
  const possibles = Boolean(appareil?.notifications);

  useEffect(() => {
    if (!possibles) return;
    let actif = true;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => actif && setAbonne(Boolean(s)))
      .catch(() => actif && setAbonne(false));
    return () => {
      actif = false;
    };
  }, [possibles]);

  const basculer = (cle: keyof PrefsNotifCoach, v: boolean) => {
    setValeurs((x) => ({ ...x, [cle]: v }));
    demarrer(async () => {
      const r = await changerNotifCoach(cle, v);
      if (r.erreur) {
        setValeurs((x) => ({ ...x, [cle]: !v }));
        setEtat(r);
      }
    });
  };

  const activer = () =>
    demarrer(async () => {
      if (!clePublique) return setEtat({ erreur: "Les clés des notifications ne sont pas encore dans Vercel (voir « Rappels de bilan »)." });
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setEtat({ erreur: "Notifications refusées : autorise-les dans les réglages du navigateur ou du téléphone." });
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(clePublique) }));
        const r = await enregistrerAppareilCoach(JSON.parse(JSON.stringify(sub)), nomAppareil());
        setEtat(r);
        if (!r.erreur) setAbonne(true);
      } catch {
        setEtat({ erreur: "Les notifications n’ont pas pu être activées sur cet appareil." });
      }
    });

  const desactiver = () =>
    demarrer(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await retirerAppareilCoach(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setAbonne(false);
      setEtat({ succes: "Notifications désactivées sur cet appareil." });
    });

  return (
    <div className="flex flex-col gap-5">
      {sans0024 && (
        <Message ton="info">
          Pour choisir aussi les journées remplies, les séances, les notes à lire vite et les programmes, fais la mise à jour 0024 dans
          Supabase (voir le guide). En attendant, elles sont toutes envoyées.
        </Message>
      )}
      <ul className="flex flex-col divide-y divide-ligne">
        {LIGNES.filter((l) => !(sans0024 && l.v0024)).map(({ cle, titre, aide }) => (
          <li key={cle}>
            <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <span className="flex flex-col">
                <span className="font-medium">{titre}</span>
                <span className="text-[13.5px] text-texte-2">{aide}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={valeurs[cle]}
                disabled={enCours}
                onChange={(e) => basculer(cle, e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cx(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
                  valeurs[cle] ? "bg-succes" : "bg-chocolat/25",
                )}
              >
                <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]", valeurs[cle] ? "left-[22px]" : "left-0.5")} />
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 rounded-xl bg-sable/50 p-4">
        <span className="font-medium">Sur cet appareil</span>
        <span className="text-[13.5px] text-texte-2">
          {nbAppareils === 0 ? "Aucun appareil activé pour l’instant." : `${nbAppareils} appareil${nbAppareils > 1 ? "s" : ""} activé${nbAppareils > 1 ? "s" : ""} au total.`}{" "}
          Active-les sur ton téléphone et sur ton ordinateur.
        </span>
        {!appareil ? null : appareil.ios && !appareil.installee ? (
          <p className="text-[13.5px] text-texte-2">
            Sur iPhone : installe d’abord l’app sur l’écran d’accueil (Safari → Partager → « Sur l’écran d’accueil »), ouvre-la depuis
            l’icône, connecte-toi avec ton compte coach, puis reviens ici.
          </p>
        ) : !possibles ? (
          <p className="text-[13.5px] text-texte-2">Ce navigateur ne permet pas les notifications. Essaie avec Chrome, Edge ou Safari.</p>
        ) : abonne ? (
          <div className="flex flex-wrap gap-3">
            <Bouton type="button" variante="contour" className="min-h-11" disabled={enCours} onClick={() => demarrer(async () => setEtat(await testerNotifCoach(valeurs.notif_coach_email)))}>
              M’envoyer un test
            </Bouton>
            <Bouton type="button" variante="discret" disabled={enCours} onClick={desactiver}>
              Désactiver sur cet appareil
            </Bouton>
          </div>
        ) : (
          <Bouton type="button" className="min-h-11 self-start" disabled={enCours || abonne === null} onClick={activer}>
            Activer les notifications ici
          </Bouton>
        )}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
