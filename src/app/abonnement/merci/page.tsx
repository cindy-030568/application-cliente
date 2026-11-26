import type { Metadata } from "next";
import Link from "next/link";
import { Logo, classesBouton } from "@/components/ui";

export const metadata: Metadata = { title: "Bienvenue" };

/** Retour de Stripe après le paiement. Le compte est créé par le message de Stripe (quelques secondes). */
export default function PageMerci() {
  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 pb-12 apparition">
      <Logo className="text-xl" />
      <h1 className="font-titre text-[32px] font-bold leading-tight">Bienvenue, je suis tellement contente 💛</h1>
      <p className="text-[16px] text-texte-2">
        Ton paiement est validé. Ton espace se prépare : je t’envoie un email pour te connecter dans quelques instants (pense à regarder dans les indésirables).
      </p>
      <p className="text-[16px] text-texte-2">Tu peux aussi te connecter tout de suite avec ton adresse email : tu recevras un code.</p>
      <Link href="/connexion" className={classesBouton("principal", true)}>
        Me connecter
      </Link>
    </main>
  );
}
