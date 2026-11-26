import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { Carte } from "@/components/ui";
import { exigerAbonnee } from "@/lib/auth";
import { besoinsQuotidiens, formaterKcal, metabolismeDeBase, type DonneesMetabolisme } from "@/lib/metabolisme";
import { FormulaireMetabolisme } from "./formulaire";

export const metadata: Metadata = { title: "Mon métabolisme" };

export default async function PageMetabolisme() {
  const { supabase, profil } = await exigerAbonnee();
  const { data } = await supabase.from("metabolisme").select("annee_naissance, taille_cm, poids_kg, activite").eq("cliente_id", profil.id).maybeSingle<DonneesMetabolisme>();
  const donnees = data ? { ...data, taille_cm: Number(data.taille_cm), poids_kg: Number(data.poids_kg) } : null;
  const annee = new Date().getFullYear();
  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/espace" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[30px] font-bold leading-tight">Mon métabolisme</h1>
        <p className="text-[15px] text-texte-2">Pour comprendre ce dont ton corps a besoin, simplement.</p>
      </div>

      {donnees && (
        <div className="flex flex-col gap-3">
          <Carte className="flex flex-col gap-1 bg-chocolat text-creme">
            <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-clair">Ton métabolisme de base</span>
            <span className="font-titre text-[36px] font-bold leading-none">{formaterKcal(metabolismeDeBase(donnees, annee))}</span>
            <span className="text-[14px] text-texte-clair">
              L’énergie que ton corps utilise au repos, chaque jour, juste pour fonctionner : respirer, faire battre ton cœur, garder ta chaleur.
            </span>
          </Carte>
          <Carte className="flex flex-col gap-1">
            <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">Tes besoins du quotidien</span>
            <span className="font-titre text-[32px] font-bold leading-none">environ {formaterKcal(besoinsQuotidiens(donnees, annee))}</span>
            <span className="text-[14px] text-texte-2">Avec ton niveau d’activité. C’est un ordre de grandeur, qui varie d’un jour à l’autre.</span>
          </Carte>
          <div className="rounded-carte bg-accent-pale/60 p-4 text-[15px] leading-relaxed">
            <p className="font-medium">Ce que j’aimerais que tu retiennes 💛</p>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
              <li>Ton corps a besoin d’énergie, même au repos : manger trop peu le met en mode « économie » et te fatigue.</li>
              <li>Ce chiffre est un repère, pas un objectif. Je ne te demande pas de compter : mes recettes et la méthode de l’assiette t’aident à manger à ta faim.</li>
              <li>Bouger, marcher, prendre des escaliers… tout ça augmente tes besoins. C’est une bonne nouvelle.</li>
            </ul>
            <p className="mt-2 text-[13px] text-texte-2">Un repère général, qui ne remplace pas l’avis d’un professionnel de santé.</p>
          </div>
        </div>
      )}

      <Carte>
        <h2 className="mb-3 font-titre text-xl font-bold">{donnees ? "Mettre à jour" : "Faisons le calcul"}</h2>
        <FormulaireMetabolisme initial={donnees} />
        <p className="mt-3 text-[12.5px] text-texte-2">Ces informations restent privées : moi-même, je ne les vois pas.</p>
      </Carte>
    </div>
  );
}
