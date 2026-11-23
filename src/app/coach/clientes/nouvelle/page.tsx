import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { creerCliente } from "../actions";
import { FormulaireInfos } from "../formulaire-infos";
import { formulesUtilisees } from "@/lib/paiements-serveur";
import { OBJECTIFS } from "@/lib/analyse-cliente";

export const metadata: Metadata = { title: "Nouvelle cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageNouvelleCliente({ searchParams }: { searchParams: Promise<{ demande?: string }> }) {
  const { demande: demandeId } = await searchParams;
  const { supabase } = await exigerCoach();
  const [formules, { data: demande }, { data: categories }] = await Promise.all([
    formulesUtilisees(supabase),
    demandeId && UUID.test(demandeId)
      ? supabase
          .from("demandes_inscription")
          .select("id, prenom, nom, email, objectif, objectif_code, exclusions_texte, categories_exclues")
          .eq("id", demandeId)
          .eq("statut", "a_valider")
          .maybeSingle<{
            id: string;
            prenom: string;
            nom: string;
            email: string;
            objectif: string | null;
            objectif_code: string | null;
            exclusions_texte: string | null;
            categories_exclues: string[];
          }>()
      : Promise.resolve({ data: null }),
    supabase.from("categories_aliment").select("id, nom"),
  ]);
  const nomCategorie = new Map((categories ?? []).map((c) => [c.id as string, c.nom as string]));
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/coach/clientes" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Clientes
      </Link>
      <div>
        <Surtitre>Nouvelle cliente</Surtitre>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Bienvenue à elle ✨</h1>
      </div>
      {demande && (
        <Carte className="flex flex-col gap-2 border-2 border-caramel/40">
          <h2 className="font-titre text-xl font-bold">Depuis son formulaire d’inscription</h2>
          <p className="text-[14px] text-texte-2">
            Vérifie ses informations ci-dessous. À la création, ses exclusions proposées et son objectif sont ajoutés à sa fiche
            (modifiables ensuite). Elle ne reçoit l’email de connexion que si la case est cochée.
          </p>
          <ul className="flex flex-col gap-1 text-[14.5px]">
            {demande.objectif && (
              <li>
                <strong className="font-medium">Objectif :</strong> {demande.objectif}
                {demande.objectif_code ? ` → ${OBJECTIFS[demande.objectif_code as keyof typeof OBJECTIFS] ?? demande.objectif_code}` : " (à choisir dans ses besoins)"}
              </li>
            )}
            {demande.exclusions_texte && (
              <li>
                <strong className="font-medium">Allergies, aliments évités :</strong> {demande.exclusions_texte}
              </li>
            )}
            <li>
              <strong className="font-medium">Exclusions ajoutées :</strong>{" "}
              {demande.categories_exclues.length ? demande.categories_exclues.map((c) => nomCategorie.get(c) ?? "?").join(", ") : "aucune"}
            </li>
          </ul>
        </Carte>
      )}
      <Carte>
        <FormulaireInfos
          action={creerCliente}
          creation
          formules={formules}
          demandeId={demande?.id}
          valeurs={
            demande
              ? {
                  prenom: demande.prenom,
                  nom: demande.nom,
                  email: demande.email,
                  date_debut: null,
                  date_fin: null,
                  frequence_bilan_jours: 14,
                  acces_formation: true,
                  masquer_graph_poids: false,
                }
              : undefined
          }
        />
      </Carte>
    </div>
  );
}
