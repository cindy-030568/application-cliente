import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { questionsPourCliente } from "@/lib/questionnaire";
import { lireSuiviSport } from "@/lib/paiements-serveur";
import { chargerQuestions } from "@/lib/questionnaire-serveur";
import { FormulaireQuestionnaire } from "./formulaire";

export const metadata: Metadata = { title: "Faisons connaissance" };

export default async function PageQuestionnaire() {
  const { supabase, profil } = await exigerCliente(true, true, false);
  const { data: aRemplir } = await supabase.rpc("questionnaire_a_remplir");
  if (aRemplir !== true) redirect("/");
  const [questions, { data: categories }, sport, { data: reglage }] = await Promise.all([
    chargerQuestions(supabase),
    supabase.from("categories_aliment").select("id, nom").order("ordre"),
    lireSuiviSport(supabase, profil.id),
    supabase.from("reglages").select("questionnaire_intro").maybeSingle<{ questionnaire_intro: string | null }>(),
  ]);
  const intro =
    reglage?.questionnaire_intro?.trim() ||
    "Quelques questions pour que je prépare ton accompagnement au plus près de ta vie. Tes réponses restent entre toi et moi.";
  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-6 pb-12 apparition">
      <Logo className="mt-4 text-xl" />
      <div className="flex flex-col gap-2">
        <h1 className="font-titre text-[30px] font-bold leading-tight">Faisons connaissance, {profil.prenom} ✨</h1>
        <p className="whitespace-pre-line text-texte-2">{intro}</p>
      </div>
      <FormulaireQuestionnaire questions={questionsPourCliente(questions, sport !== false)} categories={(categories ?? []) as { id: string; nom: string }[]} />
    </main>
  );
}
