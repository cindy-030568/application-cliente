import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { IconeRetour } from "@/components/icones";
import { Carte, Message } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis, formaterDate, prochainBilan } from "@/lib/bilan";
import type { ClienteListe } from "../../donnees";
import { BadgeStatut } from "../../badge-statut";
import { modifierCliente } from "../actions";
import { FormulaireInfos } from "../formulaire-infos";
import { BlocConnexion, BlocNotes, BlocStatut, BlocSuppression } from "./blocs";
import { BlocPlan, type PlanAffiche } from "./bloc-plans";
import { COLONNES_FICHE, COLONNES_PLAN, type Plan } from "@/lib/types";

export const metadata: Metadata = { title: "Fiche cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const A_VENIR = [
  { titre: "Repas et cibles", phase: 5 },
  { titre: "Aliments exclus", phase: 5 },
  { titre: "Aperçu des recettes", phase: 6 },
];

export default async function PageFicheCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creee?: string; email?: string }>;
}) {
  const { id } = await params;
  const { creee, email } = await searchParams;
  if (!UUID.test(id)) notFound();

  const { supabase } = await exigerCoach();
  const [{ data: c }, { data: notes }, { data: plans }] = await Promise.all([
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
  ]);
  if (!c) notFound();

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
            {bilan && <span>Prochain bilan : {formaterDate(bilan)}</span>}
            {c.ferme_le && <span>Accès fermé le {formaterDate(c.ferme_le)}</span>}
          </div>
        </div>
      </div>

      {creee && <Message ton="succes">Cliente créée 🎉</Message>}
      {email === "ok" && <Message ton="succes">L’email de connexion lui a été envoyé.</Message>}
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
            />
          </Section>
          <Section titre="Plans" sousTitre="PDF dans l’app, lien Drive ou Nutrium. Les anciennes versions restent consultables.">
            <BlocPlan clienteId={c.id} type="nutrition" plans={plansAffiches("nutrition")} />
            <hr className="border-ligne" />
            <BlocPlan clienteId={c.id} type="sport" plans={plansAffiches("sport")} />
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
          <Carte className="flex flex-col gap-2 border border-dashed border-caramel-clair bg-blanc-casse/60 shadow-none">
            <h2 className="font-titre text-lg font-bold">Bientôt dans cette fiche</h2>
            <ul className="flex flex-col gap-1 text-[14px] text-texte-2">
              {A_VENIR.map((a) => (
                <li key={a.titre}>
                  {a.titre} <span className="opacity-60">· phase {a.phase}</span>
                </li>
              ))}
            </ul>
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
