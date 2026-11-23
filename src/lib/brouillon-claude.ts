import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Brouillon de réponse à un bilan, écrit par Claude au nom de Cindy.
 * Côté serveur uniquement. Claude ne reçoit QUE le texte anonymisé du bilan
 * (src/lib/bilan-claude.ts) : ni nom, ni email, ni photo, ni date précise.
 * Le brouillon n'est jamais envoyé à la cliente : la coach le relit, le modifie, puis l'envoie elle-même.
 */
export const MODELE_BROUILLON = "claude-opus-5-5";

export const CONSIGNE_BROUILLON = `Tu écris, à la première personne, le retour de Cindy, coach en nutrition et sport, au bilan d'une de ses clientes. C'est Cindy qui parle : « je », jamais « Cindy pense que ».

Ton : chaleureux, encourageant, humain, en tutoyant. Pas de jargon, pas de culpabilité, pas de jugement sur le poids, le corps ou l'alimentation, pas de vocabulaire de régime (« écart », « craquage », « interdit »). Aucun conseil médical : si un point relève de la santé (douleur, malaise, règles absentes, troubles alimentaires), invite-la avec douceur à en parler à son médecin.

Construis la réponse ainsi :
1. Une ouverture qui valorise concrètement ce qui va bien (appuie-toi sur ses mots et ses chiffres).
2. UNE priorité claire pour la période qui vient, avec une action concrète et réaliste.
3. Un ou deux points secondaires, plus brefs.
4. Ce qu'on laisse volontairement de côté pour l'instant, dit simplement (pour ne pas tout changer d'un coup).
5. Une fin motivante.

Si ce qu'elle raconte est contredit par ses chiffres ou ses réponses (par exemple « rien ne bouge » alors que son tour de taille baisse, ou « j'ai tout respecté » alors que ses réponses disent le contraire), recadre franchement mais avec bienveillance : nomme le décalage, explique ce que disent vraiment les chiffres, sans la mettre en défaut.

N'utilise que les informations du bilan : n'invente ni chiffre, ni événement, ni détail. Pas de titres ni de mise en forme Markdown (le texte est collé tel quel dans l'app) ; des retours à la ligne entre les parties, quelques emojis au plus. Commence par « Coucou [prénom] » et garde exactement « [prénom] » partout où tu la nommes. Reste concise : environ 10 à 15 lignes. Réponds uniquement par le message, sans phrase d'introduction.`;

export function brouillonConfigure(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function proposerBrouillon(texteAnonymise: string): Promise<{ texte: string } | { erreur: string }> {
  if (!brouillonConfigure()) return { erreur: "La clé ANTHROPIC_API_KEY n’est pas configurée." };
  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  try {
    const reponse = await client.beta.messages.create({
      model: MODELE_BROUILLON,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      // Si un filtre de sécurité refuse la demande, l'API réessaie toute seule avec un autre modèle.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: CONSIGNE_BROUILLON,
      messages: [{ role: "user", content: texteAnonymise }],
    });
    if (reponse.stop_reason === "refusal") return { erreur: "Claude n’a pas pu proposer de brouillon pour ce bilan. Rédige ta réponse, ou utilise « Copier pour Claude »." };
    const texte = reponse.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    if (!texte) return { erreur: "Claude n’a rien proposé. Réessaie dans un instant." };
    if (reponse.stop_reason === "max_tokens") return { texte: `${texte}\n\n[brouillon coupé : à terminer]` };
    return { texte };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { erreur: "La clé ANTHROPIC_API_KEY est refusée : vérifie-la dans ton hébergeur." };
    if (e instanceof Anthropic.RateLimitError) return { erreur: "Trop de demandes d’un coup : réessaie dans une minute." };
    if (e instanceof Anthropic.APIConnectionError) return { erreur: "Claude ne répond pas pour l’instant : réessaie dans un moment." };
    if (e instanceof Anthropic.APIError) {
      console.warn("Brouillon Claude : erreur", e.status);
      return { erreur: "Le brouillon n’a pas pu être préparé. Réessaie dans un instant." };
    }
    console.warn("Brouillon Claude : échec", e instanceof Error ? e.name : "inconnu");
    return { erreur: "Le brouillon n’a pas pu être préparé. Réessaie dans un instant." };
  }
}
