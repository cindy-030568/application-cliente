import { GraphiqueSuivi } from "@/components/suivi/graphique";
import { cx } from "@/components/ui";
import {
  INDICATEURS,
  ecartsMensuels,
  semainesJournal,
  syntheseJournal,
  tonValeur,
  type CleIndicateur,
  type EntreeJournal,
} from "@/lib/journal";

const jourCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const jourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function fmt(cle: CleIndicateur, v: number | null, avecUnite = true) {
  if (v === null) return "—";
  const ind = INDICATEURS.find((i) => i.cle === cle)!;
  const n = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: ind.decimales }).format(v);
  return avecUnite && ind.unite ? `${n}${ind.unite.startsWith("/") ? "" : " "}${ind.unite}` : n;
}
const signe = (v: number | null, unite: string) =>
  v === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(v)} ${unite}`;

const TONS = { bon: "bg-succes-pale text-succes", moyen: "bg-sable text-chocolat", faible: "bg-accent-pale text-erreur" } as const;

function Pastille({ cle, v }: { cle: CleIndicateur; v: number | null }) {
  const ton = tonValeur(cle, v);
  return <span className={cx("rounded-md px-1.5 py-0.5 tabular-nums", ton ? TONS[ton] : "")}>{fmt(cle, v)}</span>;
}

/** Tableau de suivi : synthèse, écarts mensuels, courbes hebdo et semaine après semaine. */
export function VueJournal({
  entrees,
  debut,
  aujourdhui,
  sansChiffres = false,
}: {
  entrees: EntreeJournal[];
  debut: string;
  aujourdhui: string;
  sansChiffres?: boolean;
}) {
  if (entrees.length === 0) {
    return <p className="text-[14px] text-texte-2">Pas encore de journée notée.</p>;
  }
  const semaines = semainesJournal(entrees, debut, aujourdhui);
  const synthese = syntheseJournal(semaines);
  const mois = ecartsMensuels(semaines);
  const cles = INDICATEURS.map((i) => i.cle).filter((c) => !sansChiffres || (c !== "poids" && c !== "tour_taille"));
  const chrono = [...semaines].reverse();
  const courbes = cles.filter((c) => chrono.filter((s) => s.valeurs[c] !== null).length >= 2);

  const ligneSynthese: [string, string][] = [
    ...(!sansChiffres
      ? ([
          ["Poids : départ → actuel", `${fmt("poids", synthese.poidsDepart)} → ${fmt("poids", synthese.poidsActuel)} (${signe(synthese.variationPoids, "kg")})`],
          ["Tour de taille : départ → actuel", `${fmt("tour_taille", synthese.tailleDepart)} → ${fmt("tour_taille", synthese.tailleActuelle)} (${signe(synthese.variationTaille, "cm")})`],
        ] as [string, string][])
      : []),
    ["Sommeil moyen", fmt("sommeil", synthese.sommeil)],
    ["Hydratation moyenne", fmt("hydratation", synthese.hydratation)],
    ["Pas moyens par jour", fmt("pas", synthese.pas)],
    ["Trainings par semaine", `${fmt("trainings", synthese.trainingsParSemaine)} (total : ${synthese.totalTrainings})`],
    ["Stress moyen", fmt("stress", synthese.stress)],
    ["Digestion moyenne", fmt("digestion", synthese.digestion)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="font-titre text-lg font-bold">Synthèse</h3>
        <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-blanc-casse p-4 shadow-douce sm:grid-cols-2">
          {ligneSynthese.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-ligne/60 py-1.5 last:border-0">
              <dt className="text-[13.5px] text-texte-2">{k}</dt>
              <dd className="text-right text-[14.5px] font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {!sansChiffres && mois.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-[13.5px]">
              <thead>
                <tr className="text-left text-texte-2">
                  <th className="py-1 pr-4 font-normal">Écart depuis la semaine 1</th>
                  {mois.map((m) => (
                    <th key={m.mois} className="px-3 py-1 text-right font-normal">Mois {m.mois}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-4">Poids</td>
                  {mois.map((m) => <td key={m.mois} className="px-3 py-1 text-right tabular-nums">{signe(m.poids, "kg")}</td>)}
                </tr>
                <tr>
                  <td className="py-1 pr-4">Tour de taille</td>
                  {mois.map((m) => <td key={m.mois} className="px-3 py-1 text-right tabular-nums">{signe(m.tour_taille, "cm")}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-titre text-lg font-bold">Semaine par semaine</h3>
        {semaines.map((s, i) => (
          <details key={s.numero} open={i === 0} className="group rounded-xl bg-blanc-casse shadow-douce">
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-4 py-3">
              <span className="font-medium">
                Semaine {s.numero}{" "}
                <span className="text-[13px] font-normal text-texte-2">
                  · {jourCourt.format(d(s.debut))} → {jourCourt.format(d(s.fin))}
                </span>
              </span>
              <span className="text-[12.5px] text-texte-2">
                {s.joursRemplis}/7 jours{s.joursRegles ? ` · règles ${s.joursRegles} j` : ""}
              </span>
            </summary>
            <div className="flex flex-col gap-3 px-4 pb-4">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {cles.map((c) => (
                  <div key={c} className="flex flex-col rounded-lg bg-white px-3 py-2">
                    <dt className="text-[12px] text-texte-2">
                      {INDICATEURS.find((x) => x.cle === c)!.libelle}
                      {c === "trainings" ? " (total)" : " (moy.)"}
                    </dt>
                    <dd className="text-[15px] font-medium">
                      <Pastille cle={c} v={s.valeurs[c]} />
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-[13px]">
                  <thead>
                    <tr className="text-left text-texte-2">
                      <th className="py-1 pr-3 font-normal">Jour</th>
                      {cles.map((c) => (
                        <th key={c} className="px-2 py-1 text-right font-normal">{INDICATEURS.find((x) => x.cle === c)!.libelle.replace(" (NEAT)", "")}</th>
                      ))}
                      <th className="px-2 py-1 font-normal">Règles</th>
                      <th className="px-2 py-1 font-normal">Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.jours.map((j, k) => {
                      const date = new Date(d(s.debut).getTime() + k * 86_400_000).toISOString().slice(0, 10);
                      if (date > aujourdhui) return null;
                      return (
                        <tr key={date} className="border-t border-ligne/60 align-top">
                          <td className="py-1.5 pr-3 capitalize">{jourSemaine.format(d(date))}</td>
                          {cles.map((c) => (
                            <td key={c} className="px-2 py-1.5 text-right">
                              {j && j[c] !== null ? <Pastille cle={c} v={j[c]} /> : <span className="text-texte-2/50">·</span>}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center">{j?.regles ? "●" : ""}</td>
                          <td className="max-w-64 px-2 py-1.5 text-texte-2">{j?.observations}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        ))}
      </section>
      {courbes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-titre text-lg font-bold">Les courbes</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {courbes.map((c) => {
              const ind = INDICATEURS.find((i) => i.cle === c)!;
              return (
                <GraphiqueSuivi
                  key={c}
                  titre={`${ind.libelle}${c === "trainings" ? " (total)" : " (moyenne)"}`}
                  unite={ind.unite || null}
                  points={chrono.filter((s) => s.valeurs[c] !== null).map((s) => ({ date: s.debut, valeur: s.valeurs[c]! }))}
                />
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}
