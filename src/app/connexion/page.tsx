import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { lireSession } from "@/lib/auth";
import { FormulaireConnexion } from "./formulaire";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion() {
  if (await lireSession()) redirect("/");

  return (
    <main className="pt-encoche relative flex min-h-dvh flex-col overflow-hidden px-6 pb-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent-pale/70 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-caramel-clair/40 blur-3xl"
      />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 apparition">
        <div className="flex flex-col gap-3">
          <Logo className="text-2xl" />
          <h1 className="font-titre text-[34px] font-bold leading-[1.1]">
            Ton espace <span className="text-accent">coaching</span>
          </h1>
          <p className="font-main text-[26px] leading-tight text-caramel">
            Comprendre. Appliquer. Durer.
          </p>
        </div>
        <FormulaireConnexion />
      </div>
    </main>
  );
}
