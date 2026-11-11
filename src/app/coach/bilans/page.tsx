import type { Metadata } from "next";
import Link from "next/link";
import { IconeFleche } from "@/components/icones";
import { Carte, Etiquette, Surtitre, cx } from "@/components/ui";
import { formaterDate } from "@/lib/bilan";
import { chargerFile } from "./donnees";

export const metadata: Metadata = { title: "Bilans" };

const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

export default async function PageBilans({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const { onglet = "a-traiter" } = await searchParams;
  const { aTraiter, traites, alertes } = await chargerFile();
  const manquants = alertes.flatMap(({ cliente, alerte }) =>
    alerte.type === "bilan_manquant" ? [{ cliente, ...alerte }] : [],
  );

  const onglets = [
    { cle: "a-traiter", label: "À traiter", n: aTraiter.length },
    { cle: "manquants", label: "Manquants", n: manquants.length },
    { cle: "traites", label: "Traités", n: traites.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Surtitre>Bilans</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">La file des bilans</h1>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer les bilans">
        {onglets.map((o) => (
          <Link
            key={o.cle}
            href={`/coach/bilans?onglet=${o.cle}`}
            aria-current={onglet === o.cle ? "page" : undefined}
            className={cx(
              "rounded-full px-4 py-2 text-[14px] transition-colors",
              onglet === o.cle ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat hover:bg-sable",
            )}
          >
            {o.label} <span className="opacity-70">({o.n})</span>
          </Link>
        ))}
      </nav>

      <Carte className="overflow-hidden p-0">
        {onglet === "manquants" ? (
          manquants.length === 0 ? (
            <p className="p-6 text-center text-texte-2">Aucun bilan manquant. 🎉</p>
          ) : (
            <ul className="divide-y divide-ligne">
              {manquants.map((m) => (
                <li key={m.cliente.id}>
                  <Link
                    href={`/coach/clientes/${m.cliente.id}/suivi`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sable/30"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {m.cliente.profils.prenom} {m.cliente.profils.nom}
                      </span>
                      <span className="text-[13.5px] text-texte-2">
                        Bilan du {formaterDate(m.echeance, { year: undefined })}
                      </span>
                    </span>
                    <Etiquette ton="rose">
                      {m.retard} jour{m.retard > 1 ? "s" : ""} de retard
                    </Etiquette>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : (
          (() => {
            const liste = onglet === "traites" ? traites : aTraiter;
            if (liste.length === 0)
              return (
                <p className="p-6 text-center text-texte-2">
                  {onglet === "traites" ? "Aucun bilan traité pour l’instant." : "Tout est traité. Bravo 💛"}
                </p>
              );
            return (
              <ul className="divide-y divide-ligne">
                {liste.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/coach/bilans/${b.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-sable/30"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-pale font-titre font-bold">
                        {(b.nom[0] ?? "?").toUpperCase()}
                      </span>
                      <span className="flex flex-1 flex-col">
                        <span className="font-medium">{b.nom}</span>
                        <span className="text-[13.5px] text-texte-2">
                          {b.echeance ? "Bilan" : "Saisie libre"} du {formaterDate(b.date_mesure, { year: undefined })} ·
                          reçu le {dateHeure.format(new Date(b.envoye_le))}
                        </span>
                      </span>
                      {onglet === "traites" ? (
                        <Etiquette ton="vert">Traité</Etiquette>
                      ) : (
                        <IconeFleche className="size-4 shrink-0 text-texte-2" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            );
          })()
        )}
      </Carte>
    </div>
  );
}
