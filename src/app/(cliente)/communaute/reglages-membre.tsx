"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Message } from "@/components/ui";
import {
  definirNotificationsCommunaute,
  quitterCommunaute,
  rejoindreCommunaute,
} from "@/app/communaute-actions";

export function Adhesion({ charte, lienPolitique }: { charte: string; lienPolitique: string | null }) {
  const [etat, action] = useActionState(rejoindreCommunaute, {});
  return (
    <form action={action} className="flex flex-col gap-5 rounded-carte bg-blanc-casse p-5 shadow-douce apparition">
      <div className="flex flex-col gap-2">
        <h2 className="font-titre text-xl font-bold">Rejoindre la communauté</h2>
        <p className="text-[15px] text-texte-2">
          Un espace pour échanger entre clientes de Cindy : partager tes victoires, tes questions, tes recettes, et
          t’encourager mutuellement. C’est facultatif, et tu peux partir quand tu veux.
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-sable/50 p-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">La charte</p>
        <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{charte}</p>
      </div>
      <ul className="flex flex-col gap-1.5 text-[14px] text-texte-2">
        <li>• Les autres membres voient ton <strong className="text-chocolat">prénom</strong>, tes messages et tes photos.</li>
        <li>• Ton suivi (poids, mesures, bilans, plans) reste <strong className="text-chocolat">strictement privé</strong> : rien n’est visible ici.</li>
        <li>• Tu peux supprimer tes messages à tout moment.</li>
      </ul>
      <CaseACocher name="charte" label="J’ai lu la charte et je m’engage à la respecter" required />
      {lienPolitique && (
        <a href={lienPolitique} target="_blank" rel="noopener noreferrer" className="text-[13.5px] underline underline-offset-4">
          Politique de confidentialité
        </a>
      )}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <BoutonEnvoi>Rejoindre la communauté</BoutonEnvoi>
    </form>
  );
}

export function ReglagesMembre({
  notifications,
  appareil,
  charte,
}: {
  notifications: boolean;
  appareil: boolean;
  charte: string;
}) {
  const [actif, setActif] = useState(notifications);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();
  const [voirCharte, setVoirCharte] = useState(false);

  const basculer = (valeur: boolean) => {
    setActif(valeur);
    setErreur(undefined);
    demarrer(async () => {
      const r = await definirNotificationsCommunaute(valeur);
      if (r.erreur) {
        setErreur(r.erreur);
        setActif(!valeur);
      }
    });
  };

  const quitter = () => {
    if (
      !window.confirm(
        "Quitter la communauté ? Tes messages restent visibles (supprime-les avant si tu préfères). Tu pourras revenir quand tu veux.",
      )
    )
      return;
    demarrer(async () => {
      const r = await quitterCommunaute();
      if (r.erreur) setErreur(r.erreur);
    });
  };

  return (
    <section className="mt-2 flex flex-col gap-4 rounded-carte bg-blanc-casse p-5 shadow-douce">
      <h2 className="font-titre text-lg font-bold">Mes réglages</h2>
      <CaseACocher
        label="Me prévenir des nouveaux messages"
        aide="Une notification au plus par heure, sans le contenu du message."
        checked={actif}
        disabled={enCours}
        onChange={(e) => basculer(e.target.checked)}
      />
      {actif && !appareil && (
        <p className="text-[13.5px] text-texte-2">
          Pour recevoir les notifications, active-les aussi sur ce téléphone dans{" "}
          <Link href="/profil" className="underline underline-offset-4">
            ton profil
          </Link>
          .
        </p>
      )}
      <button type="button" onClick={() => setVoirCharte(!voirCharte)} className="self-start text-[14px] underline underline-offset-4">
        {voirCharte ? "Masquer la charte" : "Relire la charte"}
      </button>
      {voirCharte && <p className="whitespace-pre-wrap rounded-xl bg-sable/50 p-4 text-[14px] leading-relaxed">{charte}</p>}
      {erreur && <Message ton="erreur">{erreur}</Message>}
      <button type="button" onClick={quitter} disabled={enCours} className="self-start text-[14px] text-erreur underline underline-offset-4">
        Quitter la communauté
      </button>
    </section>
  );
}
