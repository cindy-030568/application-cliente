import type { Metadata } from "next";
import Link from "next/link";
import { IconeRetour } from "@/components/icones";
import { FilCommunaute } from "@/components/communaute/fil";
import { exigerCliente } from "@/lib/auth";
import { chargerMessages, lireEtatCommunaute, lireMembre } from "@/lib/communaute-serveur";
import { Adhesion, ReglagesMembre } from "./reglages-membre";

export const metadata: Metadata = { title: "Communauté" };

export default async function PageCommunaute() {
  const { supabase, profil, reglages } = await exigerCliente();
  const etat = await lireEtatCommunaute(supabase);
  const membre = etat?.ouverte ? await lireMembre(supabase, profil.id) : null;

  let contenu: React.ReactNode;
  if (!etat?.ouverte) {
    contenu = (
      <Encadre emoji="🌱" titre="Bientôt ouverte">
        La communauté n’est pas ouverte pour le moment. Cindy te préviendra dès qu’elle le sera.
      </Encadre>
    );
  } else if (!membre) {
    contenu = <Adhesion charte={etat.charte} lienPolitique={reglages.lien_politique} />;
  } else if (membre.statut === "exclue") {
    contenu = (
      <Encadre emoji="🔒" titre="Tu n’as plus accès à la communauté">
        Cindy a retiré ton accès. Si tu veux en parler, écris-lui directement : ton accompagnement, lui, continue normalement.
      </Encadre>
    );
  } else {
    await supabase.rpc("reglages_membre", { p_vu: true });
    const [{ messages, encore }, { count: appareils }] = await Promise.all([
      chargerMessages(supabase, profil.id),
      supabase.from("abonnements_push").select("id", { count: "exact", head: true }).eq("cliente_id", profil.id),
    ]);
    contenu = (
      <>
        <FilCommunaute moi={profil.id} initial={{ messages, encore, maintenant: new Date().toISOString() }} />
        <ReglagesMembre notifications={membre.notifications} appareil={(appareils ?? 0) > 0} charte={etat.charte} />
      </>
    );
  }

  return (
    <div className="pt-encoche flex flex-col gap-5 px-5 pb-6">
      <Link href="/" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-titre text-[30px] font-bold leading-tight">La communauté</h1>
        <p className="font-main text-[22px] leading-tight text-caramel-texte">Entre clientes, on se motive 💛</p>
      </div>
      {contenu}
    </div>
  );
}

function Encadre({ emoji, titre, children }: { emoji: string; titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-bloc border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-10 text-center apparition">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <p className="font-titre text-xl font-bold">{titre}</p>
      <p className="max-w-xs text-[15px] text-texte-2">{children}</p>
    </div>
  );
}
