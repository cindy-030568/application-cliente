import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Champ, Logo, Message } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { accepterContrat } from "./actions";

export const metadata: Metadata = { title: "Ton contrat" };

export default async function PageContrat({
  searchParams,
}: {
  searchParams: Promise<{ manque?: string; erreur?: string; change?: string; infos?: string }>;
}) {
  const { supabase, profil } = await exigerCliente(true, false);
  const { manque, erreur, change, infos: infosManquantes } = await searchParams;
  const { data: version } = await supabase.rpc("contrat_a_accepter");
  if (typeof version !== "string" || !version) redirect("/");
  const [{ data: contrat }, { data: texte }, { data: infos }] = await Promise.all([
    supabase
      .from("reglages")
      .select("contrat_version, contrat_case_renonciation")
      .single<{ contrat_version: string; contrat_case_renonciation: string | null }>(),
    // Le contrat rempli avec ses informations (variables {{prenom}}, {{formule}}…), calculé par la base.
    supabase.rpc("mon_contrat_apercu"),
    supabase.rpc("mon_contrat_infos"),
  ]);
  if (!contrat || typeof texte !== "string" || !texte) redirect("/");
  const demandes = (infos ?? {}) as { demande_adresse?: boolean; demande_date_naissance?: boolean; date_naissance?: string | null };

  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-6 pb-12 apparition">
      <Logo className="mt-4 text-xl" />
      <div className="flex flex-col gap-2">
        <h1 className="font-titre text-[30px] font-bold leading-tight">Ton contrat d’accompagnement</h1>
        <p className="text-texte-2">
          Dernière étape avant de découvrir ton espace, {profil.prenom} : prends le temps de lire ton contrat (version {contrat.contrat_version}).
        </p>
      </div>

      <div
        tabIndex={0}
        aria-label="Texte du contrat"
        className="max-h-[55dvh] overflow-y-auto whitespace-pre-wrap rounded-bloc bg-blanc-casse p-5 text-[14.5px] leading-relaxed shadow-douce"
      >
        {texte}
      </div>

      <form action={accepterContrat} className="flex flex-col gap-5">
        <input type="hidden" name="version" value={contrat.contrat_version} />
        {(demandes.demande_adresse || demandes.demande_date_naissance) && (
          <div className="flex flex-col gap-4 rounded-bloc bg-blanc-casse p-5 shadow-douce">
            <p className="text-[14px] text-texte-2">Pour compléter ton contrat :</p>
            {demandes.demande_adresse && (
              <Champ label="Ton adresse postale" name="adresse" required maxLength={300} autoComplete="street-address" placeholder="N°, rue, code postal, ville" />
            )}
            {demandes.demande_date_naissance && (
              <Champ label="Ta date de naissance" name="date_naissance" type="date" required defaultValue={demandes.date_naissance ?? ""} />
            )}
          </div>
        )}
        <CaseACocher name="accepte" value="oui" required label={`J’ai lu et j’accepte le contrat ci-dessus (version ${contrat.contrat_version}).`} />
        <CaseACocher name="renonciation" value="oui" required label={contrat.contrat_case_renonciation ?? ""} />
        {manque && <Message ton="erreur">Coche les deux cases pour continuer.</Message>}
        {infosManquantes && <Message ton="erreur">Complète ton adresse et ta date de naissance pour continuer.</Message>}
        {change && <Message ton="info">Le contrat vient d’être mis à jour : relis cette nouvelle version, puis coche les deux cases.</Message>}
        {erreur && <Message ton="erreur">Un souci est survenu, réessaie dans un instant.</Message>}
        <BoutonEnvoi pleineLargeur enCours="Enregistrement…">
          J’accepte et je commence ✨
        </BoutonEnvoi>
        <p className="text-center text-[13px] text-texte-2">
          Ton acceptation est enregistrée avec la date et l’heure. Tu peux demander une copie de ton contrat à Cindy à tout moment.
        </p>
      </form>
    </main>
  );
}
