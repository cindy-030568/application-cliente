import type { Metadata } from "next";
import Link from "next/link";
import { IconePlus } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Message, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { DEMANDE_SEANCE_EXPRESS, CONSIGNE_SEANCE_EXPRESS, libelleNiveau } from "@/lib/seances-express";
import { lireSeancesExpress } from "@/lib/seances-express-serveur";
import { BoutonCopier } from "../clientes/[id]/programme-sportif/composants";

export const metadata: Metadata = { title: "Séances express" };

/** Bibliothèque des séances express (séances de secours à la carte). */
export default async function PageSeancesExpress() {
  const { supabase } = await exigerCoach();
  const [seances, { data: faites }] = await Promise.all([
    lireSeancesExpress(supabase),
    supabase.from("seances_faites").select("seance_express_id").not("seance_express_id", "is", null).limit(5000),
  ]);
  const nbFaites = new Map<string, number>();
  for (const f of faites ?? []) nbFaites.set(f.seance_express_id as string, (nbFaites.get(f.seance_express_id as string) ?? 0) + 1);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Séances express</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Mes séances de secours</h1>
          <p className="mt-1 text-[15px] text-texte-2">
            Des séances courtes, pour les jours où tes clientes ne peuvent pas faire leur programme. Elles les trouvent dans « Séances express » et les font en mode séance guidée.
          </p>
        </div>
        <LienBouton href="/coach/seances-express/nouvelle">
          <IconePlus className="size-5" /> Nouvelle séance
        </LienBouton>
      </div>

      <Carte className="flex flex-col gap-4">
        <h2 className="font-titre text-lg font-bold">Préparer une séance avec Claude</h2>
        <BoutonCopier texte={CONSIGNE_SEANCE_EXPRESS} libelle="Copier la consigne" aide="Colle-la dans Claude, décris la séance voulue, puis dis « format application »." />
        <BoutonCopier
          texte={DEMANDE_SEANCE_EXPRESS}
          libelle="Copier le message pour une séance déjà écrite"
          aide="Colle ce message dans Claude avec ta séance en PDF (ou son texte) : il la retranscrit au format de l’appli."
        />
      </Carte>

      {seances === null ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0040_seances_express.sql (voir le guide).</Message>
      ) : seances.length === 0 ? (
        <p className="text-[15px] text-texte-2">Aucune séance express pour l’instant : crée la première !</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {seances.map((s) => (
            <li key={s.id}>
              <Link href={`/coach/seances-express/${s.id}`} className="flex h-full flex-col gap-2 rounded-carte bg-blanc-casse p-4 shadow-douce hover:ring-2 hover:ring-accent/30">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-titre text-lg font-bold leading-tight">{s.titre}</span>
                  {s.publiee ? <Etiquette ton="vert">Publiée</Etiquette> : <Etiquette ton="rose">Brouillon</Etiquette>}
                </span>
                <span className="text-[13.5px] text-texte-2">
                  {s.duree_minutes} min · {s.type} · {libelleNiveau(s.niveau)} · {s.materiel.length ? s.materiel.join(", ") : "sans matériel"}
                </span>
                <span className="text-[13px] text-texte-2">
                  {s.visibilite === "toutes" ? "Toutes les clientes" : "Certaines clientes"} · faite {nbFaites.get(s.id) ?? 0} fois
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
