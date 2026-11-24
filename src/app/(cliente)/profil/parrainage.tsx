"use client";

import { useState } from "react";
import { Bouton } from "@/components/ui";

/** Profil : son code et son lien de parrainage, à partager. */
export function CarteParrainage({ code, lien }: { code: string; lien: string | null }) {
  const [copie, setCopie] = useState<string>();
  const message = lien
    ? `Je suis accompagnée par Cindy (fitw_cindy) et j’adore 💛 Si tu veux te lancer toi aussi, voici mon lien : ${lien}`
    : `Je suis accompagnée par Cindy (fitw_cindy) et j’adore 💛 Si tu veux te lancer toi aussi, indique mon code de parrainage ${code} quand tu t’inscris.`;
  const copier = async (texte: string, quoi: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(quoi);
    } catch {
      setCopie(undefined);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-sable/60 px-4 py-3">
        <span className="text-[13px] text-texte-2">Mon code</span>
        <span className="font-titre text-[24px] font-bold tracking-[0.18em]">{code}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ text: message });
                return;
              } catch {
                // partage annulé : on propose de copier
              }
            }
            await copier(message, "message");
          }}
        >
          Partager à une amie
        </Bouton>
        <Bouton variante="contour" onClick={() => copier(lien ?? code, lien ? "lien" : "code")}>
          {lien ? "Copier mon lien" : "Copier mon code"}
        </Bouton>
      </div>
      {copie && <p className="text-[13.5px] text-succes">{copie === "message" ? "Message copié" : copie === "lien" ? "Lien copié" : "Code copié"} ✓ Colle-le où tu veux.</p>}
      <p className="text-[13px] text-texte-2">Quand une amie s’inscrit avec ton lien ou ton code, Cindy le voit. La petite attention pour toi, c’est elle qui s’en occupe 🎁</p>
    </div>
  );
}
