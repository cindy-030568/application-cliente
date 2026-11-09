import type { Metadata } from "next";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { LienBouton, Logo, Message } from "@/components/ui";
import { lireSession } from "@/lib/auth";
import { confirmerConnexion } from "./actions";

export const metadata: Metadata = { title: "Connexion" };

const TYPES_AUTORISES = ["email", "magiclink"] as const;

/**
 * Page d'arrivée du lien reçu par email. La connexion ne se fait qu'au clic
 * sur le bouton : les antivirus des messageries (Outlook, Hotmail…) ouvrent
 * les liens à l'avance, ce qui « consommerait » le lien sinon.
 */
export default async function PageConfirmation({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; erreur?: string }>;
}) {
  const { token_hash, type, erreur } = await searchParams;
  const session = await lireSession();
  const coachConnectee = session?.profil.role === "coach";
  const valide =
    typeof token_hash === "string" &&
    token_hash.length > 10 &&
    (TYPES_AUTORISES as readonly string[]).includes(type ?? "");

  return (
    <main className="pt-encoche flex min-h-dvh items-center justify-center px-6 pb-10">
      <div className="flex w-full max-w-sm flex-col gap-8 apparition">
        <Logo className="text-2xl" />
        {valide && !erreur ? (
          <form action={confirmerConnexion} className="flex flex-col gap-5">
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type} />
            <h1 className="font-titre text-[30px] font-bold leading-tight">Bienvenue 💛</h1>
            {coachConnectee ? (
              <>
                <Message ton="erreur">
                  Attention {session?.profil.prenom} : tu es connectée à ton espace coach dans ce
                  navigateur. Si tu continues, il sera remplacé par l’espace de la cliente (tu
                  devras te reconnecter ensuite).
                </Message>
                <p className="text-[14px] text-texte-2">
                  Pour tester l’espace d’une cliente, colle plutôt ce lien dans une{" "}
                  <strong className="font-medium text-chocolat">fenêtre de navigation privée</strong>{" "}
                  ou sur ton téléphone.
                </p>
                <LienBouton href="/coach" pleineLargeur>
                  Revenir à mon espace coach
                </LienBouton>
                <BoutonEnvoi variante="contour" pleineLargeur enCours="Connexion…">
                  Continuer quand même
                </BoutonEnvoi>
              </>
            ) : (
              <>
                {session && (
                  <Message ton="info">
                    Tu es déjà connectée en tant que {session.profil.prenom || session.profil.email}.
                    Continuer ouvrira l’espace lié à ce lien.
                  </Message>
                )}
                <p className="text-texte-2">Touche le bouton pour ouvrir ton espace.</p>
                <BoutonEnvoi pleineLargeur enCours="Connexion…">
                  Me connecter
                </BoutonEnvoi>
              </>
            )}
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <h1 className="font-titre text-[30px] font-bold leading-tight">Lien expiré</h1>
            <Message ton="erreur">
              Ce lien de connexion n’est plus valable (il ne sert qu’une fois et expire au bout
              d’une heure). Demande simplement un nouveau code.
            </Message>
            <a href="/connexion" className="text-center underline underline-offset-4">
              Revenir à la connexion
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
