"use client";

import { useEffect, useState, useTransition } from "react";
import { classesBouton } from "@/components/ui";
import { lienTelechargementPlan, marquerPlanVu } from "./plans-actions";

export function MarquerVu({ planId }: { planId: string }) {
  useEffect(() => {
    void marquerPlanVu(planId);
  }, [planId]);
  return null;
}

export function BoutonTelecharger({ planId }: { planId: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={enCours}
        className={classesBouton("sombre", true)}
        onClick={() =>
          demarrer(async () => {
            setErreur(undefined);
            const r = await lienTelechargementPlan(planId);
            if (r.url) window.location.href = r.url;
            else setErreur(r.erreur);
          })
        }
      >
        {enCours ? "Préparation…" : "Télécharger le PDF"}
      </button>
      {erreur && <p className="text-[13px] text-erreur">{erreur}</p>}
    </div>
  );
}
