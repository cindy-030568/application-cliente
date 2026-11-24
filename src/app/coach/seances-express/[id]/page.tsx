import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { VueProgramme } from "@/components/programme/vue-programme";
import { Carte, Etiquette, Surtitre, classesBouton } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { texteModification } from "@/lib/programme-sportif";
import { videosParExercice } from "@/lib/programme-sportif-serveur";
import { libelleNiveau } from "@/lib/seances-express";
import { lireListesExpress, lireSeanceExpress } from "@/lib/seances-express-serveur";
import { BoutonCopier } from "../../clientes/[id]/programme-sportif/composants";
import { clientesAChoisir } from "../clientes";
import { ActionsSeanceExpress, FormulaireSeanceExpress } from "../formulaire";

export const metadata: Metadata = { title: "Séance express" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageSeanceExpressCoach({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const s = await lireSeanceExpress(supabase, id);
  if (!s) notFound();
  const [listes, clientes, videos, { data: liens }] = await Promise.all([
    lireListesExpress(supabase),
    clientesAChoisir(supabase),
    videosParExercice(supabase),
    supabase.from("seances_express_clientes").select("cliente_id").eq("seance_id", id),
  ]);
  const programme = { titre: null, duree: null, frequence: null, conseils: null, seances: [s.contenu] };
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link href="/coach/seances-express" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Séances express
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Séance express</Surtitre>
          <h1 className="font-titre text-[32px] font-bold leading-tight">{s.titre}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-texte-2">
            {s.publiee ? <Etiquette ton="vert">Publiée</Etiquette> : <Etiquette ton="rose">Brouillon : invisible pour tes clientes</Etiquette>}
            {s.duree_minutes} min · {s.type} · {libelleNiveau(s.niveau)} · {s.materiel.length ? s.materiel.join(", ") : "sans matériel"}
          </p>
        </div>
        <Link href={`/coach/seances-express/${id}/apercu`} className={classesBouton("sombre")}>
          ▶ Tester le mode séance
        </Link>
      </div>
      <ActionsSeanceExpress id={id} publiee={s.publiee} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">La séance</h2>
          <VueProgramme programme={programme} videos={videos} lienVideo="/coach/videos/" />
          <BoutonCopier texte={texteModification({ ...programme, seances: [s.contenu] })} libelle="Copier pour la modifier avec Claude" aide="Colle dans Claude, dis ce qu’il faut changer, puis recolle sa réponse dans « Nouvelle version »." />
        </div>
        <Carte>
          <FormulaireSeanceExpress
            initiale={{ ...s, clientes: (liens ?? []).map((l) => l.cliente_id as string) }}
            listes={listes}
            clientes={clientes}
            avecContenuActuel
          />
        </Carte>
      </div>
    </div>
  );
}
