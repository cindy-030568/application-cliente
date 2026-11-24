import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Etiquette } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { lundiDe } from "@/lib/planning";
import { urlPhotoRecette } from "@/lib/recettes";
import { recettesAdapteesCliente } from "@/lib/recettes-adaptees";
import { BoutonChoisir } from "../boutons";

export const metadata: Metadata = { title: "Choisir une recette" };

const nomJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default async function PageChoisir({ searchParams }: { searchParams: Promise<{ jour?: string; repas?: string }> }) {
  const { supabase, profil, reglages } = await exigerCliente();
  const { jour, repas: brut } = await searchParams;
  const index = Number(brut);
  if (!jour || !/^\d{4}-\d{2}-\d{2}$/.test(jour) || !Number.isInteger(index) || index < 0) notFound();
  const repas = await recettesAdapteesCliente(supabase, profil.id, reglages);
  const r = repas[index];
  if (!r) notFound();
  const retour = `/recettes/planning?semaine=${lundiDe(jour)}`;
  const liste = [...r.compatibles.map((a) => ({ a, approx: false })), ...r.approximatives.map((a) => ({ a, approx: true }))];

  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href={retour} className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Mon planning
      </Link>
      <div>
        <h1 className="font-titre text-[28px] font-bold leading-tight">{r.repas.libelle}</h1>
        <p className="text-[15px] text-texte-2 first-letter:uppercase">{nomJour.format(new Date(`${jour}T12:00:00Z`))} · quantités déjà adaptées à toi</p>
      </div>
      {liste.length === 0 ? (
        <p className="rounded-carte bg-blanc-casse p-5 text-[15px] text-texte-2 shadow-douce">Aucune recette ne correspond encore à ce repas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {liste.map(({ a, approx }) => {
            const recette = a.recette.source;
            const photo = urlPhotoRecette(recette.photo_path);
            return (
              <li key={recette.id} className="flex items-center gap-3 rounded-carte bg-blanc-casse p-3 shadow-douce">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="size-16 shrink-0 rounded-xl bg-sable" aria-hidden />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/recettes/${recette.id}?repas=${index}`} className="text-[15px] font-medium leading-snug hover:underline">
                    {recette.titre}
                  </Link>
                  {approx && (
                    <Etiquette ton="sable" className="w-fit">
                      Proche de tes repères
                    </Etiquette>
                  )}
                </span>
                <BoutonChoisir jour={jour} index={index} recetteId={recette.id} retour={retour} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
