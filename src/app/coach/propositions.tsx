"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bouton, Etiquette, Message } from "@/components/ui";
import type { Proposition } from "@/lib/propositions-messages";
import { traiterProposition, type EtatMessage } from "./messages-actions";

/** Accueil coach : ce qui a changé cette semaine, avec un petit mot prêt à envoyer. */
export function PropositionsMessages({ propositions }: { propositions: Proposition[] }) {
  const [faites, setFaites] = useState<Record<string, string>>({});
  const restantes = propositions.filter((p) => !faites[`${p.clienteId}|${p.cle}`]);
  const messagesFaits = Object.values(faites);
  if (!restantes.length) {
    return (
      <p className="py-2 text-[15px] text-texte-2">
        {messagesFaits.length ? `${messagesFaits.at(-1)} Rien d’autre cette semaine.` : "Rien de notable cette semaine : rien à relancer pour l’instant. 💛"}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {restantes.map((p) => (
        <LigneProposition key={`${p.clienteId}|${p.cle}`} p={p} fait={(m) => setFaites((f) => ({ ...f, [`${p.clienteId}|${p.cle}`]: m }))} />
      ))}
    </ul>
  );
}

function LigneProposition({ p, fait }: { p: Proposition; fait: (message: string) => void }) {
  const [texte, setTexte] = useState(p.message);
  const [etat, setEtat] = useState<EtatMessage>({});
  const [enCours, demarrer] = useTransition();
  const traiter = (statut: "envoye" | "copie" | "ignore") =>
    demarrer(async () => {
      if (statut === "copie") {
        try {
          await navigator.clipboard.writeText(texte);
        } catch {
          setEtat({ erreur: "La copie automatique n’a pas marché : sélectionne le texte et copie-le à la main." });
          return;
        }
      }
      const r = await traiterProposition(p.clienteId, p.cle, statut, texte);
      setEtat(r);
      if (!r.erreur) fait(r.succes ?? "");
    });
  return (
    <li className="flex flex-col gap-2.5 rounded-xl border border-ligne bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/coach/clientes/${p.clienteId}`} className="text-[15.5px] font-semibold hover:text-accent">
          {p.prenom}
        </Link>
        <Etiquette ton={p.ton === "relance" ? "rose" : "vert"}>{p.ton === "victoire" ? "Victoire 🏆" : p.ton === "bravo" ? "Bravo" : "Garder le lien"}</Etiquette>
      </div>
      <div>
        <p className="text-[14.5px] font-medium">{p.titre}</p>
        <p className="text-[13.5px] text-texte-2">{p.constat}</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[12.5px] font-medium text-texte-2">Message proposé (modifiable)</span>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} maxLength={1000} className="rounded-xl border border-ligne bg-white px-3 py-2 text-[14.5px]" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Bouton type="button" className="min-h-11" disabled={enCours} onClick={() => traiter("envoye")}>
          Envoyer dans l’appli
        </Bouton>
        <Bouton type="button" variante="contour" className="min-h-11" disabled={enCours} onClick={() => traiter("copie")}>
          Copier
        </Bouton>
        <button type="button" disabled={enCours} onClick={() => traiter("ignore")} className="ml-auto min-h-11 px-2 text-[14px] text-texte-2 underline underline-offset-4">
          Ignorer
        </button>
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </li>
  );
}
