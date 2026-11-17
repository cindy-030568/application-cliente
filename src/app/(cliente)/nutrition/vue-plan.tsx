import Link from "next/link";
import { Etiquette, Surtitre, classesBouton } from "@/components/ui";
import { COULEURS_MACROS, apportsPlan, apportsRepas, repasRemplis, texteChoix } from "@/lib/plan-alimentaire";
import type { PlanAlimentaire } from "@/lib/plan-alimentaire-serveur";
import { EnTete } from "../composants";
import { MarquerPlanVu } from "./marquer-vu";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateLongue = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** Le plan alimentaire construit dans l'app, tel que la cliente le lit. */
export function VuePlanAlimentaire({ plan, sansChiffres, plansPdf }: { plan: PlanAlimentaire; sansChiffres: boolean; plansPdf: boolean }) {
  const t = apportsPlan(plan.contenu);
  return (
    <>
      <EnTete titre="Mon plan alimentaire" sousTitre={`${plan.titre} · mis à jour le ${dateLongue.format(new Date(plan.publie_le ?? plan.updated_at))}`} />
      {!plan.vu_le && <MarquerPlanVu planId={plan.id} />}

      <div className="flex flex-col gap-5 px-5 pt-3">
        {!plan.vu_le && (
          <div>
            <Etiquette>Nouveau</Etiquette>
          </div>
        )}

        {!sansChiffres && t.kcal > 0 && (
          <div className="flex flex-col gap-3 rounded-carte bg-chocolat p-4 text-creme">
            <p className="text-[14px] text-texte-clair">Ta journée type</p>
            <p className="font-titre text-[28px] font-bold leading-none tabular-nums">≈ {nf.format(t.kcal)} kcal</p>
            <dl className="grid grid-cols-3 gap-2 text-[13px]">
              {(
                [
                  ["Protéines", t.proteines, COULEURS_MACROS.proteines],
                  ["Glucides", t.glucides, COULEURS_MACROS.glucides],
                  ["Lipides", t.lipides, COULEURS_MACROS.lipides],
                ] as const
              ).map(([n, v, c]) => (
                <div key={n} className="flex flex-col">
                  <dt className="flex items-center gap-1.5 text-texte-clair">
                    <span className="size-2 rounded-full" style={{ background: c }} />
                    {n}
                  </dt>
                  <dd className="font-medium tabular-nums">{nf.format(v)} g</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="text-[14px] text-texte-2">
          Les propositions <strong className="font-medium text-chocolat">« ou »</strong> sont des équivalences : choisis celle qui te fait envie.
        </p>

        {repasRemplis(plan.contenu).map((r, i) => (
          <section key={i} className="flex flex-col gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce" aria-labelledby={`repas-${i}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`repas-${i}`} className="font-titre text-xl font-bold">
                {r.heure && <span className="mr-2 text-[15px] font-medium tabular-nums text-caramel-texte">{r.heure}</span>}
                {r.libelle}
              </h2>
              {!sansChiffres && r.lignes.length > 0 && (
                <span className="shrink-0 text-[13px] tabular-nums text-texte-2">{nf.format(apportsRepas(r).kcal)} kcal</span>
              )}
            </div>
            {r.lignes.length > 0 && (
              <ul className="flex flex-col divide-y divide-ligne">
                {r.lignes.map((l, j) => (
                  <li key={j} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                    <span className="text-[15.5px] font-medium">{texteChoix(l.principal)}</span>
                    {l.alternatives.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {l.alternatives.map((a, k) => (
                          <li key={k} className="rounded-full bg-sable/70 px-3 py-1 text-[13.5px]">
                            <span className="text-caramel-texte">ou</span> {texteChoix(a)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {r.note.trim() && <p className="whitespace-pre-line rounded-xl bg-accent-pale/50 px-3 py-2.5 text-[14px]">{r.note.trim()}</p>}
          </section>
        ))}

        {plan.recommandations.trim() && (
          <section className="flex flex-col gap-2 rounded-carte bg-blanc-casse p-4 shadow-douce" aria-labelledby="recos">
            <Surtitre>
              <span id="recos">Recommandations</span>
            </Surtitre>
            <p className="whitespace-pre-line text-[14.5px] leading-relaxed">{plan.recommandations.trim()}</p>
          </section>
        )}

        <a href={`/plan-alimentaire/${plan.id}/pdf`} className={classesBouton("sombre", true)}>
          Télécharger en PDF
        </a>
        {plansPdf && (
          <Link href="/nutrition?pdf=1" className="text-center text-[14px] text-texte-2 underline underline-offset-4">
            Voir mes anciens plans en PDF
          </Link>
        )}
      </div>
    </>
  );
}
