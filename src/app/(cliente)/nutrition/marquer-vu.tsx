"use client";

import { useEffect } from "react";
import { marquerPlanAlimentaireVu } from "@/app/plan-alimentaire-actions";

export function MarquerPlanVu({ planId }: { planId: string }) {
  useEffect(() => {
    void marquerPlanAlimentaireVu(planId);
  }, [planId]);
  return null;
}
