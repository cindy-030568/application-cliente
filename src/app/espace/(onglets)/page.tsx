import type { Metadata } from "next";
import Link from "next/link";
import { CarteDefiCliente } from "@/components/defis/carte-defi";
import { IconeFleche, IconeProfil } from "@/components/icones";
import { Carte, Logo } from "@/components/ui";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { exigerAbonnee } from "@/lib/auth";
import { aujourdhuiParis } from "@/lib/bilan";
import { lireEtatCommunaute } from "@/lib/communaute-serveur";
import { defisDeLaCliente } from "@/lib/defis-serveur";
import { encouragementDuJour } from "@/lib/encouragements";
import { besoinsQuotidiens, formaterKcal, metabolismeDeBase, type DonneesMetabolisme } from "@/lib/metabolisme";
import { LIBELLES_REPAS_MENU, REPAS_MENU, jourDuMenu } from "@/lib/menus";
import { lireMenuPublie } from "@/lib/menus-serveur";
import { urlPhotoRecette } from "@/lib/recettes";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Mon espace" };

/** Un nombre stable pour un jour donné : la même idée recette toute la journée, une autre le lendemain. */
function indiceDuJour(jour: string, n: number) {
  let h = 0;
  for (const c of jour) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return n ? h % n : 0;
}

/** Accueil de l'abonnée : le défi, son journal du jour, une idée recette, son métabolisme, et la porte vers le coaching. */
export default async function AccueilAbonnee() {
  const { supabase, profil, fiche } = await exigerAbonnee();
  const auj = aujourdhuiParis();
  const [defis, communaute, { data: journee }, { data: meta }, { data: recettes }, offre, menu] = await Promise.all([
    defisDeLaCliente(supabase, profil.id, auj),
    lireEtatCommunaute(supabase),
    supabase.from("journal_quotidien").select("jour").eq("cliente_id", profil.id).eq("jour", auj).maybeSingle(),
    supabase.from("metabolisme").select("annee_naissance, taille_cm, poids_kg, activite").eq("cliente_id", profil.id).maybeSingle<DonneesMetabolisme>(),
    supabase.from("recettes").select("id, titre, photo_path").order("titre").returns<{ id: string; titre: string; photo_path: string | null }[]>(),
    lireReglagesAbonnement(createAdminClient()).catch(() => null),
    lireMenuPublie(supabase, auj).catch(() => null),
  ]);
  // Le menu du jour, s'il y en a un (sinon l'idée recette du jour).
  const jourMenu = menu ? jourDuMenu(menu.lundi, auj) : null;
  const titres = new Map((recettes ?? []).map((r) => [r.id, r.titre]));
  const auMenu = REPAS_MENU.flatMap((r) => {
    const c = menu?.cases.find((x) => x.jour === jourMenu && x.repas === r);
    const t = c ? titres.get(c.recette_id) : undefined;
    return t ? [{ repas: r, titre: t }] : [];
  });
  const recette = recettes?.length ? recettes[indiceDuJour(auj, recettes.length)] : null;
  const photo = recette ? urlPhotoRecette(recette.photo_path) : null;
  const annee = new Date().getFullYear();
  const donnees = meta ? { ...meta, taille_cm: Number(meta.taille_cm), poids_kg: Number(meta.poids_kg) } : null;

  return (
    <div className="flex flex-col gap-5 px-5 pb-6">
      <header className="pt-encoche flex flex-col gap-5 pb-1">
        <div className="flex items-center justify-between">
          <Logo className="text-lg" />
          <Link href="/espace/profil" aria-label="Mon profil" className="flex size-10 items-center justify-center rounded-full bg-blanc-casse text-chocolat shadow-douce">
            <IconeProfil className="size-5" />
          </Link>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="font-titre text-[32px] font-bold leading-tight">
            Bonjour <span className="text-accent">{profil.prenom || "toi"}</span>
          </h1>
          <p className="font-main text-[24px] leading-tight text-caramel-texte">{encouragementDuJour(auj)}</p>
        </div>
      </header>

      <Link
        href="/espace/journal"
        className={journee ? "flex items-center justify-between gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce" : "flex items-center justify-between gap-3 rounded-carte bg-chocolat p-5 text-creme"}
      >
        <span className="flex flex-col gap-0.5">
          <span className={journee ? "font-medium" : "font-titre text-[20px] font-bold"}>{journee ? "📔 Mon journal du jour ✓" : "📔 Mon journal du jour"}</span>
          <span className={journee ? "text-[13.5px] text-texte-2" : "text-[14px] text-texte-clair"}>
            {journee ? "C’est noté pour aujourd’hui. Bravo de prendre ce moment pour toi." : "Eau, sommeil, énergie… 30 secondes pour faire le point."}
          </span>
        </span>
        <IconeFleche className="size-5 shrink-0" />
      </Link>

      {defis.slice(0, 1).map((d) => (
        <CarteDefiCliente key={d.id} d={d} auj={auj} sansChiffres={fiche.mode_sans_chiffres} communaute={Boolean(communaute?.ouverte)} />
      ))}

      {auMenu.length > 0 ? (
        <Link href="/espace/recettes/menu" className="flex flex-col gap-2 rounded-carte bg-blanc-casse p-4 shadow-douce">
          <span className="flex items-center justify-between">
            <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">Au menu aujourd’hui</span>
            <IconeFleche className="size-5 text-texte-2" />
          </span>
          <ul className="flex flex-col gap-1">
            {auMenu.map((m) => (
              <li key={m.repas} className="text-[14.5px] leading-snug">
                <span className="text-texte-2">{LIBELLES_REPAS_MENU[m.repas]} · </span>
                {m.titre}
              </li>
            ))}
          </ul>
        </Link>
      ) : recette && (
        <Link href={`/espace/recettes/${recette.id}`} className="flex items-center gap-4 overflow-hidden rounded-carte bg-blanc-casse shadow-douce">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-24 shrink-0 object-cover" />
          ) : (
            <span className="flex size-24 shrink-0 items-center justify-center bg-sable text-3xl" aria-hidden>
              🍽️
            </span>
          )}
          <span className="flex flex-col gap-0.5 py-3 pr-4">
            <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">L’idée recette du jour</span>
            <span className="font-medium leading-snug">{recette.titre}</span>
          </span>
        </Link>
      )}

      <Link href="/espace/metabolisme" className="flex items-center justify-between gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce">
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">🔥 Mon métabolisme</span>
          <span className="text-[13.5px] text-texte-2">
            {donnees
              ? `Au repos ${formaterKcal(metabolismeDeBase(donnees, annee))}, au quotidien environ ${formaterKcal(besoinsQuotidiens(donnees, annee))}.`
              : "Découvre ce dont ton corps a besoin chaque jour."}
          </span>
        </span>
        <IconeFleche className="size-5 shrink-0 text-texte-2" />
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Raccourci href="/espace/bouger" emoji="⚡" titre="Bouger" texte="Séances express" />
        <Raccourci href="/espace/ressources" emoji="🎧" titre="Fiches & audios" texte="Pour aller plus loin" />
      </div>

      {offre?.lienCoaching && (
        <a href={offre.lienCoaching} target="_blank" rel="noopener noreferrer" className="rounded-carte bg-accent-pale/70 p-5">
          <span className="block text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">Envie d’aller plus loin ?</span>
          <span className="mt-1 block font-titre text-[20px] font-bold">Passer au coaching</span>
          <span className="mt-1 block text-[14px] text-texte-2">Un plan fait pour toi, mon suivi personnalisé, et l’appli à vie.</span>
        </a>
      )}
    </div>
  );
}

function Raccourci({ href, emoji, titre, texte }: { href: string; emoji: string; titre: string; texte: string }) {
  return (
    <Link href={href}>
      <Carte className="flex h-full flex-col gap-1">
        <span className="text-2xl" aria-hidden>
          {emoji}
        </span>
        <span className="font-medium">{titre}</span>
        <span className="text-[13px] text-texte-2">{texte}</span>
      </Carte>
    </Link>
  );
}
