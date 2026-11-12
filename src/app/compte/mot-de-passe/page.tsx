import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Logo } from "@/components/ui";
import { exigerConnexion } from "@/lib/auth";
import { FormulaireMotDePasse } from "./formulaire";

export const metadata: Metadata = { title: "Mon mot de passe" };

export default async function PageMotDePasse({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { profil } = await exigerConnexion();
  const { bienvenue } = await searchParams;
  const accueil = profil.role === "coach" ? "/coach" : "/";
  const retour = profil.role === "coach" ? "/coach" : "/profil";

  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-sm flex-col gap-7 px-6 pb-12 apparition">
      {bienvenue ? (
        <Logo className="mt-4 text-xl" />
      ) : (
        <Link href={retour} className="mt-4 inline-flex items-center gap-1 text-[15px] text-texte-2">
          <IconeRetour className="size-5" /> Retour
        </Link>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="font-titre text-[30px] font-bold leading-tight">
          {bienvenue ? "Pour aller plus vite la prochaine fois" : "Mon mot de passe"}
        </h1>
        <p className="text-texte-2">
          {bienvenue
            ? "Crée un mot de passe : tu pourras te connecter sans attendre de code. C’est facultatif."
            : "Crée ou change le mot de passe de ton compte."}
        </p>
      </div>
      <FormulaireMotDePasse email={profil.email} retour={bienvenue ? accueil : retour} />
      {bienvenue && (
        <Link href={accueil} className="text-center text-[14px] text-texte-2 underline underline-offset-4">
          Plus tard
        </Link>
      )}
    </main>
  );
}
