function requis(nom: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(`Variable d'environnement manquante : ${nom} (voir .env.example)`);
  }
  return valeur;
}

export const SUPABASE_URL = () =>
  requis("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = () =>
  requis(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
/**
 * Adresse publique de l'app, utilisée dans les liens de connexion.
 * Ordre : variable SITE_URL (ou NEXT_PUBLIC_SITE_URL) si renseignée,
 * sinon l'adresse de production fournie automatiquement par Vercel,
 * sinon le serveur local.
 */
export const SITE_URL = () => {
  const explicite = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = explicite || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.trim().replace(/\/+$/, "");
};
