import { cx } from "@/components/ui";
import { COULEURS_MACROS, apportsPlan, apportsRepas, type ContenuPlan, type Objectifs } from "@/lib/plan-alimentaire";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Barre « valeur / objectif » : pleine à 100 %, repère d'excès au-delà. */
function Jauge({ nom, valeur, objectif, unite, couleur, note, inconnu = false }: { nom: string; valeur: number; objectif: number | null; unite: string; couleur: string; note?: string; inconnu?: boolean }) {
  const ratio = objectif && !inconnu ? valeur / objectif : null;
  const ecart = ratio == null ? null : Math.round((ratio - 1) * 100);
  const horsCible = ecart != null && Math.abs(ecart) > 10;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
        <span className="font-medium">{nom}</span>
        <span className="tabular-nums">
          <strong className="font-semibold">{inconnu ? "—" : unite === "kcal" ? nf.format(valeur) : nf1.format(valeur)}</strong>
          {objectif ? <span className="text-texte-2"> / {nf.format(objectif)} {unite}</span> : <span className="text-texte-2"> {unite}</span>}
          {ecart != null && ecart !== 0 && (
            <span className={cx("ml-1.5 text-[12px]", horsCible ? "font-medium text-erreur" : "text-texte-2")}>
              {ecart > 0 ? "+" : ""}
              {ecart} %
            </span>
          )}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sable" role="presentation">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (ratio ?? 0) * 100)}%`, background: couleur }} />
      </div>
      {note && <p className="text-[11.5px] text-texte-2">{note}</p>}
    </div>
  );
}

export function AnalysePlan({ contenu, objectifs, compacte = false }: { contenu: ContenuPlan; objectifs: Objectifs | null; compacte?: boolean }) {
  const t = apportsPlan(contenu);
  const kcalMacros = 9 * t.lipides + 4 * t.glucides + 4 * t.proteines;
  const pct = (x: number) => (kcalMacros ? Math.round((x / kcalMacros) * 100) : 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Jauge nom="Énergie" valeur={t.kcal} objectif={objectifs?.kcal ?? null} unite="kcal" couleur={COULEURS_MACROS.kcal} />
        <Jauge nom={`Lipides · ${pct(9 * t.lipides)} %`} valeur={t.lipides} objectif={objectifs?.lipides ?? null} unite="g" couleur={COULEURS_MACROS.lipides} />
        <Jauge nom={`Glucides · ${pct(4 * t.glucides)} %`} valeur={t.glucides} objectif={objectifs?.glucides ?? null} unite="g" couleur={COULEURS_MACROS.glucides} />
        <Jauge nom={`Protéines · ${pct(4 * t.proteines)} %`} valeur={t.proteines} objectif={objectifs?.proteines ?? null} unite="g" couleur={COULEURS_MACROS.proteines} />
        <Jauge
          nom="Fibres"
          valeur={t.fibres}
          objectif={objectifs?.fibres ?? null}
          unite="g"
          couleur={COULEURS_MACROS.fibres}
          inconnu={t.fibresIncompletes && t.fibres === 0}
          note={t.fibresIncompletes ? "Fibres partielles : certaines valeurs ne sont pas encore importées." : undefined}
        />
      </div>
      {!objectifs && <p className="text-[12.5px] text-texte-2">Pas d’objectif : renseigne ses besoins pour comparer.</p>}
      {!compacte && contenu.repas.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-ligne pt-3">
          <p className="text-[13px] font-medium">Répartition par repas</p>
          <ul className="flex flex-col gap-2">
            {contenu.repas.map((r, i) => {
              const a = apportsRepas(r);
              const tot = 9 * a.lipides + 4 * a.glucides + 4 * a.proteines || 1;
              return (
                <li key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-[12.5px]">
                    <span className="truncate">
                      {r.heure && <span className="tabular-nums text-texte-2">{r.heure} · </span>}
                      {r.libelle}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {nf.format(a.kcal)} kcal <span className="text-texte-2">· {t.kcal ? Math.round((a.kcal / t.kcal) * 100) : 0} %</span>
                    </span>
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-sable" role="presentation">
                    {a.kcal > 0 && (
                      <>
                        <span style={{ width: `${((9 * a.lipides) / tot) * 100}%`, background: COULEURS_MACROS.lipides }} />
                        <span style={{ width: `${((4 * a.glucides) / tot) * 100}%`, background: COULEURS_MACROS.glucides }} />
                        <span style={{ width: `${((4 * a.proteines) / tot) * 100}%`, background: COULEURS_MACROS.proteines }} />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="flex flex-wrap gap-3 text-[11.5px] text-texte-2">
            {(["lipides", "glucides", "proteines"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ background: COULEURS_MACROS[k] }} />
                {k === "proteines" ? "protéines" : k}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
