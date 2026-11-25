"use client";

import { useEffect, useRef, useState } from "react";
import { Bouton, CaseACocher, Message } from "@/components/ui";
import { AUDIO_MAX_OCTETS, dureeCourte, formatAudio, horloge } from "@/lib/ressources";
import { clientDepot } from "@/lib/supabase/navigateur";
import { preparerDepotAudio } from "./actions";

/** Durée d'un fichier audio, lue dans le navigateur (null si on ne sait pas la lire). */
function lireDuree(blob: Blob): Promise<number | null> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    const fin = (d: number | null) => {
      URL.revokeObjectURL(url);
      ok(d);
    };
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      // Certains enregistrements (webm) n'ont pas de durée tout de suite.
      if (Number.isFinite(a.duration) && a.duration > 0) fin(Math.round(a.duration));
      else fin(null);
    };
    a.onerror = () => fin(null);
    setTimeout(() => fin(null), 8000);
    a.src = url;
  });
}

/** Format d'enregistrement : m4a si le navigateur sait le faire (Safari, Chrome récent), sinon webm. */
function formatEnregistrement(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return undefined;
}

/**
 * Audio d'une ressource : déposer un fichier m4a / mp3 (50 Mo max) ou s'enregistrer ici.
 * Le fichier part directement dans le stockage privé ; le formulaire reçoit son chemin et sa durée.
 */
export function ChampAudio({ actuel, dureeActuelle, obligatoire, onEnvoi }: { actuel: string | null; dureeActuelle: number | null; obligatoire: boolean; onEnvoi: (enCours: boolean) => void }) {
  const [chemin, setChemin] = useState("");
  const [duree, setDuree] = useState<number | null>(null);
  const [nom, setNom] = useState<string | null>(null);
  const [ecoute, setEcoute] = useState<string | null>(null);
  const [etape, setEtape] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState<{ debut: number } | null>(null);
  const [maintenant, setMaintenant] = useState(0);
  const enregistreur = useRef<MediaRecorder | null>(null);
  const morceaux = useRef<Blob[]>([]);
  const champFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!enregistre) return;
    const t = setInterval(() => setMaintenant(Date.now()), 500);
    return () => clearInterval(t);
  }, [enregistre]);
  useEffect(() => () => {
    if (ecoute) URL.revokeObjectURL(ecoute);
  }, [ecoute]);

  async function envoyer(blob: Blob, nomFichier: string) {
    setErreur(null);
    const format = formatAudio(nomFichier, blob.type);
    if (!format) return setErreur("Ce fichier n’est pas un audio accepté : choisis un m4a ou un mp3.");
    if (blob.size > AUDIO_MAX_OCTETS) return setErreur("Le fichier dépasse 50 Mo. Coupe-le en deux, ou exporte-le en qualité « voix » (m4a).");
    onEnvoi(true);
    setEtape("Envoi de l’audio…");
    try {
      const d = await lireDuree(blob);
      const prep = await preparerDepotAudio(format.ext);
      if (prep.erreur || !prep.chemin || !prep.jeton) throw new Error(prep.erreur ?? "Le dépôt a échoué.");
      const { error } = await clientDepot().storage.from("audios").uploadToSignedUrl(prep.chemin, prep.jeton, blob, { contentType: format.type });
      if (error) throw new Error("L’envoi de l’audio a échoué. Vérifie ta connexion et réessaie.");
      setChemin(prep.chemin);
      setDuree(d);
      setNom(nomFichier);
      setEcoute((avant) => {
        if (avant) URL.revokeObjectURL(avant);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L’envoi a échoué.");
    } finally {
      setEtape(null);
      onEnvoi(false);
    }
  }

  async function demarrer() {
    setErreur(null);
    const type = formatEnregistrement();
    if (!type || !navigator.mediaDevices?.getUserMedia) return setErreur("Ce navigateur ne sait pas enregistrer. Enregistre-toi avec ton téléphone (Dictaphone), puis dépose le fichier.");
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const r = new MediaRecorder(flux, { mimeType: type, audioBitsPerSecond: 64000 });
      morceaux.current = [];
      r.ondataavailable = (e) => e.data.size && morceaux.current.push(e.data);
      r.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        const blob = new Blob(morceaux.current, { type: type.split(";")[0] });
        void envoyer(blob, type.includes("mp4") ? "enregistrement.m4a" : "enregistrement.webm");
      };
      r.start(1000);
      enregistreur.current = r;
      setEnregistre({ debut: Date.now() });
      setMaintenant(Date.now());
    } catch {
      setErreur("Le micro n’est pas accessible. Autorise-le dans ton navigateur (icône à gauche de l’adresse), puis réessaie.");
    }
  }
  function arreter() {
    enregistreur.current?.stop();
    enregistreur.current = null;
    setEnregistre(null);
  }

  const webm = formatEnregistrement()?.includes("webm");
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl bg-creme/60 p-4">
      <legend className="sr-only">Audio</legend>
      <span className="text-sm font-medium">{obligatoire ? "L’audio" : "Version audio (facultatif)"}</span>
      <input type="hidden" name="audio_path" value={chemin} />
      <input type="hidden" name="audio_duree" value={duree ?? ""} />
      {actuel && !chemin && (
        <div className="flex flex-col gap-2">
          <p className="text-[14px]">🎧 Audio actuel{dureeActuelle ? ` · ${dureeCourte(dureeActuelle)}` : ""}. Dépose un autre fichier pour le remplacer.</p>
          {!obligatoire && <CaseACocher name="retirer_audio" label="Retirer l’audio" />}
        </div>
      )}
      {chemin && (
        <div className="flex flex-col gap-2">
          <Message ton="succes">
            ✓ Audio prêt{nom ? ` : ${nom}` : ""}
            {duree ? ` (${dureeCourte(duree)})` : ""}. Il sera enregistré avec la ressource.
          </Message>
          {ecoute && <audio controls src={ecoute} className="w-full" />}
        </div>
      )}
      {enregistre ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-[15px] font-medium tabular-nums text-erreur" role="status">
            <span className="size-3 animate-pulse rounded-full bg-erreur" aria-hidden /> Enregistrement… {horloge((maintenant - enregistre.debut) / 1000)}
          </span>
          <Bouton type="button" variante="sombre" onClick={arreter}>
            ■ Arrêter
          </Bouton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="button" variante="contour" disabled={Boolean(etape)} onClick={() => champFichier.current?.click()}>
            Déposer un fichier (m4a, mp3)
          </Bouton>
          <Bouton type="button" variante="contour" disabled={Boolean(etape)} onClick={demarrer}>
            🎙 M’enregistrer ici
          </Bouton>
          <input
            ref={champFichier}
            type="file"
            accept="audio/mp4,audio/x-m4a,audio/m4a,audio/mpeg,audio/aac,.m4a,.mp3"
            aria-label="Fichier audio"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void envoyer(f, f.name);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {etape && <p className="text-[14px] text-texte-2" role="status">{etape}</p>}
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <p className="text-[12.5px] text-texte-2">
        50 Mo au plus (environ 45 min en m4a). Le plus simple : l’app Dictaphone de ton iPhone, puis « Partager » → « Enregistrer dans Fichiers ».
        {webm ? " Sur ce navigateur, l’enregistrement se fait en webm : il marche sur les iPhone récents, mais un m4a est plus sûr." : ""}
      </p>
    </fieldset>
  );
}
