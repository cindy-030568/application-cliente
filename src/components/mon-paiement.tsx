import { formaterDate, joursEntre } from "@/lib/bilan";
import { MOYENS, formaterEuros } from "@/lib/paiements";
import type { MonPaiement } from "@/lib/paiements-serveur";
import { cx } from "@/components/ui";

/** Carte « Ma formule et mes paiements » du profil : formule et échéancier. */
export function CarteMonPaiement({ p, aujourdhui }: { p: MonPaiement; aujourdhui: string }) {
  const paye = p.echeances.filter((e) => e.payee).reduce((s, e) => s + Math.round(e.montant * 100), 0) / 100;
  const total = p.echeances.reduce((s, e) => s + Math.round(e.montant * 100), 0) / 100;
  return (
    <div className="flex flex-col gap-4 rounded-carte bg-blanc-casse p-5 shadow-douce">
      <div>
        <h2 className="font-titre text-xl font-bold">Ma formule et mes paiements</h2>
        {p.formule && <p className="text-[15px]">{p.formule}</p>}
        {(p.montant_total !== null || p.moyen) && (
          <p className="text-[13.5px] text-texte-2">
            {[
              p.montant_total !== null && formaterEuros(p.montant_total),
              p.nb_fois > 1 && `en ${p.nb_fois} fois`,
              p.moyen && MOYENS[p.moyen].toLowerCase(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
      {p.echeances.length > 1 && (
        <>
          <ul className="flex flex-col divide-y divide-ligne rounded-xl border border-ligne bg-white">
            {p.echeances.map((e, i) => {
              const statut = e.payee ? "payee" : e.date_echeance < aujourdhui ? "attente" : "venir";
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium tabular-nums">{formaterEuros(e.montant)}</span>
                    <span className="text-[13px] text-texte-2">{formaterDate(e.date_echeance)}</span>
                  </span>
                  <span
                    className={cx(
                      "rounded-full px-2.5 py-1 text-[12.5px] font-medium",
                      statut === "payee" ? "bg-succes-pale text-succes" : "bg-sable text-chocolat",
                    )}
                  >
                    {statut === "payee" ? "Réglée ✓" : statut === "attente" ? "En attente" : "À venir"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[13px] text-texte-2">
            Réglé : {formaterEuros(paye)} sur {formaterEuros(total)}. Une question sur un paiement ? Écris simplement à Cindy.
          </p>
        </>
      )}
    </div>
  );
}

/** Prochaine mensualité à signaler sur l'accueil (de 7 jours de retard à 3 jours avant), ou null. */
export function mensualiteASignaler(p: MonPaiement | null, aujourdhui: string) {
  if (!p || p.echeances.length < 2) return null;
  const e = p.echeances.find((x) => !x.payee && joursEntre(aujourdhui, x.date_echeance) <= 3 && joursEntre(x.date_echeance, aujourdhui) <= 7);
  if (!e) return null;
  const j = joursEntre(aujourdhui, e.date_echeance);
  const quand = j === 0 ? "aujourd’hui" : j === 1 ? "demain" : `le ${formaterDate(e.date_echeance, { year: undefined })}`;
  return j >= 0
    ? { titre: `Mensualité de ${formaterEuros(e.montant)} ${quand}`, texte: "Un petit rappel pour ton accompagnement 💛" }
    : {
        titre: `Mensualité du ${formaterDate(e.date_echeance, { year: undefined })} : ${formaterEuros(e.montant)}`,
        texte: "Pas encore notée comme reçue. Déjà réglée ? Pas de souci, Cindy la cochera.",
      };
}
