import type { Metadata } from "next";
import Link from "next/link";
import { IconePlus } from "@/components/icones";
import { Etiquette, LienBouton, Message, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { etatDefi, texteObjectif, textePeriode, typeDefi, type Defi } from "@/lib/defis";
import { compteursDefis, lireDefis } from "@/lib/defis-serveur";

export const metadata: Metadata = { title: "Défis du mois" };

const ORDRE = { en_cours: 0, a_venir: 1, termine: 2 } as const;

/** Les défis du mois : en cours, à venir, brouillons et terminés. */
export default async function PageDefis() {
  const { supabase } = await exigerCoach();
  const auj = aujourdhuiParis();
  const [defis, compteurs] = await Promise.all([lireDefis(supabase), compteursDefis(supabase)]);
  const tries = [...(defis ?? [])].sort((a, b) => ORDRE[etatDefi(a, auj)] - ORDRE[etatDefi(b, auj)] || b.debut.localeCompare(a.debut));
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Défis du mois</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Mes défis</h1>
          <p className="mt-1 text-[15px] text-texte-2">
            Un défi à relever ensemble : tes clientes choisissent d’y participer, suivent leur progression et celle du groupe (jamais les chiffres des autres).
          </p>
        </div>
        <LienBouton href="/coach/defis/nouveau">
          <IconePlus className="size-5" /> Nouveau défi
        </LienBouton>
      </div>
      {defis === null ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0042_defis.sql (voir le guide).</Message>
      ) : tries.length === 0 ? (
        <p className="text-[15px] text-texte-2">Aucun défi pour l’instant : lance le premier !</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tries.map((d) => (
            <li key={d.id}>
              <CarteDefi d={d} auj={auj} compteur={compteurs.get(d.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteDefi({ d, auj, compteur }: { d: Defi; auj: string; compteur?: { participantes: number; reussites: number } }) {
  const etat = etatDefi(d, auj);
  return (
    <Link href={`/coach/defis/${d.id}`} className="flex h-full flex-col gap-2 rounded-carte bg-blanc-casse p-4 shadow-douce hover:ring-2 hover:ring-accent/30">
      <span className="flex items-start justify-between gap-2">
        <span className="font-titre text-lg font-bold leading-tight">
          {typeDefi(d.type).emoji} {d.titre}
        </span>
        {!d.publie ? (
          <Etiquette ton="rose">Brouillon</Etiquette>
        ) : etat === "en_cours" ? (
          <Etiquette ton="vert">En cours</Etiquette>
        ) : etat === "a_venir" ? (
          <Etiquette>À venir</Etiquette>
        ) : (
          <Etiquette>Terminé</Etiquette>
        )}
      </span>
      <span className="text-[13.5px] text-texte-2">
        {texteObjectif(d)}, {textePeriode(d)}
      </span>
      <span className="text-[13px] text-texte-2">
        {d.audience === "toutes" ? "Toutes les clientes en suivi" : "Membres de la communauté"} · {compteur?.participantes ?? 0} participante
        {(compteur?.participantes ?? 0) > 1 ? "s" : ""} · {compteur?.reussites ?? 0} réussite{(compteur?.reussites ?? 0) > 1 ? "s" : ""}
      </span>
    </Link>
  );
}
