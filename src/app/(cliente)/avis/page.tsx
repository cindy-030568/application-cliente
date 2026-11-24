import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { exigerCliente } from "@/lib/auth";
import type { NomAffiche } from "@/lib/parrainage";
import { AvisEnvoye, FormulaireAvis } from "./formulaire";

export const metadata: Metadata = { title: "Mon témoignage" };

export default async function PageAvis({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const { supabase, profil } = await exigerCliente();
  const de = (await searchParams).de;
  const contexte = de === "victoire" || de === "fin" ? de : "libre";
  const { data: mesAvis, error } = await supabase
    .from("avis")
    .select("id, texte, publiable, nom_affiche, cree_le")
    .eq("cliente_id", profil.id)
    .order("cree_le", { ascending: false })
    .returns<{ id: string; texte: string; publiable: boolean; nom_affiche: NomAffiche | null; cree_le: string }[]>();
  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-8">
      <Link href={contexte === "fin" ? "/bilan-de-fin" : "/"} className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> {contexte === "fin" ? "Mon bilan de fin" : "Accueil"}
      </Link>
      <div>
        <h1 className="font-titre text-[30px] font-bold leading-tight">Laisser un témoignage</h1>
        <p className="text-[15px] text-texte-2">Quelques mots sur ton accompagnement : ça touche toujours Cindy, et ça peut aider d’autres femmes à se lancer 💛</p>
      </div>
      {error ? (
        <p className="rounded-carte bg-blanc-casse p-5 text-[15px] text-texte-2 shadow-douce">Cette page arrive très bientôt dans ton appli 💛</p>
      ) : (
        <>
          <FormulaireAvis prenom={profil.prenom} contexte={contexte} />
          {(mesAvis ?? []).length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-titre text-[20px] font-bold">Mes témoignages</h2>
              <ul className="flex flex-col gap-3">
                {(mesAvis ?? []).map((a) => (
                  <AvisEnvoye key={a.id} a={a} prenom={profil.prenom} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
