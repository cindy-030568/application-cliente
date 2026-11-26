import type { Metadata } from "next";
import Link from "next/link";
import { Logo, Message } from "@/components/ui";
import { textePrix } from "@/lib/abonnement";
import { lireReglagesAbonnement } from "@/lib/abonnees-serveur";
import { lireSession } from "@/lib/auth";
import { lirePrix } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { FormulaireAbonnement, type OffreFormule } from "./formulaire";

export const metadata: Metadata = { title: "S’abonner" };

const CONTENU = [
  { emoji: "🔥", titre: "Mon métabolisme", texte: "Tes besoins du quotidien, expliqués simplement. Un repère, pas un compteur de calories." },
  { emoji: "🍽️", titre: "Mes recettes", texte: "Gourmandes et simples, avec des portions faciles à la méthode de l’assiette. Planning et liste de courses." },
  { emoji: "⚡", titre: "Séances express", texte: "5 à 30 minutes, à la maison, guidées pas à pas." },
  { emoji: "🏆", titre: "Les défis du mois", texte: "On avance ensemble, à ton rythme, sans culpabilité." },
  { emoji: "🎧", titre: "Fiches et audios", texte: "Mes conseils à lire ou à écouter, quand tu veux." },
  { emoji: "💬", titre: "La communauté", texte: "Un espace d’échange bienveillant, où je suis présente." },
];

export default async function PageAbonnement({ searchParams }: { searchParams: Promise<{ annule?: string }> }) {
  const { annule } = await searchParams;
  let reglages = null;
  try {
    reglages = await lireReglagesAbonnement(createAdminClient());
  } catch {
    reglages = null;
  }
  const session = await lireSession();
  const coach = session?.profil.role === "coach";
  // Une ancienne abonnée connectée qui revient : email prérempli.
  let ancienne: { email: string; prenom: string } | null = null;
  if (session && !coach) {
    const { data } = await session.supabase.from("clientes").select("formule, statut").eq("id", session.profil.id).maybeSingle<{ formule: string; statut: string }>();
    if (data?.formule === "abonnement" && data.statut === "fermee") ancienne = { email: session.profil.email, prenom: session.profil.prenom };
    else if (data) {
      return (
        <Cadre>
          <h1 className="font-titre text-[30px] font-bold leading-tight">Tu as déjà ton espace 💛</h1>
          <p className="text-texte-2">Ton compte est actif : retrouve tout dans ton application.</p>
          <Link href="/" className="font-medium underline underline-offset-4">
            Aller à mon espace
          </Link>
        </Cadre>
      );
    }
  }
  const [mensuel, annuel] = await Promise.all([lirePrix(reglages?.prixMensuel ?? null), lirePrix(reglages?.prixAnnuel ?? null)]);
  const formules: OffreFormule[] = [
    ...(mensuel?.active && textePrix(mensuel) ? [{ code: "mensuel" as const, titre: "Au mois", prix: textePrix(mensuel)! }] : []),
    ...(annuel?.active && textePrix(annuel) ? [{ code: "annuel" as const, titre: "À l’année", prix: textePrix(annuel)! }] : []),
  ];
  const ouverte = Boolean(reglages?.actif) && formules.length > 0;

  return (
    <Cadre>
      {coach && !reglages?.actif && <Message ton="info">Aperçu coach : la page n’est pas encore ouverte (Réglages → Abonnement).</Message>}
      <div className="flex flex-col gap-3">
        <h1 className="font-titre text-[32px] font-bold leading-tight">{reglages?.titre ?? "Mon appli bien-être"}</h1>
        {reglages?.texte && <p className="whitespace-pre-line text-[16px] text-texte-2">{reglages.texte}</p>}
      </div>
      <ul className="flex flex-col gap-3">
        {CONTENU.map((c) => (
          <li key={c.titre} className="flex items-start gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce">
            <span aria-hidden className="text-[22px] leading-7">
              {c.emoji}
            </span>
            <span className="flex flex-col">
              <span className="font-medium">{c.titre}</span>
              <span className="text-[14px] text-texte-2">{c.texte}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[14.5px]">Et chaque mois : un thème, un rendez-vous en visio avec moi, et du nouveau dans ton espace ✨</p>
      {annule && <Message ton="info">Le paiement a été annulé : rien n’a été prélevé. Tu peux reprendre quand tu veux.</Message>}
      {ouverte || (coach && formules.length > 0) ? (
        <section aria-label="M’abonner" className="flex flex-col gap-4">
          <h2 className="font-titre text-[24px] font-bold">{ancienne ? `Contente de te revoir, ${ancienne.prenom} 💛` : "Je m’abonne"}</h2>
          <FormulaireAbonnement formules={formules} lienCgv={reglages?.lienCgv ?? null} emailConnu={ancienne?.email} prenomConnu={ancienne?.prenom} />
        </section>
      ) : (
        <Message ton="info">Les inscriptions ouvrent très bientôt. Reviens vite 💛</Message>
      )}
      {reglages?.lienCoaching && (
        <a href={reglages.lienCoaching} target="_blank" rel="noopener noreferrer" className="rounded-carte bg-chocolat p-5 text-creme">
          <span className="block text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-clair">Envie d’un accompagnement personnalisé ?</span>
          <span className="mt-1 block font-titre text-[20px] font-bold">Découvrir mon coaching</span>
          <span className="mt-1 block text-[14px] text-texte-clair">Un plan fait pour toi, mes conseils et mon suivi, et l’appli à vie.</span>
        </a>
      )}
      {!session && (
        <p className="text-center text-[14px] text-texte-2">
          Déjà abonnée ?{" "}
          <Link href="/connexion" className="font-medium text-chocolat underline underline-offset-4">
            Me connecter
          </Link>
        </p>
      )}
    </Cadre>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="pt-encoche mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pb-12 apparition">
      <Logo className="mt-4 text-xl" />
      {children}
    </main>
  );
}
