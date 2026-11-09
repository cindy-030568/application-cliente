import type { Metadata } from "next";
import Link from "next/link";
import { IconeFleche, IconePlus } from "@/components/icones";
import { Carte, LienBouton, Message, Surtitre, cx } from "@/components/ui";
import { formaterDate } from "@/lib/bilan";
import type { StatutCliente } from "@/lib/types";
import { BadgeStatut } from "../badge-statut";
import { listerClientes } from "../donnees";

export const metadata: Metadata = { title: "Clientes" };

const FILTRES: { valeur: StatutCliente | "toutes"; label: string }[] = [
  { valeur: "active", label: "Actives" },
  { valeur: "terminee", label: "Suivi terminé" },
  { valeur: "fermee", label: "Accès fermé" },
  { valeur: "toutes", label: "Toutes" },
];

export default async function PageClientes({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; supprimee?: string }>;
}) {
  const { statut = "active", supprimee } = await searchParams;
  const toutes = await listerClientes();
  const clientes = statut === "toutes" ? toutes : toutes.filter((c) => c.statut === statut);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Clientes</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Mes clientes</h1>
        </div>
        <LienBouton href="/coach/clientes/nouvelle">
          <IconePlus className="size-5" /> Nouvelle cliente
        </LienBouton>
      </div>

      {supprimee && <Message ton="succes">La cliente et toutes ses données ont été supprimées.</Message>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {FILTRES.map((f) => {
          const n = f.valeur === "toutes" ? toutes.length : toutes.filter((c) => c.statut === f.valeur).length;
          const actif = statut === f.valeur;
          return (
            <Link
              key={f.valeur}
              href={`/coach/clientes?statut=${f.valeur}`}
              aria-current={actif ? "true" : undefined}
              className={cx(
                "rounded-full px-4 py-2 text-[14px] transition-colors",
                actif ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat hover:bg-sable",
              )}
            >
              {f.label} <span className="opacity-70">({n})</span>
            </Link>
          );
        })}
      </div>

      {clientes.length === 0 ? (
        <Carte className="text-center text-texte-2">
          Aucune cliente ici pour l’instant.
        </Carte>
      ) : (
        <Carte className="overflow-hidden p-0">
          <ul className="divide-y divide-ligne">
            {clientes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/coach/clientes/${c.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sable/30"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-pale font-titre text-lg font-bold">
                    {(c.profils.prenom[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {c.profils.prenom} {c.profils.nom}
                    </span>
                    <span className="truncate text-[13.5px] text-texte-2">{c.profils.email}</span>
                  </span>
                  <span className="hidden flex-col items-end gap-1 text-[13px] text-texte-2 sm:flex">
                    <BadgeStatut statut={c.statut} />
                    {c.date_debut && <span>depuis le {formaterDate(c.date_debut)}</span>}
                  </span>
                  <IconeFleche className="size-4 shrink-0 text-texte-2" />
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}
