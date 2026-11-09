import { Etiquette } from "@/components/ui";
import { LIBELLES_STATUT, type StatutCliente } from "@/lib/types";

export function BadgeStatut({ statut }: { statut: StatutCliente }) {
  const ton = statut === "active" ? "vert" : statut === "terminee" ? "sable" : "sombre";
  return <Etiquette ton={ton}>{LIBELLES_STATUT[statut]}</Etiquette>;
}
