import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Etiquette, Message } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { lireSuiviSport } from "@/lib/paiements-serveur";
import { aujourdhuiParis } from "@/lib/bilan";
import { CONSIGNE_CLAUDE, compterExercices, echeanceRenouvellement } from "@/lib/programme-sportif";
import { lireProgrammes } from "@/lib/programme-sportif-serveur";
import { BoutonCopier, FormulaireImport } from "./composants";

export const metadata: Metadata = { title: "Programme sportif" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateCourte = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });

export default async function PageProgrammes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: c } = await supabase
    .from("clientes")
    .select("id, profils!inner(prenom, nom)")
    .eq("id", id)
    .maybeSingle<{ id: string; profils: { prenom: string; nom: string } }>();
  if (!c) notFound();
  const [programmes, sport] = await Promise.all([lireProgrammes(supabase, id), lireSuiviSport(supabase, id)]);
  const auj = aujourdhuiParis();

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/coach/clientes/${id}`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Fiche de {c.profils.prenom}
      </Link>
      <div>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Programme sportif</h1>
        <p className="text-[15px] text-texte-2">
          {c.profils.prenom} {c.profils.nom} · construit avec Claude, publié dans son onglet Sport.
        </p>
      </div>
      {!sport && (
        <Message ton="info">
          Le suivi sportif n’est pas coché dans sa fiche : elle ne voit pas l’onglet Sport. Coche « Suivi sportif » dans ses infos pour qu’elle voie son programme.
        </Message>
      )}

      {!programmes ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0016_programme_sportif.sql (voir le guide).</Message>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Carte className="flex min-w-0 flex-col gap-5">
            <h2 className="font-titre text-xl font-bold">Nouveau programme</h2>
            <ol className="flex flex-col gap-5">
              <li className="flex flex-col gap-2">
                <p className="text-[15px]">
                  <strong className="font-medium">1.</strong> Copie la consigne et colle-la au début d’une conversation Claude (ou une fois pour toutes dans
                  les instructions d’un projet Claude « Programmes sportifs »).
                </p>
                <BoutonCopier
                  texte={CONSIGNE_CLAUDE}
                  libelle="Copier la consigne pour Claude"
                  aide="Elle explique à Claude le format que l’application sait lire. Ne lui donne pas le nom de ta cliente : décris son objectif, son niveau, son matériel, ses contraintes."
                />
              </li>
              <li className="text-[15px]">
                <strong className="font-medium">2.</strong> Construis le programme avec Claude. Quand il te convient, écris-lui : <em>« format application »</em>.
              </li>
              <li className="flex flex-col gap-2">
                <p className="text-[15px]">
                  <strong className="font-medium">3.</strong> Copie toute sa réponse et colle-la ici. Tu verras un aperçu avant de le publier.
                </p>
                <FormulaireImport clienteId={id} />
              </li>
            </ol>
          </Carte>

          <Carte className="flex flex-col gap-4 self-start">
            <h2 className="font-titre text-xl font-bold">Ses programmes</h2>
            {programmes.length === 0 ? (
              <p className="text-[14px] text-texte-2">Aucun programme pour l’instant.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ligne">
                {programmes.map((p) => (
                  <li key={p.id}>
                    <Link href={`/coach/clientes/${id}/programme-sportif/${p.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-medium">{p.titre}</span>
                        <span className="text-[13px] text-texte-2">
                          {dateCourte.format(new Date(p.updated_at))} · {p.contenu.seances.length} séance{p.contenu.seances.length > 1 ? "s" : ""} ·{" "}
                          {compterExercices(p.contenu)} exercices
                        </span>
                        {p.publie && p.renouveler_le && (
                          <span className={echeanceRenouvellement(p.renouveler_le, auj).jours <= 7 ? "text-[13px] font-medium text-erreur" : "text-[13px] text-texte-2"}>
                            Prochain programme : {echeanceRenouvellement(p.renouveler_le, auj).texte}
                          </span>
                        )}
                      </span>
                      {p.publie ? <Etiquette ton="vert">{p.vu_le ? "Publié · vu" : "Publié"}</Etiquette> : <Etiquette ton="sable">Brouillon</Etiquette>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        </div>
      )}
    </div>
  );
}
