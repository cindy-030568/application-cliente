"use client";

import { useState } from "react";
import { Bouton } from "@/components/ui";

/** Copie le bilan (sans nom ni photo) pour le coller dans Claude. */
export function CopierPourClaude({ texte }: { texte: string }) {
  const [etat, setEtat] = useState<"" | "ok" | "erreur">("");
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("ok");
    } catch {
      setEtat("erreur");
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-sable/50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="button" variante="contour" className="min-h-11" onClick={copier}>
          {etat === "ok" ? "Copié ✓" : "Copier pour Claude"}
        </Bouton>
        <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" className="text-[14px] underline underline-offset-4">
          Ouvrir Claude
        </a>
      </div>
      <p className="text-[13px] text-texte-2">
        {etat === "ok"
          ? "Colle-le dans une nouvelle conversation Claude (Ctrl + V, ou appui long → Coller), puis relis et adapte sa proposition avant de l’envoyer."
          : "Le bilan est copié sans nom, sans email, sans photo et sans date : seulement ses réponses."}
      </p>
      {etat === "erreur" && (
        <details className="text-[13px]">
          <summary className="cursor-pointer text-erreur">La copie automatique n’a pas marché : affiche le texte</summary>
          <textarea readOnly value={texte} rows={10} className="mt-2 w-full rounded-lg border border-ligne bg-white p-2 text-[13px]" onFocus={(e) => e.currentTarget.select()} />
        </details>
      )}
    </div>
  );
}
