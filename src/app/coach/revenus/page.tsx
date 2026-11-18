import type { Metadata } from "next";
import Link from "next/link";
import { Carte, Message, Surtitre, cx } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { formaterEuros } from "@/lib/paiements";
import { MOIS_COURTS, aEncaisser, encaissements, synthese } from "@/lib/revenus";
import { lireMouvements } from "@/lib/revenus-serveur";
import { ajouterRevenu } from "./actions";
import { FormRevenu, LigneMouvement } from "./composants";

export const metadata: Metadata = { title: "Revenus" };

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function PageRevenus({ searchParams }: { searchParams: Promise<{ annee?: string; mois?: string }> }) {
  const { annee: a, mois: mo } = await searchParams;
  const { supabase } = await exigerCoach();
  const auj = aujourdhuiParis();
  const anCourant = Number(auj.slice(0, 4));
  const an = /^\d{4}$/.test(a ?? "") && Math.abs(Number(a) - anCourant) <= 20 ? Number(a) : anCourant;
  const moisFiltre = /^(1[0-2]|[1-9])$/.test(mo ?? "") ? Number(mo) : null;

  const donnees = await lireMouvements(supabase);
  if (!donnees) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-titre text-[34px] font-bold leading-tight">Mes revenus</h1>
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0010_formule_paiement_sport.sql (voir le guide).</Message>
      </div>
    );
  }
  const { mouvements, clientes, divers } = donnees;
  const s = synthese(mouvements, an, auj);
  const restes = aEncaisser(mouvements);
  const retards = restes.filter((m) => m.date_prevue < auj);
  const aVenir = restes.filter((m) => m.date_prevue >= auj);
  const liste = encaissements(mouvements, an, moisFiltre);
  const max = Math.max(1, ...s.parMois.flatMap((p) => [p.encaisse, p.prevu]));
  const lien = (o: { annee?: number; mois?: number | null }) => {
    const p = new URLSearchParams();
    p.set("annee", String(o.annee ?? an));
    if (o.mois) p.set("mois", String(o.mois));
    return `/coach/revenus?${p}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Revenus</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Mes revenus</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Année" className="flex items-center gap-1 rounded-full bg-blanc-casse p-1 shadow-douce">
            <Link href={lien({ annee: an - 1 })} className="rounded-full px-3 py-1.5 text-[14px] hover:bg-sable" aria-label={`Année ${an - 1}`}>
              ‹ {an - 1}
            </Link>
            <span className="rounded-full bg-chocolat px-3 py-1.5 text-[14px] font-medium text-creme">{an}</span>
            <Link href={lien({ annee: an + 1 })} className="rounded-full px-3 py-1.5 text-[14px] hover:bg-sable" aria-label={`Année ${an + 1}`}>
              {an + 1} ›
            </Link>
          </nav>
          <a href={`/coach/revenus/export?annee=${an}`} className="rounded-full border-[1.5px] border-chocolat px-4 py-2 text-[14px] font-medium hover:bg-chocolat hover:text-creme">
            Exporter {an} (Excel)
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile titre={`Encaissé en ${an}`} valeur={formaterEuros(s.encaisseAnnee)} aide={`sur ${formaterEuros(s.prevuAnnee)} prévus`} fort />
        <Tuile titre="Ce mois-ci" valeur={formaterEuros(s.encaisseMois)} aide={MOIS_LONGS[Number(auj.slice(5, 7)) - 1]} />
        <Tuile titre="Moyenne par mois" valeur={formaterEuros(s.moyenneMensuelle)} aide={an === anCourant ? "depuis janvier" : `en ${an}`} />
        <Tuile
          titre="À encaisser"
          valeur={formaterEuros(s.enRetard + s.aVenir)}
          aide={s.nbEnRetard ? `dont ${formaterEuros(s.enRetard)} en retard (${s.nbEnRetard})` : `${s.nbAVenir} échéance${s.nbAVenir > 1 ? "s" : ""} à venir`}
          alerte={s.nbEnRetard > 0}
        />
      </div>

      <Carte className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-titre text-xl font-bold">Mois par mois · {an}</h2>
          <p className="flex flex-wrap gap-4 text-[13px] text-texte-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-caramel" /> Encaissé
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-sable" /> Prévu
            </span>
          </p>
        </div>
        <div className="grid h-48 grid-cols-12 items-end gap-1.5 border-b border-ligne" role="img" aria-label={`Revenus encaissés et prévus par mois en ${an}`}>
          {s.parMois.map((p) => (
            <Link
              key={p.mois}
              href={lien({ mois: moisFiltre === p.mois ? null : p.mois })}
              title={`${MOIS_LONGS[p.mois - 1]} : ${formaterEuros(p.encaisse)} encaissés, ${formaterEuros(p.prevu)} prévus`}
              className={cx("group flex h-full items-end justify-center gap-[2px] rounded-t-md px-0.5 hover:bg-sable/40", moisFiltre === p.mois && "bg-sable/50")}
            >
              <span className="w-full max-w-4 rounded-t bg-caramel" style={{ height: `${(p.encaisse / max) * 100}%` }} />
              <span className="w-full max-w-4 rounded-t bg-sable" style={{ height: `${(p.prevu / max) * 100}%` }} />
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-1.5 text-center text-[11.5px] text-texte-2">
          {MOIS_COURTS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
        <details className="text-[13.5px]">
          <summary className="cursor-pointer text-texte-2">Voir le tableau</summary>
          <table className="mt-2 w-full tabular-nums">
            <thead className="text-left text-texte-2">
              <tr>
                <th className="py-1 font-medium">Mois</th>
                <th className="py-1 text-right font-medium">Encaissé</th>
                <th className="py-1 text-right font-medium">Prévu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {s.parMois.map((p) => (
                <tr key={p.mois}>
                  <td className="py-1 capitalize">{MOIS_LONGS[p.mois - 1]}</td>
                  <td className="py-1 text-right">{formaterEuros(p.encaisse)}</td>
                  <td className="py-1 text-right">{formaterEuros(p.prevu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Carte>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Carte className="flex flex-col gap-3 p-0 pt-5">
            <div className="px-5">
              <h2 className="font-titre text-xl font-bold">À encaisser</h2>
              <p className="text-[13.5px] text-texte-2">
                Un virement arrivé plus tard ? « Encaissé » avec la vraie date. Reporté ? « Reporter / modifier » change la date prévue.
              </p>
            </div>
            {restes.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-texte-2">Rien à encaisser : tout est à jour 🎉</p>
            ) : (
              <>
                {retards.length > 0 && (
                  <>
                    <p className="px-5 text-[13px] font-medium uppercase tracking-wide text-erreur">En retard</p>
                    <ul className="divide-y divide-ligne border-y border-ligne">
                      {retards.map((m) => (
                        <LigneMouvement key={m.id} m={m} aujourdhui={auj} clientes={clientes} />
                      ))}
                    </ul>
                  </>
                )}
                {aVenir.length > 0 && (
                  <>
                    <p className="px-5 pt-2 text-[13px] font-medium uppercase tracking-wide text-texte-2">À venir</p>
                    <ul className="divide-y divide-ligne border-t border-ligne">
                      {aVenir.map((m) => (
                        <LigneMouvement key={m.id} m={m} aujourdhui={auj} clientes={clientes} />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </Carte>

          <Carte className="flex flex-col gap-3 p-0 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5">
              <h2 className="font-titre text-xl font-bold">
                Encaissements {moisFiltre ? `${/^[aeiou]/.test(MOIS_LONGS[moisFiltre - 1]) ? "d’" : "de "}${MOIS_LONGS[moisFiltre - 1]} ${an}` : an}
              </h2>
              {moisFiltre && (
                <Link href={lien({})} className="text-[13.5px] underline underline-offset-4">
                  Toute l’année
                </Link>
              )}
            </div>
            {liste.length === 0 ? (
              <p className="px-5 pb-5 text-[14px] text-texte-2">Aucun encaissement sur cette période.</p>
            ) : (
              <ul className="divide-y divide-ligne border-t border-ligne">
                {liste.map((m) => (
                  <LigneMouvement key={m.id} m={m} aujourdhui={auj} clientes={clientes} />
                ))}
              </ul>
            )}
          </Carte>
        </div>

        <div className="flex flex-col gap-6">
          <Carte className="flex flex-col gap-3">
            <h2 className="font-titre text-xl font-bold">Ajouter un revenu</h2>
            <p className="text-[13.5px] text-texte-2">Hors échéancier : séance ponctuelle, atelier, ebook… (les accompagnements se gèrent dans la fiche de la cliente).</p>
            {divers ? (
              <FormRevenu clientes={clientes} action={ajouterRevenu} aujourdhui={auj} />
            ) : (
              <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0017_revenus.sql (voir le guide).</Message>
            )}
          </Carte>
          <Repartition titre={`Par formule · ${an}`} lignes={s.parFormule.map((f) => ({ nom: f.formule, montant: f.montant }))} total={s.encaisseAnnee} />
          <Repartition titre={`Par moyen de paiement · ${an}`} lignes={s.parMoyen.map((f) => ({ nom: f.moyen, montant: f.montant }))} total={s.encaisseAnnee} />
        </div>
      </div>
    </div>
  );
}

function Tuile({ titre, valeur, aide, fort, alerte }: { titre: string; valeur: string; aide: string; fort?: boolean; alerte?: boolean }) {
  return (
    <div className={cx("flex flex-col gap-1 rounded-carte p-4 shadow-douce", fort ? "bg-chocolat text-creme" : "bg-blanc-casse")}>
      <span className={cx("text-[13px]", fort ? "text-texte-clair" : "text-texte-2")}>{titre}</span>
      <span className="font-titre text-[26px] font-bold leading-tight tabular-nums">{valeur}</span>
      <span className={cx("text-[12.5px]", alerte ? "font-medium text-erreur" : fort ? "text-texte-clair" : "text-texte-2")}>{aide}</span>
    </div>
  );
}

function Repartition({ titre, lignes, total }: { titre: string; lignes: { nom: string; montant: number }[]; total: number }) {
  return (
    <Carte className="flex flex-col gap-3">
      <h2 className="font-titre text-lg font-bold">{titre}</h2>
      {lignes.length === 0 ? (
        <p className="text-[13.5px] text-texte-2">Pas encore d’encaissement.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lignes.map((l) => (
            <li key={l.nom} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-[13.5px]">
                <span className="truncate">{l.nom}</span>
                <span className="shrink-0 tabular-nums">
                  {formaterEuros(l.montant)} <span className="text-texte-2">· {total ? Math.round((l.montant / total) * 100) : 0} %</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-sable/60" role="presentation">
                <div className="h-full rounded-full bg-caramel" style={{ width: `${total ? (l.montant / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}
