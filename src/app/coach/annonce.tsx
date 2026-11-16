"use client";

import { useActionState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Message } from "@/components/ui";
import { publierAnnonce, retirerAnnonce, type EtatAnnonce } from "./annonces-actions";

const heure = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function CarteAnnonce({ enCours }: { enCours: { id: string; texte: string; expire_le: string }[] }) {
  const [etat, envoyer] = useActionState<EtatAnnonce, FormData>(publierAnnonce, {});
  const [retrait, demarrer] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <form action={envoyer} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Ton message</span>
          <textarea
            name="texte"
            required
            maxLength={300}
            rows={3}
            placeholder="Ex. : Les filles, la communauté est ouverte ! Venez vous présenter et partager vos victoires 💬"
            className="rounded-xl border border-ligne bg-white px-4 py-3 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">En touchant le message, elle arrive sur…</span>
          <select name="lien" defaultValue="/communaute" className="min-h-12 rounded-xl border border-ligne bg-white px-4 text-[16px] text-chocolat">
            <option value="">Son accueil</option>
            <option value="/communaute">La communauté</option>
            <option value="/suivi/journal">Son journal</option>
            <option value="/recettes">Les recettes</option>
            <option value="/ressources">Les ressources</option>
            <option value="/suivi">Son suivi</option>
          </select>
        </label>
        <CaseACocher name="notifier" defaultChecked label="Envoyer aussi une notification" aide="À celles qui ont activé les notifications. Les autres le verront sur leur accueil pendant 24 h." />
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        {etat.succes && <Message ton="succes">{etat.succes}</Message>}
        <BoutonEnvoi enCours="Envoi…" className="self-start">
          Envoyer à toutes mes clientes
        </BoutonEnvoi>
      </form>
      {enCours.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-ligne pt-3">
          <p className="text-[13px] text-texte-2">En ce moment sur leur accueil :</p>
          {enCours.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl bg-sable/50 px-3 py-2 text-[14px]">
              <span>
                {a.texte}
                <span className="block text-[12px] text-texte-2">jusqu’à {heure.format(new Date(a.expire_le))}</span>
              </span>
              <button type="button" disabled={retrait} onClick={() => demarrer(async () => void (await retirerAnnonce(a.id)))} className="shrink-0 text-[13px] underline underline-offset-4">
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
