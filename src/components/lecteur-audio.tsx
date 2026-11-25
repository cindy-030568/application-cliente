"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "@/components/ui";
import { SAUT_S, VITESSES, estTerminee, horloge } from "@/lib/ressources";

type Props = {
  /** Lien temporaire vers l'audio. */
  src: string;
  titre: string;
  /** Position de départ (reprise), en secondes. */
  depart?: number;
  /** Durée connue d'avance (sinon lue dans le fichier). */
  dureeConnue?: number | null;
  /** Garde la position (sur son compte). Absent = aperçu, rien n'est enregistré. */
  enregistrer?: (position: number, terminee: boolean) => Promise<void> | void;
  /** Redemande un lien si l'ancien a expiré. */
  nouveauLien?: () => Promise<string | null>;
};

const CLE_VITESSE = "fitw_vitesse_audio";
const rienAEcouter = () => () => {};
const lireVitesse = () => {
  try {
    const v = Number(localStorage.getItem(CLE_VITESSE));
    return (VITESSES as readonly number[]).includes(v) ? v : 1;
  } catch {
    return 1;
  }
};

/**
 * Lecteur audio des ressources : lecture / pause, ±15 s, vitesse 1× / 1,25× / 1,5×,
 * commandes sur l'écran verrouillé (Media Session), reprise là où elle s'est arrêtée.
 */
export function LecteurAudio({ src, titre, depart = 0, dureeConnue = null, enregistrer, nouveauLien }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [lien, setLien] = useState(src);
  const [lecture, setLecture] = useState(false);
  const [position, setPosition] = useState(depart);
  const [duree, setDuree] = useState<number>(dureeConnue ?? 0);
  // Vitesse choisie la dernière fois (gardée sur le téléphone), puis celle qu'elle choisit maintenant.
  const vitesseGardee = useSyncExternalStore(rienAEcouter, lireVitesse, () => 1);
  const [vitesseChoisie, setVitesse] = useState<number | null>(null);
  const vitesse = vitesseChoisie ?? vitesseGardee;
  const [erreur, setErreur] = useState<string | null>(null);
  const reprise = useRef(depart);
  const dernierEnvoi = useRef(0);
  const envoyer = useRef(enregistrer);
  useEffect(() => {
    envoyer.current = enregistrer;
  }, [enregistrer]);

  // Garde la position : toutes les 15 s pendant l'écoute, à la pause, à la fin, et quand on quitte la page.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const garder = (force = false) => {
      if (!envoyer.current || !Number.isFinite(a.currentTime)) return;
      const maintenant = Date.now();
      if (!force && maintenant - dernierEnvoi.current < 15000) return;
      dernierEnvoi.current = maintenant;
      void envoyer.current(a.currentTime, estTerminee(a.currentTime, a.duration || duree));
    };
    const surTemps = () => {
      setPosition(a.currentTime);
      if (!a.paused) garder();
      majPositionEcranVerrouille(a);
    };
    const surPause = () => {
      setLecture(false);
      garder(true);
    };
    const surLecture = () => {
      setLecture(true);
      setErreur(null);
    };
    const surFin = () => {
      setLecture(false);
      if (envoyer.current) void envoyer.current(a.duration || a.currentTime, true);
    };
    const surMeta = () => {
      if (Number.isFinite(a.duration)) setDuree(a.duration);
      if (reprise.current > 0 && reprise.current < (a.duration || Infinity)) a.currentTime = reprise.current;
      reprise.current = 0;
      a.playbackRate = lireVitesse();
    };
    const surErreur = async () => {
      // Lien expiré ou réseau coupé : on redemande un lien et on reprend au même endroit.
      const ici = a.currentTime;
      const neuf = nouveauLien ? await nouveauLien() : null;
      if (neuf && neuf !== lien) {
        reprise.current = ici;
        setLien(neuf);
      } else setErreur("L’audio ne se charge pas. Vérifie ta connexion, puis réessaie.");
    };
    const surCache = () => {
      if (document.visibilityState === "hidden") garder(true);
    };
    const surQuitter = () => garder(true);
    a.addEventListener("timeupdate", surTemps);
    a.addEventListener("pause", surPause);
    a.addEventListener("play", surLecture);
    a.addEventListener("ended", surFin);
    a.addEventListener("loadedmetadata", surMeta);
    a.addEventListener("error", surErreur);
    document.addEventListener("visibilitychange", surCache);
    window.addEventListener("pagehide", surQuitter);
    return () => {
      a.removeEventListener("timeupdate", surTemps);
      a.removeEventListener("pause", surPause);
      a.removeEventListener("play", surLecture);
      a.removeEventListener("ended", surFin);
      a.removeEventListener("loadedmetadata", surMeta);
      a.removeEventListener("error", surErreur);
      document.removeEventListener("visibilitychange", surCache);
      window.removeEventListener("pagehide", surQuitter);
    };
  }, [duree, lien, nouveauLien]);

  // Commandes de l'écran verrouillé et du centre de contrôle.
  useEffect(() => {
    const a = audio.current;
    if (!a || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: titre,
        artist: "fitw_cindy",
        artwork: [
          { src: "/icons/icone-v2-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icone-v2-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
        ["play", () => void a.play()],
        ["pause", () => a.pause()],
        ["seekbackward", (d) => sauter(a, -(d.seekOffset ?? SAUT_S))],
        ["seekforward", (d) => sauter(a, d.seekOffset ?? SAUT_S)],
        ["seekto", (d) => d.seekTime !== undefined && (a.currentTime = d.seekTime)],
      ];
      for (const [action, f] of actions) {
        try {
          ms.setActionHandler(action, f);
        } catch {
          // action non gérée par ce téléphone
        }
      }
    } catch {
      // pas de commandes sur l'écran verrouillé : le lecteur marche quand même
    }
    return () => {
      for (const action of ["play", "pause", "seekbackward", "seekforward", "seekto"] as MediaSessionAction[]) {
        try {
          ms.setActionHandler(action, null);
        } catch {}
      }
    };
  }, [titre]);

  const a = () => audio.current;
  const basculer = () => {
    const el = a();
    if (!el) return;
    if (el.paused) void el.play().catch(() => setErreur("Touche encore lecture pour démarrer l’audio."));
    else el.pause();
  };
  const changerVitesse = () => {
    const suivante = VITESSES[(VITESSES.indexOf(vitesse as (typeof VITESSES)[number]) + 1) % VITESSES.length];
    setVitesse(suivante);
    if (a()) a()!.playbackRate = suivante;
    try {
      localStorage.setItem(CLE_VITESSE, String(suivante));
    } catch {}
  };
  const total = duree || dureeConnue || 0;

  return (
    <div className="flex flex-col gap-4 rounded-carte bg-chocolat p-5 text-creme" role="group" aria-label={`Lecteur audio : ${titre}`}>
      <audio ref={audio} src={lien} preload="metadata" playsInline />
      <div className="flex flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(total))}
          step={1}
          value={Math.min(Math.round(position), Math.round(total) || 0)}
          onChange={(e) => {
            const el = a();
            if (el) el.currentTime = Number(e.target.value);
            setPosition(Number(e.target.value));
          }}
          aria-label="Position dans l’audio"
          aria-valuetext={`${horloge(position)} sur ${horloge(total)}`}
          className="h-2 w-full cursor-pointer accent-[var(--accent)]"
        />
        <div className="flex justify-between text-[13px] tabular-nums text-texte-clair">
          <span>{horloge(position)}</span>
          <span>{total ? `−${horloge(Math.max(0, total - position))}` : "…"}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={changerVitesse}
          className="min-h-11 min-w-14 rounded-full border border-texte-clair/40 px-3 text-[14px] font-medium tabular-nums"
          aria-label={`Vitesse de lecture : ${vitesse.toLocaleString("fr-FR")} fois. Toucher pour changer`}
        >
          {vitesse.toLocaleString("fr-FR")}×
        </button>
        <div className="flex items-center gap-3">
          <BoutonSaut sens={-1} onClick={() => a() && sauter(a()!, -SAUT_S)} />
          <button
            type="button"
            onClick={basculer}
            className="flex size-16 items-center justify-center rounded-full bg-accent text-white shadow-douce"
            aria-label={lecture ? "Pause" : position > 1 ? "Reprendre la lecture" : "Lecture"}
          >
            {lecture ? (
              <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="ml-1 size-7" fill="currentColor" aria-hidden>
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
              </svg>
            )}
          </button>
          <BoutonSaut sens={1} onClick={() => a() && sauter(a()!, SAUT_S)} />
        </div>
        <span className="min-w-14" aria-hidden />
      </div>
      {depart > 0 && position <= depart + 1 && !lecture && (
        <p className="text-center text-[13.5px] text-texte-clair">Tu reprends où tu t’étais arrêtée ({horloge(depart)}).</p>
      )}
      {erreur && (
        <p role="alert" className="text-center text-[14px] text-caramel-clair">
          {erreur}
        </p>
      )}
    </div>
  );
}

function sauter(a: HTMLAudioElement, s: number) {
  const fin = Number.isFinite(a.duration) ? a.duration : Infinity;
  a.currentTime = Math.max(0, Math.min(fin - 0.5, a.currentTime + s));
}

function majPositionEcranVerrouille(a: HTMLAudioElement) {
  try {
    if ("mediaSession" in navigator && Number.isFinite(a.duration) && a.duration > 0) {
      navigator.mediaSession.setPositionState({ duration: a.duration, playbackRate: a.playbackRate, position: Math.min(a.currentTime, a.duration) });
    }
  } catch {}
}

function BoutonSaut({ sens, onClick }: { sens: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("relative flex size-12 items-center justify-center rounded-full text-creme hover:bg-white/10")}
      aria-label={sens < 0 ? "Reculer de 15 secondes" : "Avancer de 15 secondes"}
    >
      <svg viewBox="0 0 24 24" className={cx("size-8", sens > 0 && "-scale-x-100")} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 12a8 8 0 1 0 2.4-5.7" />
        <path d="M4 4v4h4" />
      </svg>
      <span className="absolute text-[10px] font-semibold">15</span>
    </button>
  );
}
