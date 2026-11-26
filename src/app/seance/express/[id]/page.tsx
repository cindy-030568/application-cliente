import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BandeauHorsConnexion, PreparerHorsConnexion } from "@/components/hors-connexion";
import { LecteurSeance } from "@/components/programme/lecteur-seance";
import { exigerCliente } from "@/lib/auth";
import { cleExercice } from "@/lib/programme-sportif";
import { videosParExercice } from "@/lib/programme-sportif-serveur";
import { regrouperCharges } from "@/lib/seance-guidee";
import { lireCharges } from "@/lib/seances-faites-serveur";
import { accesExpress } from "@/lib/seances-express";
import { lireSeanceExpress } from "@/lib/seances-express-serveur";
import { lireSuiviSport } from "@/lib/paiements-serveur";
import { noterChargesExpress, validerSeanceExpress } from "../../../programme-actions";

export const metadata: Metadata = { title: "Séance express" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Séance express en mode séance guidée : plein écran, enregistrée comme « séance libre ». */
export default async function PageSeanceExpress({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, profil, fiche } = await exigerCliente();
  if (!accesExpress(fiche)) redirect("/seances-express");
  // La RLS ne renvoie qu'une séance publiée et destinée à cette cliente.
  const s = await lireSeanceExpress(supabase, id);
  if (!s || !s.publiee) notFound();
  const cles = [...new Set(s.contenu.blocs.flatMap((b) => b.exercices.map((e) => cleExercice(e.nom))))];
  const [videos, charges, sport] = await Promise.all([videosParExercice(supabase), lireCharges(supabase, { cles }), lireSuiviSport(supabase, profil.id)]);
  return (
    <main className="mx-auto w-full max-w-lg px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <BandeauHorsConnexion />
      {/* Gardée sur le téléphone : elle marchera ensuite sans réseau. */}
      <PreparerHorsConnexion proprietaire={profil.id} pages={["/seances-express", `/seance/express/${id}`]} />
      <LecteurSeance
        seance={s.contenu}
        cle={`express:${id}`}
        retour="/seances-express"
        videos={videos}
        // Les vidéos d'exercices sont dans l'onglet Sport (réservé au suivi sportif).
        lienVideo={sport ? "/sport/videos/" : null}
        valider={validerSeanceExpress.bind(null, id)}
        historique={regrouperCharges(charges ?? [])}
        noterCharges={noterChargesExpress}
        horsConnexion={{ programmeId: null, seance: 0, nom: s.titre, seanceExpressId: id }}
      />
    </main>
  );
}
