import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { IconeRetour } from "@/components/icones";
import { Carte, Message } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis, bilanAvecPhotos, formaterDate, prochainBilan } from "@/lib/bilan";
import type { ClienteListe } from "../../donnees";
import { BadgeStatut } from "../../badge-statut";
import { modifierCliente } from "../actions";
import { FormulaireInfos } from "../formulaire-infos";
import { BlocConnexion, BlocNotes, BlocStatut, BlocSuppression } from "./blocs";
import { BlocPlan, type PlanAffiche } from "./bloc-plans";
import { BlocExclusions, BlocRepas } from "./bloc-nutrition";
import { BlocPaiement } from "./bloc-paiement";
import { formulesUtilisees, lirePaiement } from "@/lib/paiements-serveur";
import { chargerCategoriesAliment } from "@/lib/aliments";
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
            {bilan && <span>Prochain bilan : {formaterDate(bilan)}{bilanAvecPhotos(c.date_debut, c.frequence_bilan_jours, bilan) ? " · avec photos 📸" : ""}</span>}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section titre="Infos et accès">
            <FormulaireInfos
              action={modifierCliente.bind(null, c.id)}
              valeurs={{ ...c.profils, ...c }}
              suiviSport={sansSport ? null : (sport?.suivi_sport ?? true)}
            />
          </Section>
          <Section titre="Formule et paiement" sousTitre="Visible par toi seule, jamais par ta cliente.">
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
              <Message ton="info">
                Fais d’abord la mise à jour de la base : fichier 0010_formule_paiement_sport.sql (voir le guide).
              </Message>
            )}
          </Section>
          <Section titre="Plans" sousTitre="PDF dans l’app, lien Drive ou Nutrium. Les anciennes versions restent consultables.">
            <BlocPlan clienteId={c.id} type="nutrition" plans={plansAffiches("nutrition")} />
            <hr className="border-ligne" />
            <BlocPlan clienteId={c.id} type="sport" plans={plansAffiches("sport")} />
          </Section>
          <Section titre="Repas et cibles" sousTitre="Les cibles de chaque repas de son plan. Les kcal sont calculées automatiquement.">
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
          </Section>
          <Section titre="Aliments exclus" sousTitre="Allergies, aversions, végétarienne… Les recettes concernées ne lui seront pas proposées.">
            <BlocExclusions
              clienteId={c.id}
              categories={categoriesAliment}
              categoriesInitiales={(exclusions ?? []).flatMap((e) => (e.categorie_id ? [e.categorie_id as string] : []))}
              alimentsInitiaux={(exclusions ?? []).flatMap((e) => {
                const a = (Array.isArray(e.aliments) ? e.aliments[0] : e.aliments) as { id: string; nom: string } | null;
                return a ? [{ id: a.id, nom: a.nom }] : [];
              })}
            />
          </Section>
          <Section titre="Notes privées" sousTitre="Jamais visibles par la cliente.">
            <BlocNotes
              id={c.id}
              notes={(notes ?? []).map((n) => ({
                id: n.id,
                contenu: n.contenu,
                date: dateNote.format(new Date(n.created_at)),
              }))}
            />
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <Carte className="flex flex-col gap-3 bg-chocolat text-creme">
            <h2 className="font-titre text-xl font-bold">Suivi et bilans</h2>
            <p className="text-[14px] text-texte-clair">
              Ses graphiques, photos, bilans, rendez-vous et l’export pour ton classeur.
            </p>
            <Link
              href={`/coach/clientes/${c.id}/suivi`}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-creme px-5 text-[15px] font-medium text-chocolat"
            >
              Ouvrir son suivi
            </Link>
          </Carte>
          <Section titre="Connexion">
            <BlocConnexion id={c.id} prenom={c.profils.prenom} />
          </Section>
          <Section titre="Statut">
            <BlocStatut id={c.id} statut={c.statut} />
          </Section>
          {!sansRappels && (
            <Section titre="Rappels de bilan">
              <ul className="flex flex-col gap-1 text-[14px]">
                <li>Emails : {prefRappels?.rappels_email === false ? "coupés par elle" : "oui"}</li>
                <li>
                  Notifications :{" "}
                  {appareils ? `activées sur ${appareils} appareil${appareils > 1 ? "s" : ""}` : "pas activées"}
                </li>
              </ul>
              {rappels && rappels.length > 0 ? (
                <ul className="flex flex-col divide-y divide-ligne text-[13.5px]">
                  {rappels.map((r) => (
                    <li key={r.id as string} className="flex justify-between gap-3 py-2">
                      <span>
                        {r.type === "relance" ? "Relance" : "Bilan ouvert"} ·{" "}
                        <span className="text-texte-2">{dateCourte.format(new Date(r.envoye_le as string))}</span>
                      </span>
                      <span className="text-texte-2">
                        {(r.canaux as string[]).length
                          ? (r.canaux as string[]).map((x) => (x === "push" ? "notification" : x)).join(" + ")
                          : "aucun canal"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-texte-2">Aucun rappel envoyé pour l’instant.</p>
              )}
            </Section>
          )}
          <Carte className="flex flex-col gap-3">
            <h2 className="font-titre text-xl font-bold">Ses recettes</h2>
            <p className="text-[14px] text-texte-2">
              Les recettes qu’elle verra pour chaque repas, avec les quantités calculées pour ses cibles.
            </p>
            <Link
              href={`/coach/clientes/${c.id}/recettes`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-chocolat px-5 text-[15px] font-medium text-chocolat"
            >
              Aperçu des recettes
            </Link>
          </Carte>
          <Section titre="Zone sensible">
            <BlocSuppression id={c.id} prenom={c.profils.prenom} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: ReactNode }) {
  return (
    <Carte className="flex flex-col gap-4">
      <div>
        <h2 className="font-titre text-xl font-bold">{titre}</h2>
        {sousTitre && <p className="text-[13.5px] text-texte-2">{sousTitre}</p>}
      </div>
      {children}
    </Carte>
  );
}
