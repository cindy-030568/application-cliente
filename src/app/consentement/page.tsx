import type { Metadata } from "next";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Logo, Message } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { accepterConsentement } from "./actions";

export const metadata: Metadata = { title: "Tes données" };

export default async function PageConsentement({
  searchParams,
}: {
  searchParams: Promise<{ manque?: string; erreur?: string }>;
}) {
  const { profil, reglages } = await exigerCliente(false);
  const { manque, erreur } = await searchParams;

  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col gap-7 px-6 pb-12 apparition">
      <Logo className="mt-4 text-xl" />
      <div className="flex flex-col gap-2">
        <h1 className="font-titre text-[30px] font-bold leading-tight">
          Bienvenue {profil.prenom} 💛
        </h1>
        <p className="text-texte-2">
          Avant de commencer, voici comment tes données sont protégées dans ton espace.
        </p>
      </div>

      <ul className="flex flex-col gap-4 rounded-bloc bg-blanc-casse p-5 text-[15px] shadow-douce">
        <li>
          <strong className="font-medium">Ce que l’app conserve :</strong> ton prénom, ton nom,
          ton email, tes plans, et plus tard tes mesures, photos de progression et préférences
          alimentaires.
        </li>
        <li>
          <strong className="font-medium">Pourquoi :</strong> uniquement pour ton suivi de
          coaching avec Cindy. Rien n’est vendu ni partagé.
        </li>
        <li>
          <strong className="font-medium">Qui y a accès :</strong> toi et Cindy, personne
          d’autre. Les autres clientes ne voient jamais tes données.
        </li>
        <li>
          <strong className="font-medium">Où :</strong> tes données sont stockées en France
          (Paris), sur des serveurs sécurisés.
        </li>
        <li>
          <strong className="font-medium">Tes droits :</strong> tu peux demander à tout moment à
          consulter, corriger ou supprimer tes données en écrivant à Cindy.
        </li>
      </ul>

      {reglages.lien_politique && (
        <a
          href={reglages.lien_politique}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] underline underline-offset-4"
        >
          Lire la politique de confidentialité complète
        </a>
      )}

      <form action={accepterConsentement} className="flex flex-col gap-5">
        <CaseACocher
          name="accord"
          value="oui"
          required
          label="J’accepte que mes données de suivi, y compris mes données de santé (mesures, photos), soient conservées pour mon coaching."
        />
        {manque && <Message ton="erreur">Coche la case pour continuer.</Message>}
        {erreur && <Message ton="erreur">Un souci est survenu, réessaie dans un instant.</Message>}
        <BoutonEnvoi pleineLargeur>C’est parti</BoutonEnvoi>
      </form>
    </main>
  );
}
