"use client";

import { useEffect, useState, useTransition } from "react";
import { useAppareil } from "@/components/pwa";
import { Bouton, Message, cx } from "@/components/ui";
import { definirRappelsEmail, enregistrerAppareil, retirerAppareil, testerNotification } from "./rappels-actions";

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

export function ReglagesRappels({ email, clePublique }: { email: boolean; clePublique: string | null }) {
  const appareil = useAppareil();
  const [emailActif, setEmailActif] = useState(email);
  const [abonne, setAbonne] = useState<boolean | null>(null);
  const [etat, setEtat] = useState<{ erreur?: string; succes?: string }>({});
  const [enCours, demarrer] = useTransition();

  const notificationsPossibles = Boolean(appareil?.notifications);
  // État réel de l'abonnement de CE téléphone (lu une fois le service worker prêt).
  useEffect(() => {
    if (!notificationsPossibles) return;
    let actif = true;
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => actif && setAbonne(Boolean(s)))
      .catch(() => actif && setAbonne(false));
    return () => {
      actif = false;
    };
  }, [notificationsPossibles]);

  const activer = () =>
    demarrer(async () => {
      if (!clePublique) return setEtat({ erreur: "Les notifications ne sont pas encore prêtes. Cindy s’en occupe." });
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          return setEtat({ erreur: "Tu as refusé les notifications. Tu peux les autoriser dans les réglages de ton téléphone." });
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(clePublique) }));
        const r = await enregistrerAppareil(JSON.parse(JSON.stringify(sub)), nomAppareil());
        setEtat(r);
        if (!r.erreur) setAbonne(true);
      } catch {
        setEtat({ erreur: "Les notifications n’ont pas pu être activées sur ce téléphone." });
      }
    });

  const desactiver = () =>
    demarrer(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await retirerAppareil(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setAbonne(false);
      setEtat({ succes: "Notifications désactivées sur ce téléphone." });
    });

  return (
    <div className="flex flex-col gap-5">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="font-medium">Par email</span>
          <span className="text-[13.5px] text-texte-2">Quand ton bilan s’ouvre, et un petit rappel si besoin.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={emailActif}
          disabled={enCours}
          onChange={(e) => {
            const v = e.target.checked;
            setEmailActif(v);
            demarrer(async () => {
              const r = await definirRappelsEmail(v);
              if (r.erreur) {
                setEmailActif(!v);
                setEtat(r);
              }
            });
          }}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cx(
            "relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
            emailActif ? "bg-succes" : "bg-chocolat/25",
          )}
        >
          <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]", emailActif ? "left-[22px]" : "left-0.5")} />
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-medium">Sur ce téléphone</span>
        {!appareil ? null : appareil.ios && !appareil.installee ? (
          <p className="text-[13.5px] text-texte-2">
            Sur iPhone, installe d’abord l’app sur ton écran d’accueil (Safari → Partager → « Sur l’écran d’accueil »), puis ouvre-la
            depuis l’icône et reviens ici.
          </p>
        ) : !appareil.notifications ? (
          <p className="text-[13.5px] text-texte-2">Ce navigateur ne permet pas les notifications.</p>
        ) : abonne ? (
          <div className="flex flex-col gap-2">
            <p className="text-[13.5px] text-succes">Notifications activées ✓</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Bouton variante="contour" disabled={enCours} onClick={() => demarrer(async () => setEtat(await testerNotification()))}>
                M’envoyer un test
              </Bouton>
              <Bouton variante="discret" disabled={enCours} onClick={desactiver}>
                Désactiver
              </Bouton>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[13.5px] text-texte-2">Reçois tes rappels de bilan en notification.</p>
            <Bouton disabled={enCours || abonne === null} onClick={activer}>
              Activer les notifications
            </Bouton>
          </div>
        )}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
