import type { Metadata } from "next";
import Link from "next/link";
import { Carte, Etiquette, Message, Surtitre, classesBouton } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { nomPublic, type NomAffiche } from "@/lib/parrainage";
import { BoutonSupprimerAvis } from "./boutons";

export const metadata: Metadata = { title: "Avis" };

type Avis = {
  id: string;
  cliente_id: string;
  texte: string;
  publiable: boolean;
  nom_affiche: NomAffiche | null;
  contexte: string;
  cree_le: string;
  clientes: { profils: { prenom: string; nom: string } } | null;
};
const quand = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const MOMENT: Record<string, string> = { victoire: "après une victoire", fin: "en fin de suivi", libre: "" };

/** Les témoignages des clientes : publication seulement si elles l'ont autorisée, sous le nom choisi. */
export default async function PageAvis({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { supabase } = await exigerCoach();
  const filtre = (await searchParams).filtre === "publiables" ? "publiables" : "tous";
  const { data, error } = await supabase
    .from("avis")
    .select("id, cliente_id, texte, publiable, nom_affiche, contexte, cree_le, clientes(profils(prenom, nom))")
    .order("cree_le", { ascending: false })
    .returns<Avis[]>();
  const avis = (data ?? []).filter((a) => filtre === "tous" || a.publiable);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Avis</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Témoignages de tes clientes</h1>
          <p className="mt-1 text-[15px] text-texte-2">
            Tu ne publies un témoignage que si ta cliente l’a autorisé, et seulement sous le nom qu’elle a choisi. Elle peut changer d’avis à tout moment.
          </p>
        </div>
        {!error && (data ?? []).length > 0 && (
          <a href="/coach/avis/export" className={classesBouton("contour")} download>
            Exporter (Excel / CSV)
          </a>
        )}
      </div>
      {error ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0039_avis_parrainage.sql (voir le guide).</Message>
      ) : (
        <>
          <nav className="flex gap-2 text-[14px]" aria-label="Filtre">
            {(["tous", "publiables"] as const).map((f) => (
              <Link
                key={f}
                href={f === "tous" ? "/coach/avis" : "/coach/avis?filtre=publiables"}
                className={filtre === f ? "rounded-full bg-chocolat px-4 py-2 text-creme" : "rounded-full bg-blanc-casse px-4 py-2 shadow-douce"}
              >
                {f === "tous" ? "Tous" : "Publication autorisée"}
              </Link>
            ))}
          </nav>
          {avis.length === 0 ? (
            <p className="text-[15px] text-texte-2">Aucun témoignage pour l’instant.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {avis.map((a) => {
                const prenom = a.clientes?.profils.prenom ?? "";
                const publie = nomPublic(a, prenom);
                return (
                  <li key={a.id}>
                    <Carte className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/coach/clientes/${a.cliente_id}`} className="font-medium hover:text-accent">
                          {prenom} {a.clientes?.profils.nom ?? ""}
                        </Link>
                        <span className="text-[13px] text-texte-2">
                          {quand.format(new Date(a.cree_le))} {MOMENT[a.contexte] ?? ""}
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-[15.5px]">« {a.texte} »</p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {publie ? (
                          <Etiquette ton="vert">Publication autorisée, signé « {publie} »</Etiquette>
                        ) : (
                          <Etiquette ton="sable">Pas de publication : reste entre vous</Etiquette>
                        )}
                        <BoutonSupprimerAvis id={a.id} />
                      </div>
                    </Carte>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
