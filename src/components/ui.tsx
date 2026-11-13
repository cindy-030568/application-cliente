import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("font-titre font-bold tracking-tight text-chocolat", className)}>
      fitw<span className="text-caramel">_</span>cindy
    </span>
  );
}

const STYLES_BOUTON = {
  principal:
    "bg-accent text-white hover:bg-accent-fonce hover:-translate-y-0.5 hover:shadow-bouton active:translate-y-0",
  sombre: "bg-chocolat text-creme hover:bg-carte-sombre hover:-translate-y-0.5 hover:shadow-bouton",
  contour: "border-[1.5px] border-chocolat text-chocolat hover:bg-chocolat hover:text-creme",
  discret: "text-texte-2 underline underline-offset-4 hover:text-chocolat",
  danger: "border-[1.5px] border-erreur text-erreur hover:bg-erreur hover:text-white",
} as const;

export type VarianteBouton = keyof typeof STYLES_BOUTON;

export function classesBouton(variante: VarianteBouton = "principal", pleineLargeur = false) {
  return cx(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium",
    "transition-[translate,background-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-60",
    variante === "discret" && "min-h-0 px-0 py-1",
    pleineLargeur && "w-full",
    STYLES_BOUTON[variante],
  );
}

export function Bouton({
  variante = "principal",
  pleineLargeur,
  className,
  ...props
}: ComponentProps<"button"> & { variante?: VarianteBouton; pleineLargeur?: boolean }) {
  return <button className={cx(classesBouton(variante, pleineLargeur), className)} {...props} />;
}

export function LienBouton({
  variante = "principal",
  pleineLargeur,
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: VarianteBouton; pleineLargeur?: boolean }) {
  return <Link className={cx(classesBouton(variante, pleineLargeur), className)} {...props} />;
}

export function Carte({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-carte bg-blanc-casse p-5 shadow-douce", className)} {...props}>
      {children}
    </div>
  );
}

export function Etiquette({
  children,
  ton = "rose",
  className,
}: {
  children: ReactNode;
  ton?: "rose" | "sable" | "sombre" | "vert";
  className?: string;
}) {
  const tons = {
    rose: "bg-accent-pale text-chocolat",
    sable: "bg-sable text-chocolat",
    sombre: "bg-chocolat text-creme",
    vert: "bg-succes-pale text-succes",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-[12.5px] font-medium leading-tight",
        tons[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Champ({
  label,
  aide,
  erreur,
  className,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; aide?: string; erreur?: string }) {
  const identifiant = id ?? props.name;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={identifiant} className="text-sm font-medium text-chocolat">
        {label}
      </label>
      <input
        id={identifiant}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={aide ? `${identifiant}-aide` : undefined}
        className={cx(
          "min-h-12 rounded-xl border border-ligne bg-white px-4 text-[16px] text-chocolat",
          "placeholder:text-texte-2/60 focus:border-chocolat focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent-pale",
          erreur && "border-erreur",
        )}
        {...props}
      />
      {aide && (
        <p id={`${identifiant}-aide`} className="text-[13px] text-texte-2">
          {aide}
        </p>
      )}
      {erreur && <p className="text-[13px] text-erreur">{erreur}</p>}
    </div>
  );
}

export function ZoneTexte({
  label,
  className,
  id,
  ...props
}: ComponentProps<"textarea"> & { label: string }) {
  const identifiant = id ?? props.name;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={identifiant} className="text-sm font-medium text-chocolat">
        {label}
      </label>
      <textarea
        id={identifiant}
        className="min-h-28 rounded-xl border border-ligne bg-white px-4 py-3 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent-pale"
        {...props}
      />
    </div>
  );
}

export function CaseACocher({
  label,
  aide,
  ...props
}: ComponentProps<"input"> & { label: string; aide?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-[var(--accent)]"
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-[15px] text-chocolat">{label}</span>
        {aide && <span className="text-[13px] text-texte-2">{aide}</span>}
      </span>
    </label>
  );
}

export function Message({
  ton = "info",
  children,
}: {
  ton?: "info" | "erreur" | "succes";
  children: ReactNode;
}) {
  const tons = {
    info: "bg-sable/60 text-chocolat",
    erreur: "bg-accent-pale text-erreur",
    succes: "bg-succes-pale text-succes",
  };
  return (
    <p role={ton === "erreur" ? "alert" : "status"} className={cx("rounded-xl px-4 py-3 text-[14px]", tons[ton])}>
      {children}
    </p>
  );
}

export function Surtitre({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte", className)}>
      {children}
    </p>
  );
}
