import { horloge } from "@/lib/ressources";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { IconeRetour } from "@/components/icones";
import { Carte, Message } from "@/components/ui";
import { LIBELLES_STATUT } from "@/lib/types";
import { formaterEuros } from "@/lib/paiements";
import { exigerCoach } from "@/lib/auth";
import { ajouterJours, aujourdhuiParis, bilanAvecPhotos, formaterDate, prochainBilan } from "@/lib/bilan";
import type { ClienteListe } from "../../donnees";
import { BadgeStatut } from "../../badge-statut";
import { modifierCliente } from "../actions";
import { FormulaireInfos } from "../formulaire-infos";
import { BlocConnexion, BlocNotes, BlocStatut, BlocSuppression } from "./blocs";
import { BlocPlan, type PlanAffiche } from "./bloc-plans";
import { BlocExclusions, BlocRepas } from "./bloc-nutrition";
import { BlocPaiement } from "./bloc-paiement";
import { BlocComplements } from "./bloc-complements";
import { BoutonTraiterSuite } from "../../reglages/fin";
import { CaseRecompense } from "../../avis/boutons";
import { FormulaireAccesExpress } from "../../seances-express/reglages";
import { bilanFinVisible } from "@/lib/bilan-fin";
import type { Complement } from "@/lib/complements";
import { formulesUtilisees, lirePaiement } from "@/lib/paiements-serveur";
import { chargerCategoriesAliment } from "@/lib/aliments";
import { echeanceRenouvellement, jourParisDe, semaineProgramme } from "@/lib/programme-sportif";
import { lireRenouvellements } from "@/lib/programme-sportif-serveur";
import { lireSeancesFaites } from "@/lib/seances-faites-serveur";
import { chargerAnalyse } from "@/lib/analyse-cliente-serveur";
import { COLONNES_FICHE, COLONNES_PLAN, type Plan } from "@/lib/types";

export const metadata: Metadata = { title: "Fiche cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageFicheCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creee?: string; email?: string; paiement?: string }>;
}) {
  const { id } = await params;
  const { creee, email, paiement: paiementEchec } = await searchParams;
  if (!UUID.test(id)) notFound();

  const { supabase } = await exigerCoach();
  const [{ data: c }, { data: notes }, { data: plans }, { data: repas }, { data: exclusions }, categoriesAliment] = await Promise.all([
    supabase
      .from("clientes")
      .select(
        `${COLONNES_FICHE}, profils!inner(prenom, nom, email)`,
      )
      .eq("id", id)
      .maybeSingle<ClienteListe>(),
    supabase
      .from("notes_coach")
      .select("id, contenu, created_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("plans")
      .select(COLONNES_PLAN)
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .returns<Plan[]>(),
    supabase
      .from("repas_cibles")
      .select("type_repas, libelle, proteines_g, glucides_g, lipides_g")
      .eq("cliente_id", id)
      .order("ordre"),
    supabase.from("exclusions").select("categorie_id, aliments(id, nom)").eq("cliente_id", id),
    chargerCategoriesAliment(supabase),
  ]);
  if (!c) notFound();
  const [renouvellements, seancesFaites] = await Promise.all([lireRenouvellements(supabase, id), lireSeancesFaites(supabase, { clienteId: id, limite: 50 })]);
  const programmeEnCours = renouvellements?.[0] ?? null;
  const { analyse } = await chargerAnalyse(supabase, id, c, aujourdhuiParis());
  const compte = (n: string) => analyse.conseils.filter((x) => x.niveau === n).length;
  const aRegarder = analyse.conseils.filter((x) => x.niveau === "important" || x.niveau === "surveiller").slice(0, 3);
  const depuis = ajouterJours(aujourdhuiParis(), -6);
  const faitesSemaine = (seancesFaites ?? []).filter((s) => jourParisDe(s.faite_le) >= depuis).length;
  // Rappels (phase 8) : lus à part, la fiche reste utilisable avant la mise à jour de la base.
  const [{ data: prefRappels, error: sansRappels }, { data: rappels }, { count: appareils }] = await Promise.all([
    supabase.from("clientes").select("rappels_email").eq("id", id).maybeSingle<{ rappels_email: boolean }>(),
    supabase
      .from("rappels_envoyes")
      .select("id, echeance, type, canaux, envoye_le")
      .eq("cliente_id", id)
      .order("envoye_le", { ascending: false })
      .limit(5),
    supabase.from("abonnements_push").select("id", { count: "exact", head: true }).eq("cliente_id", id),
  ]);

  // Formule, paiement, suivi sportif (0010) : lus à part, null tant que la mise à jour n'est pas faite.
  const [paiement, formules, { data: sport, error: sansSport }] = await Promise.all([
    lirePaiement(supabase, id),
    formulesUtilisees(supabase),
    supabase.from("clientes").select("suivi_sport").eq("id", id).maybeSingle<{ suivi_sport: boolean }>(),
  ]);
  // Compléments (0035) : lus à part, rien avant la mise à jour.
  const [{ data: complements, error: sansComplements }, { count: prisSemaine }] = await Promise.all([
    supabase.from("complements").select("id, nom, moment, quantite, note, ordre, actif").eq("cliente_id", id).order("ordre").returns<Complement[]>(),
    supabase.from("complements_pris").select("complement_id", { count: "exact", head: true }).eq("cliente_id", id).gte("jour", ajouterJours(aujourdhuiParis(), -6)),
  ]);
  // Demandes « continuer avec moi » du bilan de fin de suivi (0038) : lues à part.
  const { data: demandesSuite, error: sansFin } = await supabase
    .from("demandes_suite")
    .select("id, offre, cree_le, traitee")
    .eq("cliente_id", id)
    .order("cree_le", { ascending: false })
    .returns<{ id: string; offre: string; cree_le: string; traitee: boolean }[]>();
  // Parrainage (0039) : son code et ses filleules, lus à part.
  const [{ data: monCode, error: sansParrainage }, { data: filleules }, { count: nbAvis }] = await Promise.all([
    supabase.from("clientes").select("code_parrainage").eq("id", id).maybeSingle<{ code_parrainage: string | null }>(),
    supabase
      .from("demandes_inscription")
      .select("id, prenom, nom, recue_le, statut, recompense_donnee")
      .eq("marraine_id", id)
      .order("recue_le", { ascending: false })
      .returns<{ id: string; prenom: string; nom: string; recue_le: string; statut: string; recompense_donnee: boolean }[]>(),
    supabase.from("avis").select("id", { count: "exact", head: true }).eq("cliente_id", id),
  ]);
  // Séances express (0040) : accès après le suivi, et séances libres faites. Lus à part.
  const [{ data: express, error: sansExpress }, { count: nbExpress }] = await Promise.all([
    supabase.from("clientes").select("express_jusqu_au").eq("id", id).maybeSingle<{ express_jusqu_au: string | null }>(),
    supabase.from("seances_faites").select("id", { count: "exact", head: true }).eq("cliente_id", id).not("seance_express_id", "is", null),
  ]);
  // Audios écoutés (0043) : lus à part, rien avant la mise à jour.
  const { data: ecoutes, error: sansEcoutes } = await supabase
    .from("ressources_ecoutes")
    .select("position_s, terminee, maj_le, ressources(titre, audio_duree)")
    .eq("cliente_id", id)
    .order("maj_le", { ascending: false })
    .limit(30)
    .returns<{ position_s: number; terminee: boolean; maj_le: string; ressources: { titre: string; audio_duree: number | null } | null }[]>();
  // Contrat accepté (0027) et questionnaire d'arrivée (0031) : lus à part.
  const [{ data: acceptations, error: sansContrat }, { data: contratEnCours }, { data: questionnaire, error: sansQuestionnaire }] = await Promise.all([
    supabase
      .from("acceptations_contrat")
      .select("version, accepte_le")
      .eq("cliente_id", id)
      .order("accepte_le", { ascending: false })
      .returns<{ version: string; accepte_le: string }[]>(),
    supabase.from("reglages").select("contrat_version").maybeSingle<{ contrat_version: string | null }>(),
    supabase
      .from("reponses_arrivee")
      .select("reponses, envoye_le")
      .eq("cliente_id", id)
      .maybeSingle<{ reponses: { question: string; reponse: string | string[] }[]; envoye_le: string }>(),
  ]);
  const { data: jrn, error: sansJournal } = await supabase
    .from("clientes")
    .select("journal_actif")
    .eq("id", id)
    .maybeSingle<{ journal_actif: boolean }>();
  const auj = aujourdhuiParis();

  const bilan =
    c.statut === "active" ? prochainBilan(c.date_debut, c.frequence_bilan_jours, aujourdhuiParis()) : null;
  const dateCourte = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const plansAffiches = (type: Plan["type"]): PlanAffiche[] =>
    (plans ?? [])
      .filter((p) => p.type === type)
      .map((p) => ({
        id: p.id,
        titre: p.titre,
        source: p.source,
        actif: p.actif,
        date: dateCourte.format(new Date(p.created_at)),
        vu: p.vu_le ? dateCourte.format(new Date(p.vu_le)) : null,
      }));
  const echeancesEnRetard = paiement ? paiement.echeances.filter((e) => !e.payee_le && e.date_echeance < auj).length : 0;
  const resumePaiement = !paiement
    ? "Mise à jour 0010 à faire"
    : [
        paiement.paiement?.formule,
        paiement.paiement?.montant_total ? formaterEuros(paiement.paiement.montant_total) : null,
        paiement.paiement && paiement.paiement.nb_fois > 1 ? `en ${paiement.paiement.nb_fois} fois` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Pas encore renseignés";
  const nbPlans = (type: Plan["type"]) => (plans ?? []).filter((p) => p.type === type && p.actif).length;
  const resumePlans = `Nutrition : ${nbPlans("nutrition") ? "en ligne" : "aucun"} · Sport : ${nbPlans("sport") ? "en ligne" : "aucun"}`;
  const dateNote = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });

  return (
    <div className="flex flex-col gap-6">
      <Link href="/coach/clientes" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Clientes
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent-pale font-titre text-2xl font-bold">
          {(c.profils.prenom[0] ?? "?").toUpperCase()}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="font-titre text-[32px] font-bold leading-tight">
            {c.profils.prenom} {c.profils.nom}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-[14px] text-texte-2">
            <BadgeStatut statut={c.statut} />
            {c.ferme_le && <span>Accès fermé le {formaterDate(c.ferme_le)}</span>}
          </div>
        </div>
      </div>

      {creee && <Message ton="succes">Cliente créée 🎉</Message>}
      {email === "ok" && <Message ton="succes">L’email de connexion lui a été envoyé.</Message>}
      {paiementEchec === "echec" && (
        <Message ton="erreur">
          La formule et le paiement n’ont pas pu être enregistrés (mise à jour 0010 faite ?). Tu peux les saisir ci-dessous.
        </Message>
      )}
      {email === "echec" && (
        <Message ton="erreur">
          L’email n’a pas pu partir. Utilise « Créer un lien à partager » ci-dessous.
        </Message>
      )}

      {/* 1. Son suivi, en premier */}
      <section className="flex flex-col gap-4 rounded-carte bg-chocolat p-5 text-creme shadow-douce">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-titre text-[24px] font-bold leading-tight">Son suivi</h2>
            <p className="text-[14px] text-texte-clair">Graphiques, photos, bilans, rendez-vous et export pour ton classeur.</p>
          </div>
          <Link
            href={`/coach/clientes/${c.id}/suivi`}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-creme px-5 text-[15px] font-medium text-chocolat"
          >
            Ouvrir son suivi et ses bilans
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Chiffre libelle="Prochain bilan" valeur={bilan ? formaterDate(bilan, { year: undefined }) : "—"} detail={bilan && bilanAvecPhotos(c.date_debut, c.frequence_bilan_jours, bilan) ? "avec photos 📸" : undefined} />
          <Chiffre libelle="Prochain rendez-vous" valeur={c.prochain_rdv ? dateCourte.format(new Date(c.prochain_rdv)) : "—"} />
          <Chiffre libelle="Dernière visite" valeur={c.derniere_visite ? dateCourte.format(new Date(c.derniere_visite)) : "jamais"} />
          <Chiffre libelle="Séances (7 jours)" valeur={seancesFaites ? String(faitesSemaine) : "—"} />
        </dl>
      </section>

      {/* 2. Accès rapides */}
      <div className="grid gap-4 md:grid-cols-2">
        <Carte className="flex flex-col gap-3 border-2 border-caramel/40">
          <h2 className="font-titre text-xl font-bold">Analyse & conseils</h2>
          <p className="text-[14px] text-texte-2">
            {[
              compte("important") && `${compte("important")} à traiter`,
              compte("surveiller") && `${compte("surveiller")} à surveiller`,
              compte("bravo") && `${compte("bravo")} réussite${compte("bravo") > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Rien de particulier à signaler pour l’instant."}
          </p>
          {aRegarder.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-[14.5px]">
              {aRegarder.map((x) => (
                <li key={x.id} className="flex gap-2">
                  <span aria-hidden className={x.niveau === "important" ? "mt-[7px] size-2 shrink-0 rounded-full bg-erreur" : "mt-[7px] size-2 shrink-0 rounded-full bg-caramel"} />
                  {x.titre}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/coach/clientes/${c.id}/analyse`}
            className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full bg-chocolat px-5 text-[15px] font-medium text-creme"
          >
            Voir l’analyse et les conseils
          </Link>
        </Carte>
        <Carte className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">Programme sportif</h2>
          {programmeEnCours ? (
            <ProgrammeEnCours publieLe={programmeEnCours.publie_le} renouvelerLe={programmeEnCours.renouveler_le} />
          ) : (
            <p className="text-[14px] text-texte-2">Construit avec Claude, collé ici, puis publié dans son onglet Sport.</p>
          )}
          {seancesFaites && seancesFaites.length > 0 && (
            <p className="text-[14px]">
              Dernière séance : {seancesFaites[0].seance_nom}, {formaterDate(jourParisDe(seancesFaites[0].faite_le), { year: undefined })}
            </p>
          )}
          <Link
            href={`/coach/clientes/${c.id}/programme-sportif`}
            className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full border border-chocolat px-5 text-[15px] font-medium text-chocolat"
          >
            Son programme sportif
          </Link>
        </Carte>
        <Carte className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">Plan alimentaire</h2>
          <p className="text-[14px] text-texte-2">Ses besoins, puis son plan repas par repas. Elle le reçoit dans son onglet Nutrition.</p>
          <Link
            href={`/coach/clientes/${c.id}/plan-alimentaire`}
            className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-[15px] font-medium text-white"
          >
            Son plan alimentaire
          </Link>
        </Carte>
        <Carte className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">Ses recettes</h2>
          <p className="text-[14px] text-texte-2">Les recettes qu’elle voit pour chaque repas, avec les quantités calculées pour ses cibles.</p>
          <Link
            href={`/coach/clientes/${c.id}/recettes`}
            className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full border border-chocolat px-5 text-[15px] font-medium text-chocolat"
          >
            Aperçu des recettes
          </Link>
        </Carte>
      </div>

      {/* 3. Sa fiche : menus repliables */}
      <div className="flex flex-col gap-3">
        <h2 className="font-titre text-[24px] font-bold leading-tight">Sa fiche</h2>
        <Repliable titre="Infos et accès" resume={[c.profils.email, c.date_debut ? `début le ${formaterDate(c.date_debut)}` : null].filter(Boolean).join(" · ")}>
          <FormulaireInfos
            action={modifierCliente.bind(null, c.id)}
            valeurs={{ ...c.profils, ...c }}
            suiviSport={sansSport ? null : (sport?.suivi_sport ?? true)}
            journal={sansJournal ? null : (jrn?.journal_actif ?? true)}
          />
        </Repliable>
        <Repliable
          titre="Formule et paiement"
          resume={resumePaiement}
          alerte={echeancesEnRetard > 0 ? `${echeancesEnRetard} échéance${echeancesEnRetard > 1 ? "s" : ""} en retard` : undefined}
          ouvert={paiementEchec === "echec"}
        >
          <p className="text-[13.5px] text-texte-2">Ta cliente voit sa formule et son échéancier dans son profil. Ta note reste privée.</p>
          {paiement ? (
            <BlocPaiement
              clienteId={c.id}
              paiement={paiement.paiement}
              echeances={paiement.echeances}
              formules={formules}
              premiereParDefaut={paiement.echeances[0]?.date_echeance ?? c.date_debut ?? auj}
              aujourdhui={auj}
            />
          ) : (
            <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0010_formule_paiement_sport.sql (voir le guide).</Message>
          )}
        </Repliable>
        {!sansContrat && (
          <Repliable
            titre="Contrat"
            resume={
              acceptations?.length
                ? `Version ${acceptations[0].version} acceptée le ${dateCourte.format(new Date(acceptations[0].accepte_le))}`
                : contratEnCours?.contrat_version
                  ? "Pas encore accepté dans l’app"
                  : "Pas de contrat dans Réglages"
            }
          >
            {acceptations?.length ? (
              <>
                <ul className="flex flex-col gap-1 text-[14px]">
                  {acceptations.map((a) => (
                    <li key={a.version}>
                      Version <strong className="font-medium">{a.version}</strong> acceptée le {dateNote.format(new Date(a.accepte_le))}, avec la
                      renonciation au droit de rétractation (début immédiat).
                    </li>
                  ))}
                </ul>
                <a
                  href={`/coach/clientes/${c.id}/contrat`}
                  className="inline-flex min-h-11 w-fit items-center justify-center rounded-full border border-chocolat px-5 text-[15px] font-medium text-chocolat"
                >
                  Télécharger la preuve (PDF)
                </a>
              </>
            ) : (
              <p className="text-[14px] text-texte-2">
                {contratEnCours?.contrat_version
                  ? "Elle n’a pas encore accepté de contrat dans l’app. Si elle était déjà en cours avant la mise en place du contrat, elle n’est pas bloquée."
                  : "Ajoute ton contrat dans Réglages → Mon contrat pour que les nouvelles clientes l’acceptent à leur première connexion."}
              </p>
            )}
            {contratEnCours?.contrat_version && !acceptations?.length && (
              <Link href={`/coach/clientes/${c.id}/apercu-contrat`} className="w-fit text-[14px] font-medium underline underline-offset-4">
                Voir son contrat tel qu’elle le lira
              </Link>
            )}
          </Repliable>
        )}
        {!sansQuestionnaire && (
          <Repliable
            titre="Questionnaire d’arrivée"
            resume={questionnaire ? `Rempli le ${dateCourte.format(new Date(questionnaire.envoye_le))}` : "Pas encore rempli"}
          >
            {questionnaire ? (
              <>
                <dl className="flex flex-col gap-3 text-[14.5px]">
                  {questionnaire.reponses.map((r, i) => (
                    <div key={i}>
                      <dt className="text-[13.5px] text-texte-2">{r.question}</dt>
                      <dd className="whitespace-pre-line">{Array.isArray(r.reponse) ? r.reponse.join(" · ") : r.reponse}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[13px] text-texte-2">
                  Ses exclusions (catégories cochées) et son objectif ont été pré-remplis : corrige-les dans « Aliments exclus » et dans son plan
                  alimentaire (ses besoins) si besoin. Les « autres aliments » écrits à la main sont à ajouter toi-même.
                </p>
              </>
            ) : (
              <p className="text-[14px] text-texte-2">
                Les nouvelles clientes le remplissent à leur première connexion, après le contrat. Les questions se modifient dans Réglages → Questionnaire
                d’arrivée.
              </p>
            )}
          </Repliable>
        )}
        {!sansEcoutes && (
          <Repliable
            titre="Audios écoutés"
            resume={ecoutes?.length ? `${ecoutes.length} audio${ecoutes.length > 1 ? "s" : ""} · ${ecoutes.filter((e) => e.terminee).length} jusqu’au bout` : "Aucun pour l’instant"}
          >
            {ecoutes?.length ? (
              <ul className="flex flex-col gap-2 text-[14.5px]">
                {ecoutes.map((e, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-x-4">
                    <span>🎧 {e.ressources?.titre ?? "Audio supprimé"}</span>
                    <span className="text-texte-2">
                      {e.terminee
                        ? "écouté jusqu’au bout"
                        : `arrêtée à ${horloge(e.position_s)}${e.ressources?.audio_duree ? ` sur ${horloge(e.ressources.audio_duree)}` : ""}`}{" "}
                      · {dateCourte.format(new Date(e.maj_le))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-texte-2">Elle n’a pas encore écouté d’audio de tes ressources.</p>
            )}
          </Repliable>
        )}
        <Repliable titre="Notes privées" resume={notes?.length ? `${notes.length} note${notes.length > 1 ? "s" : ""} · jamais visibles par elle` : "Jamais visibles par la cliente"}>
          <BlocNotes
            id={c.id}
            notes={(notes ?? []).map((n) => ({
              id: n.id,
              contenu: n.contenu,
              date: dateNote.format(new Date(n.created_at)),
            }))}
          />
        </Repliable>
        <Repliable titre="Repas et cibles" resume={repas?.length ? `${repas.length} repas : ${repas.map((r) => r.libelle).join(", ")}` : "Aucun repas défini"}>
          <p className="text-[13.5px] text-texte-2">Les cibles de chaque repas de son plan. Les kcal sont calculées automatiquement.</p>
          <BlocRepas
            clienteId={c.id}
            initiaux={(repas ?? []).map((r) => ({
              type_repas: r.type_repas as string,
              libelle: r.libelle as string,
              proteines_g: Number(r.proteines_g),
              glucides_g: Number(r.glucides_g),
              lipides_g: Number(r.lipides_g),
            }))}
          />
        </Repliable>
        <Repliable titre="Aliments exclus" resume={exclusions?.length ? `${exclusions.length} exclusion${exclusions.length > 1 ? "s" : ""}` : "Aucune exclusion"}>
          <p className="text-[13.5px] text-texte-2">Allergies, aversions, végétarienne… Les recettes concernées ne lui seront pas proposées.</p>
          <BlocExclusions
            clienteId={c.id}
            categories={categoriesAliment}
            categoriesInitiales={(exclusions ?? []).flatMap((e) => (e.categorie_id ? [e.categorie_id as string] : []))}
            alimentsInitiaux={(exclusions ?? []).flatMap((e) => {
              const a = (Array.isArray(e.aliments) ? e.aliments[0] : e.aliments) as { id: string; nom: string } | null;
              return a ? [{ id: a.id, nom: a.nom }] : [];
            })}
          />
        </Repliable>
        {!sansComplements && (
          <Repliable
            titre="Compléments"
            resume={
              complements?.length
                ? `${complements.filter((x) => x.actif).length} à prendre : ${complements.filter((x) => x.actif).map((x) => x.nom).join(", ") || "aucun en ce moment"}`
                : "Aucun complément"
            }
          >
            <p className="text-[13.5px] text-texte-2">Quoi prendre, quand et combien. Elle voit sa liste sur son accueil (« Mes compléments ») et coche ce qu’elle a pris.</p>
            <BlocComplements clienteId={c.id} complements={complements ?? []} prisCetteSemaine={prisSemaine ?? 0} />
          </Repliable>
        )}
        <Repliable titre="Plans en PDF ou en lien" resume={resumePlans}>
          <p className="text-[13.5px] text-texte-2">PDF dans l’app, lien Drive ou Nutrium. Les anciennes versions restent consultables.</p>
          <BlocPlan clienteId={c.id} type="nutrition" plans={plansAffiches("nutrition")} />
          <hr className="border-ligne" />
          <BlocPlan clienteId={c.id} type="sport" plans={plansAffiches("sport")} />
        </Repliable>
        {!sansRappels && (
          <Repliable
            titre="Rappels de bilan"
            resume={`Emails ${prefRappels?.rappels_email === false ? "coupés" : "oui"} · notifications ${appareils ? "activées" : "pas activées"}`}
          >
            <ul className="flex flex-col gap-1 text-[14px]">
              <li>Emails : {prefRappels?.rappels_email === false ? "coupés par elle" : "oui"}</li>
              <li>Notifications : {appareils ? `activées sur ${appareils} appareil${appareils > 1 ? "s" : ""}` : "pas activées"}</li>
            </ul>
            {rappels && rappels.length > 0 ? (
              <ul className="flex flex-col divide-y divide-ligne text-[13.5px]">
                {rappels.map((r) => (
                  <li key={r.id as string} className="flex justify-between gap-3 py-2">
                    <span>
                      {r.type === "relance" ? "Relance" : "Bilan ouvert"} · <span className="text-texte-2">{dateCourte.format(new Date(r.envoye_le as string))}</span>
                    </span>
                    <span className="text-texte-2">
                      {(r.canaux as string[]).length ? (r.canaux as string[]).map((x) => (x === "push" ? "notification" : x)).join(" + ") : "aucun canal"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-texte-2">Aucun rappel envoyé pour l’instant.</p>
            )}
          </Repliable>
        )}
        {!sansExpress && (
          <Repliable
            titre="Séances express"
            resume={[
              nbExpress ? `${nbExpress} séance${nbExpress > 1 ? "s" : ""} express faite${nbExpress > 1 ? "s" : ""}` : "Aucune séance express faite",
              c.statut === "terminee"
                ? express?.express_jusqu_au && express.express_jusqu_au >= aujourdhuiParis()
                  ? `accès jusqu’au ${formaterDate(express.express_jusqu_au)}`
                  : "pas d’accès (suivi terminé)"
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            <p className="text-[13.5px] text-texte-2">
              En cours de suivi, elle a accès à toutes les séances express publiées pour elle. Quand son suivi est terminé, elle les garde seulement jusqu’à la date ci-dessous (par exemple avec un petit abonnement). Laisse vide pour couper l’accès.
            </p>
            <FormulaireAccesExpress clienteId={c.id} jusquAu={express?.express_jusqu_au ?? null} />
          </Repliable>
        )}
        {!sansFin && (
          <Repliable
            titre="Bilan de fin de suivi"
            resume={
              bilanFinVisible(c, aujourdhuiParis()) ? "Visible par elle en ce moment" : "Visible 7 jours avant sa date de fin, ou dès que son suivi est terminé"
            }
            alerte={
              (demandesSuite ?? []).some((d) => !d.traitee)
                ? `Envie de continuer : ${(demandesSuite ?? []).filter((d) => !d.traitee).map((d) => d.offre).join(", ")} · `
                : undefined
            }
          >
            <Link href={`/coach/clientes/${c.id}/bilan-de-fin`} className="w-fit text-[14.5px] font-medium underline underline-offset-4">
              Voir son bilan de fin tel qu’elle le voit
            </Link>
            {(demandesSuite ?? []).length > 0 && (
              <ul className="flex flex-col divide-y divide-ligne">
                {(demandesSuite ?? []).map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="text-[14.5px]">
                      A cliqué sur <strong>« {d.offre} »</strong> le {formaterDate(d.cree_le.slice(0, 10))}
                    </span>
                    {d.traitee ? <span className="text-[13.5px] text-texte-2">Traitée</span> : <BoutonTraiterSuite id={d.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Repliable>
        )}
        {!sansParrainage && monCode?.code_parrainage && (
          <Repliable
            titre="Parrainage et avis"
            resume={[
              `Code ${monCode.code_parrainage}`,
              (filleules ?? []).length ? `${(filleules ?? []).length} filleule${(filleules ?? []).length > 1 ? "s" : ""}` : "aucune filleule",
              nbAvis ? `${nbAvis} témoignage${nbAvis > 1 ? "s" : ""}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            <p className="text-[14px] text-texte-2">
              Son code de parrainage : <strong className="tracking-[0.12em] text-chocolat">{monCode.code_parrainage}</strong>. Elle le trouve, avec son lien à partager, dans son profil.
            </p>
            {(filleules ?? []).length > 0 ? (
              <ul className="flex flex-col divide-y divide-ligne">
                {(filleules ?? []).map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="text-[14.5px]">
                      <strong>
                        {f.prenom} {f.nom}
                      </strong>{" "}
                      · inscrite le {formaterDate(f.recue_le.slice(0, 10))}
                      {f.statut === "a_valider" ? " (fiche à valider)" : ""}
                    </span>
                    <CaseRecompense id={f.id} donnee={f.recompense_donnee} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-texte-2">Aucune inscription avec son code pour l’instant.</p>
            )}
            {nbAvis ? (
              <Link href="/coach/avis" className="w-fit text-[14px] underline underline-offset-4">
                Voir ses témoignages
              </Link>
            ) : null}
          </Repliable>
        )}
        <Repliable titre="Connexion" resume="Renvoyer l’email ou créer un lien à partager">
          <BlocConnexion id={c.id} prenom={c.profils.prenom} />
        </Repliable>
        <Repliable titre="Statut" resume={LIBELLES_STATUT[c.statut]}>
          <BlocStatut id={c.id} statut={c.statut} />
        </Repliable>
        <Repliable titre="Zone sensible" resume="Supprimer la cliente et ses données">
          <BlocSuppression id={c.id} prenom={c.profils.prenom} />
        </Repliable>
      </div>
    </div>
  );
}

/** Une rubrique de la fiche, fermée par défaut : le titre et un résumé d'une ligne. */
function Repliable({
  titre,
  resume,
  alerte,
  ouvert,
  children,
}: {
  titre: string;
  resume?: string;
  alerte?: string;
  ouvert?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={ouvert || undefined} className="group rounded-carte bg-blanc-casse shadow-douce">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col">
          <span className="font-titre text-[18px] font-bold leading-tight">{titre}</span>
          {(resume || alerte) && (
            <span className="truncate text-[13.5px] text-texte-2">
              {alerte && <span className="font-medium text-erreur">{alerte}</span>}
              {alerte && resume ? " · " : ""}
              {resume}
            </span>
          )}
        </span>
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sable/60 text-texte-2 transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-ligne px-5 pb-5 pt-4">{children}</div>
    </details>
  );
}

function Chiffre({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-creme/10 px-3 py-2.5">
      <dt className="text-[12.5px] text-texte-clair">{libelle}</dt>
      <dd className="font-titre text-[17px] font-bold leading-tight">{valeur}</dd>
      {detail && <dd className="text-[12.5px] text-texte-clair">{detail}</dd>}
    </div>
  );
}

/** Où en est son programme sportif, et quand préparer le suivant. */
function ProgrammeEnCours({ publieLe, renouvelerLe }: { publieLe: string | null; renouvelerLe: string }) {
  const auj = aujourdhuiParis();
  const semaine = semaineProgramme(publieLe, renouvelerLe, auj);
  const e = echeanceRenouvellement(renouvelerLe, auj);
  return (
    <p className="rounded-xl bg-sable/50 px-3 py-2 text-[14px]">
      {semaine && semaine.semaine <= semaine.total && <>Semaine {semaine.semaine} sur {semaine.total} · </>}
      Prochain programme le {formaterDate(renouvelerLe, { year: undefined })}{" "}
      <span className={e.jours <= 7 ? "font-medium text-erreur" : "text-texte-2"}>({e.texte})</span>
    </p>
  );
}
