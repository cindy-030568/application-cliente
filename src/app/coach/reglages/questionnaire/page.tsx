import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte, Message } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { parSection } from "@/lib/questionnaire";
import { chargerQuestions } from "@/lib/questionnaire-serveur";
import { EditeurQuestion, InterrupteurQuestionnaire, TexteAccueil } from "./editeur";

export const metadata: Metadata = { title: "Questionnaire d’arrivée" };

export default async function PageQuestionnaireCoach() {
  const { supabase } = await exigerCoach();
  const [questions, { error }, { data: reglage }, { data: intro }] = await Promise.all([
    chargerQuestions(supabase, true),
    supabase.from("questions_arrivee").select("id").limit(1),
    supabase.from("reglages").select("questionnaire_actif").maybeSingle<{ questionnaire_actif: boolean }>(),
    supabase.from("reglages").select("questionnaire_intro").maybeSingle<{ questionnaire_intro: string | null }>(),
  ]);
  const ordreSuivant = ((questions ?? []).at(-1)?.ordre ?? 0) + 10;
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link href="/coach/reglages" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Réglages
      </Link>
      <div>
        <h1 className="font-titre text-[34px] font-bold leading-tight">Questionnaire d’arrivée</h1>
        <p className="text-[15px] text-texte-2">
          Posé aux nouvelles clientes à leur première connexion, après le contrat. Il pré-remplit leurs exclusions de recettes et leur objectif
          (tu corriges tout depuis la fiche). Les clientes déjà en cours ne le voient pas.
        </p>
      </div>
      {error ? (
        <Message ton="info">Fais d’abord la mise à jour de la base : fichier 0031_questionnaire_arrivee.sql (voir le guide).</Message>
      ) : (
        <>
          <Carte className="flex flex-col gap-4">
            <InterrupteurQuestionnaire actif={reglage?.questionnaire_actif ?? true} />
            {intro && <TexteAccueil texte={intro.questionnaire_intro ?? ""} />}
          </Carte>
          {parSection(questions ?? []).map(({ section, questions: liste }) => (
            <section key={section} className="flex flex-col gap-3">
              <h2 className="font-titre text-[22px] font-bold">{section || "Sans section"}</h2>
              {liste.map((q) => (
                <Carte key={q.id} className={q.actif ? "" : "opacity-70"}>
                  <EditeurQuestion question={q} />
                </Carte>
              ))}
            </section>
          ))}
          <Carte className="flex flex-col gap-3 border-2 border-caramel/40">
            <h2 className="font-titre text-xl font-bold">Ajouter une question</h2>
            <EditeurQuestion ordreSuivant={ordreSuivant} />
          </Carte>
        </>
      )}
    </div>
  );
}
