"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { IconePartager, IconePlus } from "@/components/icones";
import { Bouton } from "@/components/ui";

export type Appareil = {
  /** L'app est ouverte depuis l'écran d'accueil. */
  installee: boolean;
  ios: boolean;
  android: boolean;
  /** Les notifications sont possibles dans ce contexte (sur iPhone : seulement une fois installée). */
  notifications: boolean;
  permission: NotificationPermission | "indisponible";
};

function lire(): string {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installee =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const notifications = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const permission = "Notification" in window ? Notification.permission : "indisponible";
  return JSON.stringify({ installee, ios, android: /Android/i.test(ua), notifications, permission });
}

const abonner = (rappel: () => void) => {
  const m = window.matchMedia("(display-mode: standalone)");
  m.addEventListener("change", rappel);
  window.addEventListener("focus", rappel);
  return () => {
    m.removeEventListener("change", rappel);
    window.removeEventListener("focus", rappel);
  };
};

/** Infos sur l'appareil, lues côté navigateur seulement (null pendant le rendu serveur). */
export function useAppareil(): Appareil | null {
  const brut = useSyncExternalStore(abonner, lire, () => "");
  return brut ? (JSON.parse(brut) as Appareil) : null;
}

/** Enregistre le service worker (notifications). Aucune donnée n'est mise en cache. */
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return null;
}

type InvitationInstallation = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const CLE_MASQUEE = "fitw_installation_masquee";

/** Carte « Installe l'app » sur l'accueil : instructions iPhone, bouton direct sur Android. */
export function CarteInstallation() {
  const appareil = useAppareil();
  const [invitation, setInvitation] = useState<InvitationInstallation | null>(null);
  const masqueeAuDepart = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(CLE_MASQUEE) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [masquee, setMasquee] = useState(false);

  useEffect(() => {
    const surInvitation = (e: Event) => {
      e.preventDefault();
      setInvitation(e as InvitationInstallation);
    };
    window.addEventListener("beforeinstallprompt", surInvitation);
    return () => window.removeEventListener("beforeinstallprompt", surInvitation);
  }, []);

  if (!appareil || appareil.installee || masquee || masqueeAuDepart) return null;
  if (!appareil.ios && !appareil.android && !invitation) return null;

  const masquer = () => {
    try {
      localStorage.setItem(CLE_MASQUEE, "1");
    } catch {}
    setMasquee(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-carte border border-caramel-clair bg-blanc-casse p-4 apparition">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">Installe l’app sur ton téléphone</span>
          <span className="text-[14px] text-texte-2">
            Une icône sur ton écran d’accueil, et les rappels de bilan en notification.
          </span>
        </div>
      </div>
      {invitation ? (
        <Bouton
          onClick={async () => {
            await invitation.prompt();
            setInvitation(null);
          }}
        >
          Installer l’app
        </Bouton>
      ) : appareil.ios ? (
        <ol className="flex flex-col gap-1.5 text-[14.5px]">
          <li className="flex items-center gap-2">
            <span className="font-semibold">1.</span> Dans Safari, touche <IconePartager className="size-5" aria-label="Partager" />
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold">2.</span> Choisis « Sur l’écran d’accueil » <IconePlus className="size-5" />
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold">3.</span> Touche « Ajouter »
          </li>
        </ol>
      ) : (
        <p className="text-[14.5px]">
          Dans Chrome, touche le menu <strong>⋮</strong> puis « Ajouter à l’écran d’accueil » (ou « Installer l’application »).
        </p>
      )}
      <button type="button" onClick={masquer} className="self-start text-[13.5px] text-texte-2 underline underline-offset-4">
        Plus tard
      </button>
    </div>
  );
}
