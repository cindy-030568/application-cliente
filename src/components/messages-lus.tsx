"use client";

import { useEffect } from "react";
import { marquerMessagesLus } from "@/app/messages-actions";

/** Note « lu » les messages de la coach affichés sur l'accueil (une fois). */
export function MarquerMessagesLus({ ids }: { ids: string[] }) {
  const cle = ids.join(",");
  useEffect(() => {
    if (cle) void marquerMessagesLus(cle.split(","));
  }, [cle]);
  return null;
}
