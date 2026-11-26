import type { Metadata } from "next";
import { BoutonDeconnexion } from "@/components/hors-connexion";
import { Carte, Logo } from "@/components/ui";
import { texteMonAbonnement } from "@/lib/abonnement";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { exigerAbonnee } from "@/lib/auth";
import { aujourdhuiParis, formaterDate } from "@/lib/bilan";
import { encouragementDuJour } from "@/lib/encouragements";
import { createAdminClient } from "@/lib/supabase/admin";
import { BoutonGerer } from "./bouton-gerer";

export const metadata: Metadata = { title: "Mon espace" };

const A_VENIR = ["🔥 Mon métabolisme", "🍽️ Mes recettes, le planning et la liste de courses", "⚡ Les séances express", "🏆 Les défis du mois", "🎧 Fiches et audios", "💬 La communauté"];

/** Espace de l'abonnée (socle) : son abonnement, la passerelle vers le coaching. Le contenu arrive à l'étape suivante. */
export default async function PageEspace() {
  const { profil, fiche } = await exigerAbonnee();
  const reglages = await lireReglagesAbonnement(createAdminClient()).catch(() => null);
  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-5 pb-12 apparition">
      <Logo className="mt-4 text-xl" />
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[32px] font-bold leading-tight">
          Bonjour <span className="text-accent">{profil.prenom || "toi"}</span>
        </h1>
        <p className="font-main text-[24px] leading-tight text-caramel-texte">{encouragementDuJour(aujourdhuiParis())}</p>
      </div>

      <Carte className="flex flex-col gap-3">
        <h2 className="font-titre text-xl font-bold">Ton espace se prépare ✨</h2>
        <p className="text-[15px] text-texte-2">Je mets la touche finale. Très bientôt, tu trouveras ici :</p>
        <ul className="flex flex-col gap-1.5 text-[15px]">
          {A_VENIR.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Carte>

      <Carte className="flex flex-col gap-3">
        <h2 className="font-titre text-xl font-bold">Mon abonnement</h2>
        <p className="text-[15px]">{texteMonAbonnement(fiche, (d) => formaterDate(d))}</p>
        <BoutonGerer />
        <p className="text-[13px] text-texte-2">Carte bancaire, factures, formule, arrêt : tout se gère dans l’espace sécurisé de Stripe.</p>
      </Carte>

      {reglages?.lienCoaching && (
        <a href={reglages.lienCoaching} target="_blank" rel="noopener noreferrer" className="rounded-carte bg-chocolat p-5 text-creme">
          <span className="block text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-clair">Envie d’aller plus loin ?</span>
          <span className="mt-1 block font-titre text-[20px] font-bold">Passer au coaching</span>
          <span className="mt-1 block text-[14px] text-texte-clair">Un plan fait pour toi, mon suivi personnalisé, et l’appli à vie.</span>
        </a>
      )}

      <BoutonDeconnexion className="w-fit text-[14px] text-texte-2 underline underline-offset-4">Me déconnecter</BoutonDeconnexion>
    </main>
  );
}
