import Link from "next/link";
import { IconePlus } from "@/components/icones";
import { Carte, LienBouton, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis, formaterDate, joursEntre, prochainBilan } from "@/lib/bilan";
import { listerClientes } from "./donnees";

export default async function TableauDeBord() {
  const { profil } = await exigerCoach();
  const clientes = await listerClientes();
  const auj = aujourdhuiParis();

  const actives = clientes.filter((c) => c.statut === "active");
  const bilans = actives
    .map((c) => ({ c, date: prochainBilan(c.date_debut, c.frequence_bilan_jours, auj) }))
    .filter((b): b is { c: (typeof actives)[number]; date: string } => b.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Tableau de bord</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">
            Bonjour {profil.prenom || "Cindy"} 💛
          </h1>
        </div>
        <LienBouton href="/coach/clientes/nouvelle">
          <IconePlus className="size-5" /> Nouvelle cliente
        </LienBouton>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Chiffre valeur={actives.length} label="clientes actives" />
        <Chiffre valeur={clientes.filter((c) => c.statut === "terminee").length} label="suivis terminés" />
        <Chiffre valeur={clientes.filter((c) => c.acces_formation).length} label="accès formation" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Carte className="flex flex-col gap-4">
          <h2 className="font-titre text-xl font-bold">Prochains bilans</h2>
          {bilans.length === 0 ? (
            <p className="text-[14px] text-texte-2">
              Aucun bilan prévu. Renseigne une date de début dans la fiche d’une cliente active.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-ligne">
              {bilans.map(({ c, date }) => {
                const j = joursEntre(auj, date);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/coach/clientes/${c.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:text-accent"
                    >
                      <span className="font-medium">
                        {c.profils.prenom} {c.profils.nom}
                      </span>
                      <span className="text-[14px] text-texte-2">
                        {j === 0 ? "aujourd’hui" : j === 1 ? "demain" : formaterDate(date, { year: undefined })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
        <Carte className="flex flex-col gap-3 border border-dashed border-caramel-clair bg-blanc-casse/60 shadow-none">
          <h2 className="font-titre text-xl font-bold">Dernières mesures</h2>
          <p className="text-[14px] text-texte-2">
            Les dernières saisies de tes clientes s’afficheront ici avec le suivi des mesures
            (phase 3).
          </p>
        </Carte>
      </div>
    </div>
  );
}

function Chiffre({ valeur, label }: { valeur: number; label: string }) {
  return (
    <Carte className="flex flex-col gap-1">
      <span className="font-titre text-[38px] font-bold leading-none">{valeur}</span>
      <span className="text-[14px] text-texte-2">{label}</span>
    </Carte>
  );
}
