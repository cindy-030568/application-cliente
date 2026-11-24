import { lireFiche, type Morceau } from "@/lib/fiche";

function Texte({ morceaux }: { morceaux: Morceau[] }) {
  return (
    <>
      {morceaux.map((m, i) => (m.gras ? <strong key={i} className="font-semibold text-chocolat">{m.texte}</strong> : <span key={i}>{m.texte}</span>))}
    </>
  );
}

/** Affiche une fiche écrite dans l'appli (intertitres, listes, gras). Jamais de HTML interprété. */
export function Fiche({ contenu }: { contenu: string }) {
  return (
    <div className="flex flex-col gap-3 text-[16px] leading-relaxed text-chocolat">
      {lireFiche(contenu).map((b, i) =>
        b.type === "titre" ? (
          <h2 key={i} className="pt-3 font-titre text-[21px] font-bold leading-tight text-chocolat">
            <Texte morceaux={b.morceaux} />
          </h2>
        ) : b.type === "liste" ? (
          <ul key={i} className="flex flex-col gap-2 pl-1">
            {b.elements.map((e, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-accent" />
                <span>
                  <Texte morceaux={e} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Texte morceaux={b.morceaux} />
          </p>
        ),
      )}
    </div>
  );
}
