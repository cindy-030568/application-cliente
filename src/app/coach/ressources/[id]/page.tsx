import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fiche } from "@/components/fiche";
import { IconeExterne, IconeRetour } from "@/components/icones";
import { LecteurAudio } from "@/components/lecteur-audio";
import { Carte, Etiquette } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { lienAudio } from "@/lib/ressources-serveur";

export const metadata: Metadata = { title: "Aperçu de la ressource" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aperçu d'une fiche ou d'un audio tel que tes clientes le liront / l'écouteront. */
export default async function ApercuRessource({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: r } = await supabase
    .from("ressources")
    .select("titre, description, contenu, publiee, url")
    .eq("id", id)
    .maybeSingle<{ titre: string; description: string | null; contenu: string | null; publiee: boolean; url: string | null }>();
  if (!r) notFound();
  // Audio (0043) : lu à part, rien avant la mise à jour.
  const { data: audio } = await supabase.from("ressources").select("audio_path, audio_duree").eq("id", id).maybeSingle<{ audio_path: string | null; audio_duree: number | null }>();
  if (!r.contenu && !audio?.audio_path) notFound();
  const [src, { data: ecoutes }] = await Promise.all([
    audio?.audio_path ? lienAudio(supabase, audio.audio_path) : Promise.resolve(null),
    supabase.from("ressources_ecoutes").select("cliente_id, terminee").eq("ressource_id", id),
  ]);
  const nbEcoutes = ecoutes?.length ?? 0;
  const nbFinies = (ecoutes ?? []).filter((e) => e.terminee).length;
  return (
    <div className="flex flex-col gap-5">
      <Link href="/coach/ressources" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Mes ressources
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-titre text-[32px] font-bold leading-tight">{r.titre}</h1>
        {r.publiee ? <Etiquette ton="vert">Publiée</Etiquette> : <Etiquette ton="rose">Brouillon : invisible pour tes clientes</Etiquette>}
      </div>
      <p className="text-[14px] text-texte-2">
        Aperçu tel que tes clientes le verront. Pour le modifier ou le publier : Mes ressources → Modifier.
        {audio?.audio_path && ` Écouté par ${nbEcoutes} cliente${nbEcoutes > 1 ? "s" : ""}${nbEcoutes ? ` (dont ${nbFinies} jusqu’au bout)` : ""}.`}
      </p>
      <div className="flex max-w-2xl flex-col gap-4">
        {audio?.audio_path && (src ? <LecteurAudio src={src} titre={r.titre} dureeConnue={audio.audio_duree} /> : <p className="text-[14px] text-erreur">L’audio est introuvable dans le stockage.</p>)}
        {r.contenu && (
          <Carte>
            {r.description && <p className="mb-4 text-[15px] italic text-texte-2">{r.description}</p>}
            <Fiche contenu={r.contenu} />
          </Carte>
        )}
        {r.url && (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[15px] font-medium underline underline-offset-4">
            Ouvrir le lien <IconeExterne className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}
