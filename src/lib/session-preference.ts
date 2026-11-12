/**
 * Préférence « Rester connectée » : si elle vaut "0", les cookies de session
 * n'ont pas de date d'expiration et disparaissent à la fermeture du navigateur.
 */
export const COOKIE_RESTER = "fitw_rester";

type OptionsCookie = { maxAge?: number; expires?: Date | number | string; [cle: string]: unknown };

export function appliquerPreference<T extends OptionsCookie | undefined>(options: T, resterConnectee: boolean): T {
  if (resterConnectee || !options) return options;
  const { maxAge: _m, expires: _e, ...reste } = options;
  void _m;
  void _e;
  return reste as T;
}

export const OPTIONS_COOKIE_PREFERENCE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 400 * 24 * 60 * 60,
};
