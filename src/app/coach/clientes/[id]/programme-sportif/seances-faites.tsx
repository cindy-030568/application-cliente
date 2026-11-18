import { Carte, Message } from "@/components/ui";
import { RESSENTIS, formaterKg, regrouperCharges, type LigneCharge, type SeanceCharges } from "@/lib/seance-guidee";
import type { SeanceFaite } from "@/lib/seances-faites-serveur";

const date = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Historique des séances validées par la cliente en mode séance. */
export function SeancesFaites({ seances, prenom }: { seances: SeanceFaite[] | null; prenom: string }) {
  return (
    <Carte className="flex flex-col gap-4">
      <div>
        <h2 className="font-titre text-xl font-bold">Séances faites</h2>
        <p className="text-[14px] text-texte-2">Validées par {prenom} à la fin du mode séance, avec son ressenti.</p>
      </div>
      {seances === null ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0019_seances_faites.sql (voir le guide).</Message>
      ) : seances.length === 0 ? (
        <p className="text-[14px] text-texte-2">Aucune séance validée pour l’instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ligne">
          {seances.map((s) => {
            const r = RESSENTIS.find((x) => x.valeur === s.ressenti);
            return (
              <li key={s.id} className="flex flex-col gap-1 py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[15px] font-medium">{s.seance_nom}</span>
                  <span className="text-[13px] text-texte-2">{date.format(new Date(s.faite_le))}</span>
                </span>
                <span className="flex flex-wrap gap-1.5 text-[12.5px]">
                  {s.duree_minutes !== null && <span className="rounded-full bg-sable/70 px-2 py-0.5">{s.duree_minutes} min</span>}
                  {r && (
                    <span className="rounded-full bg-sable/70 px-2 py-0.5">
                      {r.emoji} {r.libelle}
                    </span>
                  )}
                </span>
                {s.commentaire && <p className="whitespace-pre-line text-[14px] italic text-texte-2">« {s.commentaire} »</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );
}

const jour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** Progression des charges : par exercice, la dernière séance et la précédente. */
export function PoidsUtilises({ lignes, prenom }: { lignes: (LigneCharge & { exercice_nom: string })[] | null; prenom: string }) {
  if (lignes === null) return null; // mise à jour 0021 pas encore faite
  const historique = regrouperCharges(lignes);
  const noms = new Map(lignes.map((l) => [l.exercice_cle, l.exercice_nom]));
  const exercices = Object.entries(historique)
    .filter(([, seances]) => seances.some((s) => s.series.some((x) => x.kg > 0)))
    .sort(([, a], [, b]) => b[0].date.localeCompare(a[0].date))
    .slice(0, 20);
  const serie = (s: SeanceCharges) => `${s.series.map((x) => formaterKg(x.kg)).join(" · ")} kg`;
  const max = (s: SeanceCharges) => Math.max(...s.series.map((x) => x.kg));
  return (
    <Carte className="flex flex-col gap-4">
      <div>
        <h2 className="font-titre text-xl font-bold">Poids utilisés</h2>
        <p className="text-[14px] text-texte-2">Notés par {prenom} pendant ses séances, série par série.</p>
      </div>
      {exercices.length === 0 ? (
        <p className="text-[14px] text-texte-2">Aucun poids noté pour l’instant.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ligne">
          {exercices.map(([cle, seances]) => {
            const [derniere, avant] = seances;
            const ecart = avant ? max(derniere) - max(avant) : 0;
            return (
              <li key={cle} className="flex flex-col gap-0.5 py-2.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">{noms.get(cle) ?? cle}</span>
                  {ecart !== 0 && (
                    <span className={ecart > 0 ? "text-[13px] font-medium text-succes" : "text-[13px] text-texte-2"}>
                      {ecart > 0 ? "+" : "−"}
                      {formaterKg(Math.abs(ecart))} kg
                    </span>
                  )}
                </span>
                <span className="text-[13.5px]">
                  {jour.format(new Date(derniere.date))} : <strong className="font-medium">{serie(derniere)}</strong>
                </span>
                {avant && (
                  <span className="text-[13px] text-texte-2">
                    avant ({jour.format(new Date(avant.date))}) : {serie(avant)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );
}
