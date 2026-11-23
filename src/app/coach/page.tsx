import Link from "next/link";
import type { ReactNode } from "react";
import { IconePlus } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Surtitre, cx } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis, bilanAvecPhotos, conservationDepassee, prochainBilan } from "@/lib/bilan";
import { formaterEuros } from "@/lib/paiements";
import { jourParisDe } from "@/lib/programme-sportif";
import { clientesAvecSuitePlanifiee, lireRenouvellements } from "@/lib/programme-sportif-serveur";
import { synthese } from "@/lib/revenus";
import { lireMouvements } from "@/lib/revenus-serveur";
import { lireSeancesFaites } from "@/lib/seances-faites-serveur";
import { CATEGORIE, classerTaches, enRetard, quand, resume, type Tache, type TypeTache } from "@/lib/tableau-de-bord";
import { proposerMessages, type Proposition } from "@/lib/propositions-messages";
import { CarteAnnonce } from "./annonce";
import { PropositionsMessages } from "./propositions";
import { chargerFile } from "./bilans/donnees";

const dateLongue = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const nomMois = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });

export default async function TableauDeBord() {
  const { profil, supabase } = await exigerCoach();
  const auj = aujourdhuiParis();
  const dans14 = ajouterJours(auj, 14);

  // Chaque source est lue à part : une mise à jour de la base pas encore faite n'empêche pas le reste de s'afficher.
  const [
    { clientes, aTraiter, alertes },
    { data: echeances },
    renouvellements,
    avecSuite,
    planifies,
    { count: signalements },
    annonces,
    mouvements,
    seances,
    journal14,
    objectifs,
    dejaTraitees,
  ] = await Promise.all([
      chargerFile(),
      supabase.from("echeances_paiement").select("id, cliente_id, date_echeance, montant").is("payee_le", null).lte("date_echeance", dans14),
      lireRenouvellements(supabase),
      clientesAvecSuitePlanifiee(supabase),
      supabase
        .from("programmes_sportifs")
        .select("id, cliente_id, titre, debut_le")
        .eq("publie", false)
        .is("publie_le", null)
        .gt("debut_le", auj)
        .lte("debut_le", dans14),
      supabase.from("signalements_communaute").select("message_id", { count: "exact", head: true }).eq("traite", false),
      supabase.from("annonces").select("id, texte, expire_le").gt("expire_le", new Date().toISOString()).order("cree_le", { ascending: false }),
      lireMouvements(supabase),
      lireSeancesFaites(supabase, { limite: 300 }),
      // Propositions de messages : 2 dernières semaines du journal, objectifs, propositions déjà traitées cette semaine.
      supabase.from("journal_quotidien").select("cliente_id, jour, sommeil, hydratation, pas, stress, poids").gte("jour", ajouterJours(auj, -13)),
      supabase.from("besoins_clientes").select("cliente_id, objectif"),
      supabase.from("messages_cliente").select("cliente_id, proposition").gte("cree_le", ajouterJours(auj, -8)),
    ]);

  const suivies = clientes.filter((c) => c.statut !== "fermee");
  const actives = clientes.filter((c) => c.statut === "active");
  const nom = new Map(clientes.map((c) => [c.id, `${c.profils.prenom} ${c.profils.nom}`.trim()]));
  const ouverte = new Set(suivies.map((c) => c.id));

  // ------------------------------------------------------------ Toutes les actions, d'une seule liste
  const taches: Tache[] = [];

  for (const b of aTraiter) {
    taches.push({ id: `br-${b.id}`, type: "bilan_recu", date: jourParisDe(b.envoye_le), titre: b.nom, detail: "Bilan reçu : à lire et à commenter", lien: `/coach/bilans/${b.id}` });
  }
  for (const c of actives) {
    const liste = alertes.filter((a) => a.cliente.id === c.id).map((a) => a.alerte);
    const deuxManques = liste.some((a) => a.type === "decrochage_bilans");
    for (const a of liste) {
      if (a.type === "bilan_manquant") {
        taches.push({
          id: `bm-${c.id}`,
          type: "bilan_manquant",
          date: a.echeance,
          titre: nom.get(c.id)!,
          detail: deuxManques ? "2 bilans manqués d’affilée : prendre de ses nouvelles" : "Bilan pas encore envoyé : la relancer ?",
          lien: `/coach/clientes/${c.id}/suivi`,
        });
      } else if (a.type === "decrochage_visite") {
        taches.push({
          id: `dv-${c.id}`,
          type: "decrochage",
          date: auj,
          titre: nom.get(c.id)!,
          detail: a.jours === null ? "Ne s’est jamais connectée à l’appli" : `Ne s’est pas connectée depuis ${a.jours} jours`,
          lien: `/coach/clientes/${c.id}`,
        });
      } else if (a.type === "fin_suivi") {
        taches.push({ id: `fs-${c.id}`, type: "fin_suivi", date: a.dateFin, titre: nom.get(c.id)!, detail: "Fin de son suivi : lui proposer la suite ?", lien: `/coach/clientes/${c.id}` });
      }
    }
    const prochain = prochainBilan(c.date_debut, c.frequence_bilan_jours, auj);
    if (prochain && prochain <= dans14) {
      taches.push({
        id: `bp-${c.id}`,
        type: "bilan_prevu",
        date: prochain,
        titre: nom.get(c.id)!,
        detail: bilanAvecPhotos(c.date_debut, c.frequence_bilan_jours, prochain) ? "Bilan attendu, avec photos" : "Bilan attendu",
        lien: `/coach/clientes/${c.id}/suivi`,
      });
    }
  }
  for (const e of echeances ?? []) {
    if (!ouverte.has(e.cliente_id as string)) continue;
    const montant = Number(e.montant);
    taches.push({
      id: `pa-${e.id}`,
      type: "paiement",
      date: e.date_echeance as string,
      titre: nom.get(e.cliente_id as string) ?? "Cliente",
      detail: `Paiement de ${formaterEuros(montant)} à encaisser`,
      lien: `/coach/clientes/${e.cliente_id}`,
      montant,
    });
  }
  for (const p of renouvellements ?? []) {
    if (!ouverte.has(p.cliente_id) || avecSuite.has(p.cliente_id) || p.renouveler_le > dans14) continue;
    taches.push({
      id: `pr-${p.id}`,
      type: "programme",
      date: p.renouveler_le,
      titre: nom.get(p.cliente_id) ?? "Cliente",
      detail:
        p.renouveler_le < auj
          ? "Programme terminé : le suivant n’est pas encore dans l’appli"
          : "Préparer son prochain programme sportif (pas encore dans l’appli)",
      lien: `/coach/clientes/${p.cliente_id}/programme-sportif`,
    });
  }
  for (const p of planifies.error ? [] : (planifies.data ?? [])) {
    if (!ouverte.has(p.cliente_id as string)) continue;
    taches.push({
      id: `pp-${p.id}`,
      type: "programme_auto",
      date: p.debut_le as string,
      titre: nom.get(p.cliente_id as string) ?? "Cliente",
      detail: `« ${p.titre} » passe en ligne tout seul`,
      lien: `/coach/clientes/${p.cliente_id}/programme-sportif`,
    });
  }
  if (signalements) {
    taches.push({
      id: "signalements",
      type: "signalement",
      date: auj,
      titre: "Communauté",
      detail: `${signalements} message${signalements > 1 ? "s signalés" : " signalé"} à vérifier`,
      lien: "/coach/communaute",
    });
  }
  for (const c of clientes.filter((c) => conservationDepassee(c.statut, c.ferme_le, auj))) {
    taches.push({
      id: `rg-${c.id}`,
      type: "rgpd",
      date: auj,
      titre: nom.get(c.id)!,
      detail: "Accès fermé depuis plus de 3 ans : supprimer ses données (fiche → Zone sensible)",
      lien: `/coach/clientes/${c.id}`,
    });
  }

  const agenda = classerTaches(taches, auj);

  // ------------------------------------------------------------ Propositions de messages (semaine / semaine)
  const traitees = new Set((dejaTraitees.error ? [] : (dejaTraitees.data ?? [])).map((m) => `${m.cliente_id}|${m.proposition}`));
  const objectifDe = new Map((objectifs.error ? [] : (objectifs.data ?? [])).map((o) => [o.cliente_id as string, (o.objectif as string | null) ?? null]));
  const avecProgramme = new Set((renouvellements ?? []).map((p) => p.cliente_id));
  const lignesJournal = journal14.error ? [] : (journal14.data ?? []);
  const num = (v: unknown) => (v == null ? null : Number(v));
  const propositions: Proposition[] = actives.flatMap((c) =>
    proposerMessages(
      {
        clienteId: c.id,
        prenom: c.profils.prenom,
        sansChiffres: c.mode_sans_chiffres,
        objectif: objectifDe.get(c.id) ?? null,
        avecProgramme: avecProgramme.has(c.id),
        seancesFaites: (seances ?? []).filter((x) => x.cliente_id === c.id).map((x) => jourParisDe(x.faite_le)),
        journal: lignesJournal
          .filter((j) => j.cliente_id === c.id)
          .map((j) => ({ jour: j.jour as string, sommeil: num(j.sommeil), hydratation: num(j.hydratation), pas: num(j.pas), stress: num(j.stress), poids: num(j.poids) })),
      },
      auj,
    ).filter((p) => !traitees.has(`${c.id}|${p.cle}`)),
  );
  // Les relances d'abord.
  propositions.sort((a, b) => Number(a.ton === "bravo") - Number(b.ton === "bravo"));

  // ------------------------------------------------------------ Chiffres du moment
  const an = Number(auj.slice(0, 4));
  const s = mouvements ? synthese(mouvements.mouvements, an, auj) : null;
  const moisCourant = Number(auj.slice(5, 7));
  const prevuMois = s?.parMois[moisCourant - 1]?.prevu ?? 0;
  const depuis = ajouterJours(auj, -6);
  const seancesSemaine = (seances ?? []).filter((x) => jourParisDe(x.faite_le) >= depuis);
  const sportives = new Set(seancesSemaine.map((x) => x.cliente_id)).size;
  const programmesEnLigne = (renouvellements ?? []).filter((p) => ouverte.has(p.cliente_id)).length;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Surtitre>{dateLongue.format(new Date())}</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Bonjour {profil.prenom || "Cindy"} 💛</h1>
          <p className="text-[16px] text-texte-2">{resume(agenda)}</p>
        </div>
        <LienBouton href="/coach/clientes/nouvelle">
          <IconePlus className="size-5" /> Nouvelle cliente
        </LienBouton>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile
          href="#maintenant"
          valeur={String(agenda.maintenant.length)}
          libelle="À faire maintenant"
          detail={agenda.enRetard ? `dont ${agenda.enRetard} en retard` : agenda.maintenant.length ? "rien en retard" : "tout est à jour"}
          alerte={agenda.enRetard > 0}
        />
        <Tuile href="#semaine" valeur={String(agenda.semaine.length)} libelle="Cette semaine" detail="dans les 7 prochains jours" />
        <Tuile
          href="/coach/revenus"
          valeur={s ? formaterEuros(s.encaisseMois) : "—"}
          libelle={`Encaissé en ${nomMois.format(new Date(`${auj.slice(0, 7)}-15T12:00:00Z`))}`}
          detail={s ? (s.enRetard ? `${formaterEuros(s.enRetard)} en retard` : `sur ${formaterEuros(prevuMois)} prévus`) : "revenus"}
          alerte={Boolean(s?.enRetard)}
        />
        <Tuile
          href="/coach/clientes"
          valeur={String(actives.length)}
          libelle={actives.length > 1 ? "Clientes actives" : "Cliente active"}
          detail={seances ? `${seancesSemaine.length} séance${seancesSemaine.length > 1 ? "s" : ""} de sport cette semaine` : "voir mes clientes"}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Bloc
            id="maintenant"
            titre="À faire maintenant"
            sousTitre="En retard ou prévu aujourd’hui"
            taches={agenda.maintenant}
            auj={auj}
            vide="Rien à faire pour l’instant. 🎉"
            accent
          />
          <Carte id="messages" className="flex scroll-mt-20 flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="font-titre text-[22px] font-bold leading-tight">Garder le contact 💬</h2>
                <p className="text-[13.5px] text-texte-2">Ce qui a changé cette semaine chez tes clientes, avec un petit mot prêt à envoyer.</p>
              </div>
              {propositions.length > 0 && <span className="font-titre text-[22px] font-bold tabular-nums text-texte-2">{propositions.length}</span>}
            </div>
            <PropositionsMessages propositions={propositions} />
          </Carte>
          <Bloc id="semaine" titre="Cette semaine" sousTitre="Dans les 7 prochains jours" taches={agenda.semaine} auj={auj} vide="Rien de prévu cette semaine." />
          <Bloc id="plus-tard" titre="Dans les 2 semaines" sousTitre="Pour anticiper" taches={agenda.plusTard} auj={auj} vide="Rien de prévu pour l’instant." />
        </div>

        <aside className="flex flex-col gap-6">
          <Carte className="flex flex-col gap-3">
            <h2 className="font-titre text-xl font-bold">En ce moment</h2>
            <dl className="flex flex-col divide-y divide-ligne text-[14.5px]">
              <Ligne libelle="Clientes actives" valeur={actives.length} lien="/coach/clientes" />
              <Ligne libelle="Bilans à traiter" valeur={aTraiter.length} lien="/coach/bilans" fort={aTraiter.length > 0} />
              <Ligne libelle="Programmes sportifs en ligne" valeur={programmesEnLigne} />
              {seances && <Ligne libelle="Clientes qui se sont entraînées (7 j)" valeur={sportives} />}
              <Ligne libelle="Suivis terminés" valeur={clientes.filter((c) => c.statut === "terminee").length} />
              <Ligne libelle="Accès formation" valeur={clientes.filter((c) => c.acces_formation).length} />
            </dl>
          </Carte>

          {s && (
            <Carte className="flex flex-col gap-3">
              <h2 className="font-titre text-xl font-bold">Revenus</h2>
              <dl className="flex flex-col divide-y divide-ligne text-[14.5px]">
                <Ligne libelle="Encaissé ce mois-ci" valeur={formaterEuros(s.encaisseMois)} />
                <Ligne libelle="Prévu ce mois-ci" valeur={formaterEuros(prevuMois)} />
                <Ligne libelle="En retard" valeur={s.enRetard ? `${formaterEuros(s.enRetard)} (${s.nbEnRetard})` : "—"} fort={s.enRetard > 0} />
                <Ligne libelle="À venir" valeur={formaterEuros(s.aVenir)} />
                <Ligne libelle={`Encaissé en ${an}`} valeur={formaterEuros(s.encaisseAnnee)} />
              </dl>
              <Link href="/coach/revenus" className="text-[14px] underline underline-offset-4">
                Ouvrir mes revenus
              </Link>
            </Carte>
          )}

          {!annonces.error && (
            <Carte className="flex flex-col gap-4">
              <div>
                <h2 className="font-titre text-xl font-bold">Un message à toutes mes clientes</h2>
                <p className="text-[14px] text-texte-2">Une notification, et un mot sur leur accueil pendant 24 h.</p>
              </div>
              <CarteAnnonce enCours={annonces.data ?? []} />
            </Carte>
          )}
        </aside>
      </div>
    </div>
  );
}

const TON: Record<TypeTache, "rose" | "sable" | "sombre" | "vert"> = {
  bilan_recu: "sable",
  bilan_manquant: "sable",
  bilan_prevu: "sable",
  paiement: "vert",
  programme: "rose",
  programme_auto: "rose",
  fin_suivi: "sombre",
  decrochage: "sombre",
  signalement: "rose",
  rgpd: "sombre",
};

function Tuile({ href, valeur, libelle, detail, alerte = false }: { href: string; valeur: string; libelle: string; detail: string; alerte?: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex flex-col gap-1 rounded-carte p-4 shadow-douce transition-transform active:scale-[0.98] sm:p-5",
        alerte ? "bg-accent-pale" : "bg-blanc-casse",
      )}
    >
      <span className="text-[13.5px] font-medium text-texte-2">{libelle}</span>
      <span className="font-titre text-[30px] font-bold leading-none tabular-nums sm:text-[34px]">{valeur}</span>
      <span className={cx("text-[13px]", alerte ? "font-medium text-erreur" : "text-texte-2")}>{detail}</span>
    </Link>
  );
}

function Bloc({
  id,
  titre,
  sousTitre,
  taches,
  auj,
  vide,
  accent = false,
}: {
  id: string;
  titre: string;
  sousTitre: string;
  taches: Tache[];
  auj: string;
  vide: string;
  accent?: boolean;
}) {
  return (
    <Carte id={id} className={cx("flex scroll-mt-20 flex-col gap-3", accent && taches.length > 0 && "ring-2 ring-accent/30")}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-titre text-[22px] font-bold leading-tight">{titre}</h2>
          <p className="text-[13.5px] text-texte-2">{sousTitre}</p>
        </div>
        {taches.length > 0 && <span className="font-titre text-[22px] font-bold tabular-nums text-texte-2">{taches.length}</span>}
      </div>
      {taches.length === 0 ? (
        <p className="py-2 text-[15px] text-texte-2">{vide}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ligne">
          {taches.map((t) => (
            <LigneTache key={t.id} t={t} auj={auj} />
          ))}
        </ul>
      )}
    </Carte>
  );
}

function LigneTache({ t, auj }: { t: Tache; auj: string }) {
  const retard = enRetard(t, auj);
  const aujourdhui = !retard && t.date === auj && t.type !== "signalement" && t.type !== "decrochage" && t.type !== "rgpd";
  return (
    <li>
      {/* Téléphone : étiquette et date en haut, puis la cliente et l'action sur toute la largeur. */}
      <Link href={t.lien} className="group flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex items-center justify-between gap-2 sm:contents">
          <Etiquette ton={TON[t.type]} className="w-[92px] shrink-0 justify-center text-center sm:order-1">
            {CATEGORIE[t.type]}
          </Etiquette>
          <span
            className={cx(
              "shrink-0 rounded-full px-2.5 py-1 text-right text-[12.5px] font-medium sm:order-3",
              retard ? "bg-erreur text-white" : aujourdhui ? "bg-accent-pale text-chocolat" : "text-texte-2",
            )}
          >
            {quand(t, auj)}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col sm:order-2">
          <span className="text-[15.5px] font-medium group-hover:text-accent sm:truncate">{t.titre}</span>
          <span className="text-[14px] text-texte-2">{t.detail}</span>
        </span>
      </Link>
    </li>
  );
}

function Ligne({ libelle, valeur, lien, fort = false }: { libelle: string; valeur: ReactNode; lien?: string; fort?: boolean }) {
  const contenu = (
    <>
      <dt className="text-texte-2">{libelle}</dt>
      <dd className={cx("tabular-nums", fort ? "font-semibold text-erreur" : "font-medium")}>{valeur}</dd>
    </>
  );
  return lien ? (
    <Link href={lien} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
      {contenu}
    </Link>
  ) : (
    <div className="flex items-center justify-between gap-3 py-2">{contenu}</div>
  );
}
