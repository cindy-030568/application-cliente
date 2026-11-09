"use client";

import { useFormStatus } from "react-dom";
import { Bouton, type VarianteBouton } from "./ui";

export function BoutonEnvoi({
  children,
  enCours = "Un instant…",
  variante = "principal",
  pleineLargeur,
  className,
}: {
  children: React.ReactNode;
  enCours?: string;
  variante?: VarianteBouton;
  pleineLargeur?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Bouton
      type="submit"
      variante={variante}
      pleineLargeur={pleineLargeur}
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? enCours : children}
    </Bouton>
  );
}
