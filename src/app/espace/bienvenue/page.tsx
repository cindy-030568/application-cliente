import type { Metadata } from "next";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Logo, Message } from "@/components/ui";
import { exigerAbonnee } from "@/lib/auth";
import { accepterConsentementAbonnee } from "../actions";

export const metadata: Metadata = { title: "Tes données" };

/** Première connexion d'une abonnée : comment ses données sont protégées. */
export default async function PageBienvenueAbonnee({ searchParams }: { searchParams: Promise<{ manque?: string; erreur?: string }> }) {
  const { profil, reglages } = await exigerAbonnee(false);
  const { manque, erreur } = await searchParams;
  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col gap-7 px-6 pb-12 apparition">
      <Logo className="mt-4 text-xl" />
      <div className="flex flex-col gap-2">
        <h1 className="font-titre text-[30px] font-bold leading-tight">Bienvenue {profil.prenom} 💛</h1>
        <p className="text-texte-2">Avant de commencer, voici comment tes données sont protégées dans ton espace.</p>
      </div>
      <ul className="flex flex-col gap-4 rounded-bloc bg-blanc-casse p-5 text-[15px] shadow-douce">
        <li>
          <strong className="font-medium">Ce que l’app conserve :</strong> ton prénom, ton email, ton abonnement, et ce que tu choisis d’y noter (ton journal, tes favoris, ton planning). Certaines de ces informations peuvent concerner ta santé.
        </li>
        <li>
          <strong className="font-medium">Pourquoi :</strong> uniquement pour faire fonctionner ton espace. Rien n’est vendu, ni utilisé pour de la publicité.
        </li>
        <li>
          <strong className="font-medium">Qui y a accès :</strong> toi. Je vois seulement ton prénom, ton email et l’état de ton abonnement, pas ton journal. Si tu participes à la communauté, les membres voient ton prénom et ce que tu choisis d’y publier.
        </li>
        <li>
          <strong className="font-medium">Où :</strong> tes données sont stockées dans l’Union européenne, sur des serveurs sécurisés. Le paiement est géré par Stripe : je ne vois jamais ta carte bancaire.
        </li>
        <li>
          <strong className="font-medium">Combien de temps :</strong> pendant ton abonnement, puis 6 mois après son arrêt (pour que tu retrouves tout si tu reviens). Ensuite, elles sont supprimées.
        </li>
        <li>
          <strong className="font-medium">Tes droits :</strong> tu peux à tout moment consulter, corriger, récupérer ou faire supprimer tes données, en m’écrivant. Tu peux aussi contacter la CNIL.
        </li>
      </ul>
      {reglages.lien_politique && (
        <a href={reglages.lien_politique} target="_blank" rel="noopener noreferrer" className="text-[14px] underline underline-offset-4">
          Lire la politique de confidentialité complète
        </a>
      )}
      <form action={accepterConsentementAbonnee} className="flex flex-col gap-5">
        <CaseACocher name="accord" value="oui" required label="J’accepte que les informations que je note dans mon espace, y compris celles qui concernent ma santé, soient conservées pour le faire fonctionner." />
        {manque && <Message ton="erreur">Coche la case pour continuer.</Message>}
        {erreur && <Message ton="erreur">Un souci est survenu, réessaie dans un instant.</Message>}
        <BoutonEnvoi pleineLargeur>C’est parti</BoutonEnvoi>
      </form>
    </main>
  );
}
