import Link from "next/link";
import { IconePlus } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis, bilanAvecPhotos, conservationDepassee, formaterDate, joursEntre, prochainBilan, type Alerte } from "@/lib/bilan";
import { chargerFile } from "./bilans/donnees";
import { formaterEuros } from "@/lib/paiements";

export default async function TableauDeBord() {
  const { profil, supabase } = await exigerCoach();
  const { clientes, aTraiter, alertes } = await chargerFile();
  const auj = aujourdhuiParis();

  const actives = clientes.filter((c) => c.statut === "active");
  const bilans = actives
    .map((c) => ({ c, date: prochainBilan(c.date_debut, c.frequence_bilan_jours, auj) }))
    .filter((b): b is { c: (typeof actives)[number]; date: string } => b.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  // Échéances de paiement en retard ou dans les 14 jours (rien avant la mise à jour 0010).
  const { data: echeancesBrutes } = await supabase
    .from("echeances_paiement")
    .select("id, cliente_id, date_echeance, montant")
    .is("payee_le", null)
    .lte("date_echeance", ajouterJours(auj, 14))
    .order("date_echeance")
    .limit(30);
  const paiements = (echeancesBrutes ?? []).flatMap((e) => {
    const cliente = clientes.find((c) => c.id === e.cliente_id);
    return cliente ? [{ ...e, montant: Number(e.montant), cliente, retard: e.date_echeance < auj }] : [];
  });

  const aSupprimer = clientes.filter((c) => conservationDepassee(c.statut, c.ferme_le, auj));
  // Une ligne par cliente ; « 2 bilans manqués » remplace « bilan manquant ».
  const parCliente = clientes
    .map((cliente) => {
      const toutes = alertes.filter((a) => a.cliente.id === cliente.id).map((a) => a.alerte);
      const manquant = toutes.find((a) => a.type === "bilan_manquant");
      const deux = toutes.some((a) => a.type === "decrochage_bilans");
      return {
        cliente,
        liste: deux ? toutes.filter((a) => a.type !== "bilan_manquant") : toutes,
        retard: manquant?.type === "bilan_manquant" ? manquant.retard : null,
      };
    })
    .filter((x) => x.liste.length > 0);

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
                      <span className="flex items-center gap-2 text-[14px] text-texte-2">
                        {bilanAvecPhotos(c.date_debut, c.frequence_bilan_jours, date) && (
                          <span className="rounded-full bg-sable px-2 py-0.5 text-[12px] text-chocolat">+ photos</span>
                        )}
                        {j === 0 ? "aujourd’hui" : j === 1 ? "demain" : formaterDate(date, { year: undefined })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>
        <Carte className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-titre text-xl font-bold">Bilans à traiter</h2>
            {aTraiter.length > 0 && <Etiquette>{aTraiter.length}</Etiquette>}
          </div>
          {aTraiter.length === 0 ? (
            <p className="text-[14px] text-texte-2">Tout est traité. 💛</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ligne">
              {aTraiter.slice(0, 6).map((b) => (
                <li key={b.id}>
                  <Link href={`/coach/bilans/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent">
                    <span className="font-medium">{b.nom}</span>
                    <span className="text-[14px] text-texte-2">{formaterDate(b.date_mesure, { year: undefined })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/coach/bilans" className="text-[14px] underline underline-offset-4">
            Ouvrir la file des bilans
          </Link>
        </Carte>
      </div>

      {paiements.length > 0 && (
        <Carte className="flex flex-col gap-4">
          <div>
            <h2 className="font-titre text-xl font-bold">Paiements</h2>
            <p className="text-[14px] text-texte-2">En retard et à venir dans les 14 jours.</p>
          </div>
          <ul className="flex flex-col divide-y divide-ligne">
            {paiements.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/coach/clientes/${p.cliente.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 hover:text-accent"
                >
                  <span className="font-medium">
                    {p.cliente.profils.prenom} {p.cliente.profils.nom}
                  </span>
                  <span className="flex items-center gap-3 text-[14px]">
                    <span className="tabular-nums">{formaterEuros(p.montant)}</span>
                    {p.retard ? (
                      <span className="rounded-full bg-accent-pale px-3 py-1 text-[12.5px] font-medium text-erreur">
                        en retard · {formaterDate(p.date_echeance, { year: undefined })}
                      </span>
                    ) : (
                      <span className="text-texte-2">{formaterDate(p.date_echeance, { year: undefined })}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-texte-2">Pour cocher une échéance payée : ouvre la fiche de la cliente.</p>
        </Carte>
      )}

      {aSupprimer.length > 0 && (
        <Carte className="flex flex-col gap-3 border border-erreur/30">
          <h2 className="font-titre text-xl font-bold">Données à supprimer</h2>
          <p className="text-[14px] text-texte-2">
            L’accès de ces clientes est fermé depuis plus de 3 ans : le délai de conservation (RGPD) est dépassé.
            Ouvre leur fiche → <strong>Zone sensible</strong> → Supprimer définitivement.
          </p>
          <ul className="flex flex-col divide-y divide-ligne">
            {aSupprimer.map((c) => (
              <li key={c.id}>
                <Link href={`/coach/clientes/${c.id}`} className="flex justify-between gap-3 py-2.5 hover:text-accent">
                  <span className="font-medium">
                    {c.profils.prenom} {c.profils.nom}
                  </span>
                  <span className="text-[13.5px] text-texte-2">accès fermé le {formaterDate(c.ferme_le!.slice(0, 10))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <Carte className="flex flex-col gap-4">
        <h2 className="font-titre text-xl font-bold">À surveiller</h2>
        {parCliente.length === 0 ? (
          <p className="text-[14px] text-texte-2">Rien à signaler : toutes tes clientes sont à jour.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ligne">
            {parCliente.map(({ cliente, liste, retard }) => (
              <li key={cliente.id}>
                <Link
                  href={
                    liste.every((a) => a.type === "fin_suivi")
                      ? `/coach/clientes/${cliente.id}`
                      : `/coach/clientes/${cliente.id}/suivi`
                  }
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-accent"
                >
                  <span className="font-medium">
                    {cliente.profils.prenom} {cliente.profils.nom}
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[14px] text-texte-2">
                    {liste.map((a) => (
                      <span key={a.type} className="inline-flex items-center gap-2">
                        <Etiquette ton={a.type === "fin_suivi" ? "sable" : "rose"}>{titreAlerte(a)}</Etiquette>
                        {a.type === "decrochage_bilans" && retard !== null ? `dernier : ${retard} j de retard` : detailAlerte(a)}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}

function titreAlerte(a: Alerte): string {
  switch (a.type) {
    case "bilan_manquant":
      return "Bilan manquant";
    case "decrochage_bilans":
      return "2 bilans manqués";
    case "decrochage_visite":
      return "Ne se connecte plus";
    case "fin_suivi":
      return "Fin de suivi proche";
  }
}

function detailAlerte(a: Alerte): string {
  switch (a.type) {
    case "bilan_manquant":
      return `${a.retard} j de retard`;
    case "decrochage_bilans":
      return "d’affilée";
    case "decrochage_visite":
      return a.jours === null ? "jamais connectée" : `depuis ${a.jours} jours`;
    case "fin_suivi":
      return a.jours === 0 ? "aujourd’hui" : `dans ${a.jours} j · proposer la suite ?`;
  }
}

function Chiffre({ valeur, label }: { valeur: number; label: string }) {
  return (
    <Carte className="flex flex-col gap-1">
      <span className="font-titre text-[38px] font-bold leading-none">{valeur}</span>
      <span className="text-[14px] text-texte-2">{label}</span>
    </Carte>
  );
}
