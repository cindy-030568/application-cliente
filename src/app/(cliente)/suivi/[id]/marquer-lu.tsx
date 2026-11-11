"use client";

import { useEffect } from "react";
import { marquerRetourLu } from "@/app/suivi-actions";

export function MarquerRetourLu({ bilanId }: { bilanId: string }) {
  useEffect(() => {
    void marquerRetourLu(bilanId);
  }, [bilanId]);
  return null;
}
