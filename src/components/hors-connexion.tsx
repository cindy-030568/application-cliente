"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  EVENEMENT_FILE,
  effacerHorsConnexion,
  lireFile,
  ressourcesDePage,
  synchroniser,
  verifierProprietaire,
} from "@/lib/hors-connexion";

const ENTETE = { "x-fitw-hors-connexion": "1" };

function abonner(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  window.addEventListener(EVENEMENT_FILE, rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
    window.removeEventListener(EVENEMENT_FILE, rappel);
  };
}
/** « en ligne|nombre en attente » (une chaîne : comparée sans recalcul inutile). */
const etatReseau = () => `${navigator.onLine ? 1 : 0}|${lireFile().length}`;

/**
 * Petit bandeau discret : « Hors connexion » quand le réseau manque, et envoi automatique
 * des séances gardées sur le téléphone dès que le réseau revient.
 */
export function BandeauHorsConnexion() {
  const etat = useSyncExternalStore(abonner, etatReseau, () => "1|0");
  const [enLigne, attente] = etat.split("|").map(Number);
  useEffect(() => {
    if (enLigne && attente) void synchroniser();
  }, [enLigne, attente]);
  if (enLigne && !attente) return null;
  return (
    <div role="status" className="sticky top-0 z-40 -mx-5 mb-3 bg-chocolat px-4 py-2 text-center text-[13px] text-creme">
      {enLigne
        ? `Envoi de ${attente} élément${attente > 1 ? "s" : ""} gardé${attente > 1 ? "s" : ""} hors connexion…`
        : `Hors connexion · ta séance fonctionne${attente ? ` · ${attente} élément${attente > 1 ? "s" : ""} en attente d’envoi` : ""}`}
    </div>
  );
}

/**
 * Sur l'onglet Sport, avec du réseau : garde sur le téléphone le programme en cours et chaque séance guidée
 * (et les fichiers nécessaires pour les afficher), pour qu'elles marchent dans une salle sans réseau.
 */
export function PreparerHorsConnexion({ proprietaire, nbSeances }: { proprietaire: string; nbSeances: number }) {
  const [, setPret] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    let annule = false;
    (async () => {
      await verifierProprietaire(proprietaire);
      await synchroniser();
      await navigator.serviceWorker.ready;
      const pages = ["/sport", ...Array.from({ length: Math.min(nbSeances, 14) }, (_, i) => `/seance/${i}`)];
      const fichiers = new Set<string>();
      for (const page of pages) {
        if (annule) return;
        try {
          const r = await fetch(page, { headers: ENTETE, credentials: "same-origin" });
          if (r.ok) ressourcesDePage(await r.text()).forEach((f) => fichiers.add(f));
        } catch {
          return; // le réseau a disparu : on réessaiera à la prochaine visite
        }
      }
      for (const f of fichiers) {
        if (annule) return;
        const r = await fetch(f).catch(() => undefined);
        // Polices de l'app, citées dans les feuilles de style.
        if (r?.ok && f.endsWith(".css")) {
          const css = await r.text();
          for (const m of css.matchAll(/url\((\/_next\/static\/media\/[^)"']+)\)/g)) await fetch(m[1]).catch(() => undefined);
        }
      }
      if (!annule) setPret(true);
    })();
    return () => {
      annule = true;
    };
  }, [proprietaire, nbSeances]);
  return null;
}

/**
 * Déconnexion : envoie d'abord les séances en attente si possible, puis efface tout ce qui est gardé
 * sur le téléphone (programme, séances, file d'attente) avant de se déconnecter.
 */
export function BoutonDeconnexion({ className, children }: { className?: string; children: React.ReactNode }) {
  const [enCours, setEnCours] = useState(false);
  return (
    <form
      action="/auth/deconnexion"
      method="post"
      onSubmit={async (e) => {
        if (enCours) return;
        e.preventDefault();
        const formulaire = e.currentTarget;
        setEnCours(true);
        let restantes = lireFile().length;
        if (restantes) restantes = await synchroniser();
        if (
          restantes &&
          !window.confirm(
            `${restantes} séance${restantes > 1 ? "s" : ""} ou poids pas encore envoyé${restantes > 1 ? "s" : ""} à Cindy (pas de réseau). Si tu te déconnectes maintenant, ${restantes > 1 ? "ils seront effacés" : "il sera effacé"}. Te déconnecter quand même ?`,
          )
        ) {
          setEnCours(false);
          return;
        }
        await effacerHorsConnexion();
        formulaire.submit();
      }}
    >
      <button type="submit" disabled={enCours} className={className}>
        {children}
      </button>
    </form>
  );
}
