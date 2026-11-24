import { BoutonDeconnexion } from "@/components/hors-connexion";
import type { Metadata } from "next";
import Link from "next/link";
import { IconeDeconnexion, IconeFleche, IconeRetour } from "@/components/icones";
import { Carte } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis, formaterDate } from "@/lib/bilan";
import { lireMonPaiement } from "@/lib/paiements-serveur";
import { CarteMonPaiement } from "@/components/mon-paiement";
import { LIBELLES_STATUT } from "@/lib/types";
import { ReglagesRappels } from "./rappels";
import { InterrupteurPreference } from "./interrupteur";
import { ReglageCycle } from "./cycle";
import { CarteParrainage } from "./parrainage";
import { lienParrainage } from "@/lib/parrainage";
import { lireCycle } from "@/lib/cycle-serveur";
import { journalActif } from "@/lib/journal-serveur";
import { CarteInstallation } from "@/components/pwa";

export const metadata: Metadata = { title: "Mon profil" };

export default async function PageProfil() {
  const { supabase, profil, fiche, reglages } = await exigerCliente();
  const monPaiement = await lireMonPaiement(supabase);
  // Lue à part : la page reste utilisable avant la mise à jour de la base (0008).
  const { data: pref, error: sansRappels } = await supabase
    .from("clientes")
    .select("rappels_email")
    .eq("id", profil.id)
    .maybeSingle<{ rappels_email: boolean }>();
  // Notifications facultatives (lues à part : rien avant la mise à jour 0033).
  const { data: prefs, error: sansPrefs } = await supabase
    .from("clientes")
    .select("recap_notif")
    .eq("id", profil.id)
    .maybeSingle<{ recap_notif: boolean }>();
  const [cycle, avecJournal, { data: parrain }, { data: lien }] = await Promise.all([
    lireCycle(supabase, profil.id),
    journalActif(supabase, profil.id),
    // Parrainage (0039) : lu à part, rien avant la mise à jour.
    supabase.from("clientes").select("code_parrainage").eq("id", profil.id).maybeSingle<{ code_parrainage: string | null }>(),
    supabase.from("reglages").select("lien_inscription").maybeSingle<{ lien_inscription: string | null }>(),
  ]);
  return (
    <div className="pt-encoche flex flex-col gap-6 px-5">
      <Link href="/" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <h1 className="font-titre text-[30px] font-bold leading-tight">Mon profil</h1>

      <Carte className="flex flex-col gap-4">
        <Ligne label="Prénom et nom" valeur={`${profil.prenom} ${profil.nom}`.trim()} />
        <Ligne label="Email" valeur={profil.email} />
        <Ligne label="Mon accompagnement" valeur={LIBELLES_STATUT[fiche.statut]} />
        {fiche.date_debut && <Ligne label="Début" valeur={formaterDate(fiche.date_debut)} />}
        {fiche.date_fin && <Ligne label="Fin prévue" valeur={formaterDate(fiche.date_fin)} />}
      </Carte>

      {monPaiement && <CarteMonPaiement p={monPaiement} aujourdhui={aujourdhuiParis()} />}

      <CarteInstallation toujours />

      {!sansRappels && fiche.statut === "active" && (
        <Carte className="flex flex-col gap-4">
          <div>
            <h2 className="font-titre text-xl font-bold">Mes rappels de bilan</h2>
            <p className="text-[13.5px] text-texte-2">Un petit signe quand c’est le moment de faire le point.</p>
          </div>
          <ReglagesRappels email={pref?.rappels_email ?? true} clePublique={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        </Carte>
      )}

      {!sansPrefs && prefs && fiche.statut === "active" && (
        <Carte className="flex flex-col gap-4">
          <div>
            <h2 className="font-titre text-xl font-bold">Mes autres notifications</h2>
            <p className="text-[13.5px] text-texte-2">Si les notifications sont activées sur ton téléphone.</p>
          </div>
          <InterrupteurPreference
            cle="recap"
            actif={prefs.recap_notif}
            titre="Mon récap du dimanche"
            detail="Le dimanche à 18 h : tes séances, ton sommeil, tes pas et ton eau de la semaine."
          />
        </Carte>
      )}

      {parrain?.code_parrainage && fiche.statut !== "fermee" && (
        <Carte id="parrainage" className="flex scroll-mt-6 flex-col gap-4">
          <div>
            <h2 className="font-titre text-xl font-bold">Parrainer une amie</h2>
            <p className="text-[13.5px] text-texte-2">Partage ton lien personnel, ou donne ton code à une amie qui veut se lancer.</p>
          </div>
          <CarteParrainage code={parrain.code_parrainage} lien={lienParrainage(lien?.lien_inscription, parrain.code_parrainage)} />
        </Carte>
      )}

      <Link href="/avis" className="flex items-center justify-between rounded-carte bg-blanc-casse p-4 shadow-douce">
        <span className="flex flex-col">
          <span className="font-medium">Laisser un témoignage</span>
          <span className="text-[13.5px] text-texte-2">Publié seulement si tu le souhaites</span>
        </span>
        <IconeFleche className="size-5 text-texte-2" />
      </Link>

      {cycle && avecJournal && fiche.statut !== "fermee" && (
        <Carte id="cycle" className="flex scroll-mt-6 flex-col gap-4">
          <div>
            <h2 className="font-titre text-xl font-bold">Mon cycle (facultatif)</h2>
            <p className="text-[13.5px] text-texte-2">Pour mieux comprendre ton corps au fil du mois, dans ton journal.</p>
          </div>
          <ReglageCycle mode={cycle.mode} duree={cycle.duree} />
        </Carte>
      )}

      <Link
        href="/compte/mot-de-passe"
        className="flex items-center justify-between rounded-carte bg-blanc-casse p-4 shadow-douce"
      >
        <span className="flex flex-col">
          <span className="font-medium">Mon mot de passe</span>
          <span className="text-[13.5px] text-texte-2">Pour te connecter sans attendre de code</span>
        </span>
        <IconeFleche className="size-5 text-texte-2" />
      </Link>

      <p className="text-[14px] text-texte-2">
        Une info à corriger ? Écris simplement à Cindy, elle s’en occupe.
      </p>

      {reglages.lien_politique && (
        <a
          href={reglages.lien_politique}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] underline underline-offset-4"
        >
          Politique de confidentialité
        </a>
      )}

      <BoutonDeconnexion className="inline-flex items-center gap-2 text-[15px] font-medium text-erreur">
        <IconeDeconnexion className="size-5" /> Me déconnecter
      </BoutonDeconnexion>
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[13px] text-texte-2">{label}</span>
      <span className="text-[16px]">{valeur || "—"}</span>
    </div>
  );
}
