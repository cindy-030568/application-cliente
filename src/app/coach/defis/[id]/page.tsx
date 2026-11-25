import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Etiquette, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { aujourdhuiParis, formaterDate } from "@/lib/bilan";
import { etatDefi, texteObjectif, textePeriode, typeDefi, unite } from "@/lib/defis";
import { lireDefi, progressionsDefi } from "@/lib/defis-serveur";
import { lireEtatCommunaute } from "@/lib/communaute-serveur";
import { ActionsDefi, FormulaireDefi } from "../formulaire";

export const metadata: Metadata = { title: "Défi du mois" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageDefiCoach({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const d = await lireDefi(supabase, id);
  if (!d) notFound();
  const auj = aujourdhuiParis();
  const [progressions, communaute, { data: noms }] = await Promise.all([
    progressionsDefi(supabase, id),
    lireEtatCommunaute(supabase),
    supabase.from("profils").select("id, prenom, nom").eq("role", "cliente"),
  ]);
  const nom = (cid: string) => {
    const p = noms?.find((x) => x.id === cid);
    return p ? `${p.prenom} ${p.nom}`.trim() : "Cliente";
  };
  const lignes = progressions
    .map((p) => ({ ...p, nom: nom(p.cliente_id), part: Math.min(1, p.reussites / d.objectif) }))
    .sort((a, b) => b.part - a.part || a.nom.localeCompare(b.nom, "fr"));
  const groupe = lignes.length ? Math.round((100 * lignes.reduce((s, l) => s + l.part, 0)) / lignes.length) : null;
  const etat = etatDefi(d, auj);
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link href="/coach/defis" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Défis du mois
      </Link>
      <div>
        <Surtitre>Défi du mois</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">
          {typeDefi(d.type).emoji} {d.titre}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-texte-2">
          {d.publie ? <Etiquette ton="vert">Publié</Etiquette> : <Etiquette ton="rose">Brouillon : invisible pour tes clientes</Etiquette>}
          {texteObjectif(d)}, {textePeriode(d)}
        </p>
      </div>
      <ActionsDefi id={id} publie={d.publie} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Carte className="flex flex-col gap-4">
          <div>
            <h2 className="font-titre text-xl font-bold">Participantes</h2>
            <p className="text-[13.5px] text-texte-2">
              {etat === "a_venir"
                ? `Le défi commence le ${formaterDate(d.debut)} : tes clientes pourront le relever à partir de ce jour-là.`
                : `${lignes.length} participante${lignes.length > 1 ? "s" : ""}${groupe !== null ? ` · le groupe en est à ${groupe} %` : ""}. Toi seule vois le détail.`}
            </p>
          </div>
          {lignes.length > 0 && (
            <ul className="flex flex-col gap-3">
              {lignes.map((l) => (
                <li key={l.cliente_id} className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between gap-3 text-[14.5px]">
                    <Link href={`/coach/clientes/${l.cliente_id}`} className="font-medium hover:underline">
                      {l.nom}
                    </Link>
                    <span className="text-texte-2">
                      {l.reussi_le ? "🏆 Réussi" : `${Math.min(l.reussites, d.objectif)} ${unite(d.type, l.reussites)} sur ${d.objectif}`}
                      {l.afficher_prenom ? " · prénom fêté" : ""}
                    </span>
                  </span>
                  <Jauge part={l.part} />
                </li>
              ))}
            </ul>
          )}
        </Carte>
        <Carte>
          <h2 className="mb-4 font-titre text-xl font-bold">Modifier</h2>
          <FormulaireDefi initial={d} periode={{ debut: d.debut, fin: d.fin }} communauteOuverte={Boolean(communaute?.ouverte)} aujourdhui={auj} />
        </Carte>
      </div>
    </div>
  );
}

function Jauge({ part }: { part: number }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-sable" aria-hidden>
      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(part * 100)}%` }} />
    </span>
  );
}
