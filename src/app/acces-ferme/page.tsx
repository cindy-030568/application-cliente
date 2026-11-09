import type { Metadata } from "next";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Accès fermé" };

export default function PageAccesFerme() {
  return (
    <main className="pt-encoche flex min-h-dvh items-center justify-center px-6 pb-10">
      <div className="flex w-full max-w-sm flex-col gap-6 apparition">
        <Logo className="text-2xl" />
        <h1 className="font-titre text-[30px] font-bold leading-tight">Ton espace est fermé</h1>
        <p className="text-texte-2">
          Ton accès à l’app n’est plus actif. Si tu penses que c’est une erreur, ou si tu veux
          reprendre un accompagnement, écris directement à Cindy : elle sera ravie d’avoir de tes
          nouvelles.
        </p>
        <form action="/auth/deconnexion" method="post">
          <button className="underline underline-offset-4" type="submit">
            Me déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
