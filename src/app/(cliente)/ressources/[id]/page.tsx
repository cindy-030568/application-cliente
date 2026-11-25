import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fiche } from "@/components/fiche";
import { IconeExterne, IconeRetour } from "@/components/icones";
import { LecteurAudio } from "@/components/lecteur-audio";
import { classesBouton } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { dureeCourte, positionDeReprise } from "@/lib/ressources";
import { lienAudio, lireEcoutes, lireFavorisRessources, lireRessourcesCompletes } from "@/lib/ressources-serveur";
import { enregistrerEcoute, nouveauLienAudio } from "@/app/ressources-actions";
import { CoeurRessource } from "../coeur";

export const metadata: Metadata = { title: "Ressource" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageRessource({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, profil } = await exigerCliente();
  // La RLS ne renvoie que les ressources publiées, pour toutes ou choisies pour elle.
  const r = (await lireRessourcesCompletes(supabase)).find((x) => x.id === id);
  if (!r || (!r.contenu && !r.audio_path && !r.url)) notFound();
  const [favoris, ecoutes, src] = await Promise.all([
    lireFavorisRessources(supabase, profil.id),
    lireEcoutes(supabase, profil.id),
    r.audio_path ? lienAudio(supabase, r.audio_path) : Promise.resolve(null),
  ]);
  const depart = positionDeReprise(ecoutes.get(id) ?? null, r.audio_duree);
  return (
    <article className="pt-encoche flex flex-col gap-4 px-5 pb-8">
      <div className="flex items-center justify-between">
        <Link href="/ressources" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
          <IconeRetour className="size-5" /> Mes ressources
        </Link>
        <CoeurRessource id={id} favori={favoris.has(id)} titre={r.titre} clair />
      </div>
      <h1 className="font-titre text-[30px] font-bold leading-tight">{r.titre}</h1>
      {r.description && <p className="text-[16px] text-texte-2">{r.description}</p>}
      {r.audio_path &&
        (src ? (
          <section className="flex flex-col gap-2" aria-label="Version audio">
            {r.contenu && <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-caramel-texte">🎧 À écouter{r.audio_duree ? ` · ${dureeCourte(r.audio_duree)}` : ""}</span>}
            <LecteurAudio
              src={src}
              titre={r.titre}
              depart={depart}
              dureeConnue={r.audio_duree}
              enregistrer={enregistrerEcoute.bind(null, id)}
              nouveauLien={nouveauLienAudio.bind(null, id)}
            />
          </section>
        ) : (
          <p className="rounded-xl bg-sable/60 px-4 py-3 text-[14px]">L’audio n’est pas disponible pour le moment. Réessaie un peu plus tard.</p>
        ))}
      {r.contenu && <Fiche contenu={r.contenu} />}
      {r.url && (
        <a href={r.url} target="_blank" rel="noopener noreferrer" className={classesBouton("contour") + " w-fit"}>
          Ouvrir le document <IconeExterne className="size-4" />
        </a>
      )}
    </article>
  );
}
