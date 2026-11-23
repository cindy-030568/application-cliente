import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import type { QuestionArrivee } from "@/lib/questionnaire";
import { FormulaireQuestionnaire } from "./formulaire";

export const metadata: Metadata = { title: "Faisons connaissance" };

export default async function PageQuestionnaire() {
  const { supabase, profil } = await exigerCliente(true, true, false);
  const { data: aRemplir } = await supabase.rpc("questionnaire_a_remplir");
  if (aRemplir !== true) redirect("/");
  const [{ data: questions }, { data: categories }] = await Promise.all([
    supabase
      .from("questions_arrivee")
      .select("id, ordre, section, libelle, aide, type, options, obligatoire, actif")
      .eq("actif", true)
      .order("ordre")
      .returns<QuestionArrivee[]>(),
    supabase.from("categories_aliment").select("id, nom").order("ordre"),
  ]);
  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-6 pb-12 apparition">
      <Logo className="mt-4 text-xl" />
      <div className="flex flex-col gap-2">
        <h1 className="font-titre text-[30px] font-bold leading-tight">Faisons connaissance, {profil.prenom} ✨</h1>
        <p className="text-texte-2">
          Quelques questions pour que je prépare ton accompagnement au plus près de ta vie. Compte 5 minutes. Tes réponses restent entre toi et moi.
        </p>
      </div>
      <FormulaireQuestionnaire questions={questions ?? []} categories={(categories ?? []) as { id: string; nom: string }[]} />
    </main>
  );
}
