import type { Metadata } from "next";
import Link from "next/link";
import { Carte, Message, Surtitre, classesBouton } from "@/components/ui";
import { exigerCoach, lireReglages } from "@/lib/auth";
import { chargerChamps } from "@/lib/suivi";
import { GestionChamps } from "./champs";
import { FormulaireReglages } from "./formulaire";
import { FormulaireTolerance } from "./tolerance";
import { FormulaireRappels } from "./rappels";
import { configurationRappels, lireReglagesRappels } from "@/lib/envoi-rappels";
import { lirePrefsNotifCoach } from "@/lib/notifications-coach";
import { NotificationsCoach } from "./notifications";
import { FormulaireContrat, InterrupteurBrouillon, type ReglagesContrat } from "./contrat";
import { FormulaireFinSuivi } from "./fin";
import { FormulaireLienInscription } from "../avis/boutons";
import { lireOffres } from "@/lib/bilan-fin";

export const metadata: Metadata = { title: "Réglages" };

export default async function PageReglages() {
  const { supabase } = await exigerCoach();
  const [
    reglages,
    champs,
    rappels,
    prefsNotif,
    { count: nbAppareils },
    { data: derniereTache, error: sans0025 },
    { data: contrat, error: sans0027 },
    { count: acceptations },
    { data: brouillon, error: sans0028 },
    { data: fin, error: sans0038 },
    { data: inscription, error: sans0039 },
  ] = await Promise.all([
    lireReglages(),
    chargerChamps(supabase, true),
    lireReglagesRappels(supabase),
    lirePrefsNotifCoach(supabase),
    supabase.from("abonnements_coach").select("id", { count: "exact", head: true }),
    // Tâche du matin (0025) : dernier passage, lu à part.
    supabase
      .from("taches_du_matin")
      .select("jour, source, statut, debut_le")
      .order("jour", { ascending: false })
      .limit(1)
      .maybeSingle<{ jour: string; source: string; statut: string; debut_le: string }>(),
    // Contrat (0027) et brouillon Claude (0028) : lus à part.
    supabase.from("reglages").select("contrat_texte, contrat_version, contrat_case_renonciation, contrat_depuis").maybeSingle<ReglagesContrat>(),
    supabase.from("acceptations_contrat").select("id", { count: "exact", head: true }),
    supabase.from("reglages").select("brouillon_claude").maybeSingle<{ brouillon_claude: boolean }>(),
    // Bilan de fin de suivi (0038) : lu à part.
    supabase.from("reglages").select("fin_texte, fin_offres").maybeSingle<{ fin_texte: string; fin_offres: unknown }>(),
    // Parrainage (0039) : lien du formulaire d'inscription.
    supabase.from("reglages").select("lien_inscription").maybeSingle<{ lien_inscription: string | null }>(),
  ]);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Surtitre>Réglages</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Réglages de l’app</h1>
      </div>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Mes notifications</h2>
          <p className="text-[14px] text-texte-2">Coche ce que tu veux recevoir : tu es prévenue dès qu’il se passe quelque chose dans l’app.</p>
        </div>
        {prefsNotif ? (
          <NotificationsCoach
            prefs={prefsNotif}
            sans0024={prefsNotif.sans0024}
            sans0026={prefsNotif.sans0026}
            clePublique={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
            nbAppareils={nbAppareils ?? 0}
          />
        ) : (
          <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0012_notifications_coach.sql (voir le guide).</Message>
        )}
      </Carte>
      <Carte>
        <FormulaireReglages reglages={reglages} />
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Mon contrat</h2>
          <p className="text-[14px] text-texte-2">Accepté dans l’app par chaque nouvelle cliente avant son premier accès.</p>
        </div>
        {sans0027 || !contrat ? (
          <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0027_contrat.sql (voir le guide).</Message>
        ) : (
          <FormulaireContrat contrat={contrat} acceptations={acceptations ?? 0} />
        )}
      </Carte>
      <Carte className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Questionnaire d’arrivée</h2>
          <p className="text-[14px] text-texte-2">Les questions posées aux nouvelles clientes à leur première connexion.</p>
        </div>
        <Link href="/coach/reglages/questionnaire" className={classesBouton("contour")}>
          Modifier les questions
        </Link>
      </Carte>
      <Carte id="fin-de-suivi" className="flex scroll-mt-6 flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Bilan de fin de suivi : « Continuer avec moi »</h2>
          <p className="text-[14px] text-texte-2">
            Ce que ta cliente lit en bas de son bilan de fin de suivi, avec un bouton « Ça m’intéresse » sous chaque offre. Tu es prévenue quand elle clique.
          </p>
        </div>
        {sans0038 || !fin ? (
          <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0038_bilan_fin.sql (voir le guide).</Message>
        ) : (
          <FormulaireFinSuivi texte={fin.fin_texte} offres={lireOffres(fin.fin_offres)} />
        )}
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Parrainage</h2>
          <p className="text-[14px] text-texte-2">
            Chaque cliente a un code personnel et un lien à partager. Quand quelqu’un s’inscrit avec, tu le vois sur sa fiche à valider et sur la fiche de sa marraine.
          </p>
        </div>
        {sans0039 || !inscription ? (
          <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0039_avis_parrainage.sql (voir le guide).</Message>
        ) : (
          <FormulaireLienInscription lien={inscription.lien_inscription} />
        )}
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Brouillon de réponse par Claude</h2>
          <p className="text-[14px] text-texte-2">Option désactivée par défaut. Le bouton « Copier pour Claude » reste toujours là.</p>
        </div>
        {sans0028 || !brouillon ? (
          <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0028_brouillon_claude.sql (voir le guide).</Message>
        ) : (
          <InterrupteurBrouillon actif={brouillon.brouillon_claude} cleConfiguree={Boolean(process.env.ANTHROPIC_API_KEY)} />
        )}
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Rappels de bilan</h2>
          <p className="text-[14px] text-texte-2">
            Par email et en notification sur le téléphone de tes clientes (si elles l’ont activé dans leur profil).
          </p>
        </div>
        {!sans0025 && <DerniereTache tache={derniereTache} />}
        {rappels ? (
          <FormulaireRappels reglages={rappels} config={configurationRappels()} />
        ) : (
          <Message ton="info">
            Fais d’abord la mise à jour de la base : fichier 0008_rappels.sql (voir le guide, phase 8).
          </Message>
        )}
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Recettes adaptées</h2>
          <p className="text-[14px] text-texte-2">
            L’app recalcule les quantités de chaque recette pour les cibles du repas. Une recette est
            proposée si chaque macro (protéines, glucides, lipides) tombe dans l’écart accepté : le plus
            large des deux réglages ci-dessous.
          </p>
        </div>
        <FormulaireTolerance reglages={reglages} />
      </Carte>
      <Carte className="flex flex-col gap-3">
        <h2 className="font-titre text-xl font-bold">Sauvegarde de tes données</h2>
        <p className="text-[14px] text-texte-2">
          Un fichier avec toutes les données de l’app : clientes, bilans, mesures, notes, plans, recettes, réglages.
          Télécharge-le <strong>une fois par mois</strong> et range-le dans un endroit sûr et privé (pas dans un dossier
          partagé). Les PDF et les photos restent stockés dans Supabase.
        </p>
        <div>
          <a href="/coach/sauvegarde" download className={classesBouton("contour")}>
            Télécharger une sauvegarde
          </a>
        </div>
      </Carte>
      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Le bilan</h2>
          <p className="text-[14px] text-texte-2">
            Les questions posées à tes clientes, rubrique par rubrique, dans cet ordre.
          </p>
        </div>
        <GestionChamps champs={champs} fenetre={reglages.fenetre_bilan_jours} intro={reglages.intro_bilan} />
      </Carte>
    </div>
  );
}

/** Quand la tâche du matin (rappels de bilan, paiements, programmes) a tourné pour la dernière fois. */
function DerniereTache({ tache }: { tache: { jour: string; source: string; statut: string; debut_le: string } | null }) {
  if (!tache) {
    return (
      <p className="rounded-xl bg-sable/50 px-4 py-3 text-[14px]">
        Tâche du matin : elle n’a pas encore tourné. Elle part chaque jour vers 7 h (voir le guide, « Tâche du matin »).
      </p>
    );
  }
  const quand = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(
    new Date(tache.debut_le),
  );
  const qui = tache.source === "supabase" ? "horloge Supabase" : "hébergeur";
  const etat = tache.statut === "ok" ? "✓ terminée" : tache.statut === "echec" ? "⚠️ en échec (elle sera relancée au prochain passage)" : "en cours";
  return (
    <p className={tache.statut === "echec" ? "rounded-xl bg-accent-pale px-4 py-3 text-[14px]" : "rounded-xl bg-sable/50 px-4 py-3 text-[14px]"}>
      Tâche du matin : dernier passage {quand} ({qui}) · {etat}
    </p>
  );
}
