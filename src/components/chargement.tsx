/** Écran d'attente affiché tout de suite pendant le chargement d'une page (au lieu d'un écran figé). */
export function Chargement({ texte = "Un instant…", plein = false }: { texte?: string; plein?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        plein
          ? "mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-4 px-5"
          : "flex min-h-[50dvh] w-full flex-col items-center justify-center gap-4 px-5"
      }
    >
      <span className="size-10 animate-spin rounded-full border-4 border-sable border-t-accent" aria-hidden />
      <p className="text-[15px] text-texte-2">{texte}</p>
    </div>
  );
}
