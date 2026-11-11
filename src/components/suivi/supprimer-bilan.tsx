"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { supprimerBilan } from "@/app/suivi-actions";

export function BoutonSupprimerBilan({ bilanId, retour }: { bilanId: string; retour: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={enCours}
        className="text-[14px] text-texte-2 underline underline-offset-4 hover:text-erreur"
        onClick={() => {
          if (!confirm("Supprimer ce bilan et ses photos ? C’est définitif.")) return;
          demarrer(async () => {
            const r = await supprimerBilan(bilanId);
            if (r.erreur) setErreur(r.erreur);
            else {
              router.push(retour);
              router.refresh();
            }
          });
        }}
      >
        {enCours ? "Suppression…" : "Supprimer ce bilan"}
      </button>
      {erreur && <p className="text-[13px] text-erreur">{erreur}</p>}
    </div>
  );
}
