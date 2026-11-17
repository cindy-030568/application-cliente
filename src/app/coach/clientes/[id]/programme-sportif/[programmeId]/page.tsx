import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { VueProgramme } from "@/components/programme/vue-programme";
import { Carte, Etiquette } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { compterExercices, texteModification } from "@/lib/programme-sportif";
import { lireProgrammeSportif, videosParExercice } from "@/lib/programme-sportif-serveur";
import { ActionsProgramme, BoutonCopier, FormulaireImport } from "../composants";

export const metadata: Metadata = { title: "Programme sportif" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

export default async function PageProgramme({ params }: { params: Promise<{ id: string; programmeId: string }> }) {
  const { id, programmeId } = await params;
  if (!UUID.test(id) || !UUID.test(programmeId)) notFound();
  const { supabase } = await exigerCoach();
  const [p, videos, { data: c }] = await Promise.all([
    lireProgrammeSportif(supabase, programmeId),
    videosParExercice(supabase),
    supabase.from("clientes").select("profils!inner(prenom)").eq("id", id).maybeSingle<{ profils: { prenom: string } }>(),
  ]);
  if (!p || p.cliente_id !== id || !c) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/coach/clientes/${id}/programme-sportif`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Programmes de {c.profils.prenom}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-titre text-[30px] font-bold leading-tight">{p.titre}</h1>
        {p.publie ? (
          <Etiquette ton="vert">
            Publié le {dateCourte.format(new Date(p.publie_le ?? p.updated_at))}
            {p.vu_le ? ` · vu le ${dateCourte.format(new Date(p.vu_le))}` : " · pas encore vu"}
          </Etiquette>
        ) : (
          <Etiquette ton="sable">Brouillon</Etiquette>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-[14px] text-texte-2">
            Aperçu tel qu’elle le verra · {p.contenu.seances.length} séance{p.contenu.seances.length > 1 ? "s" : ""}, {compterExercices(p.contenu)} exercices.
            Un exercice qui porte le même nom qu’une vidéo de ta bibliothèque affiche « Voir la vidéo ».
          </p>
          <VueProgramme programme={p.contenu} videos={videos} lienVideo="/coach/videos/" />
        </div>

        <div className="flex flex-col gap-6">
          <Carte className="flex flex-col gap-3">
            <h2 className="font-titre text-xl font-bold">Publier</h2>
            <ActionsProgramme clienteId={id} programmeId={p.id} publie={p.publie} prenom={c.profils.prenom} titre={p.titre} />
          </Carte>
          <Carte className="flex flex-col gap-4">
            <h2 className="font-titre text-xl font-bold">Modifier avec Claude</h2>
            <BoutonCopier
              texte={texteModification(p.contenu)}
              libelle="Copier le programme pour Claude"
              aide="Colle-le dans Claude, écris ce qu’il faut changer, puis colle sa réponse ci-dessous."
            />
            <FormulaireImport clienteId={id} programmeId={p.id} />
          </Carte>
        </div>
      </div>
    </div>
  );
}
