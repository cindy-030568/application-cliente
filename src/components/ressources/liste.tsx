import Link from "next/link";
import type { ReactNode } from "react";
import { IconeExterne, IconeFleche, IconeRecherche, IconeRessources } from "@/components/icones";
import { Surtitre, cx } from "@/components/ui";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dureeCourte, extrait, filtrerRessources, horloge, lireFiltresRessources, positionDeReprise } from "@/lib/ressources";
import { lireCategories, lireEcoutes, lireFavorisRessources, lireRessourcesCompletes, type Ecoute, type RessourceComplete } from "@/lib/ressources-serveur";
import { BientotDisponible, EnTete } from "@/app/(cliente)/composants";
import { CoeurRessource } from "@/app/(cliente)/ressources/coeur";


export type ParamsRessources = { q?: string; categorie?: string; ecouter?: string; favoris?: string };

/** Mes ressources (clientes coachées : /ressources ; abonnées : /espace/ressources). La RLS choisit ce qui est visible. */
export async function ListeRessources({ supabase, profilId, params, base, lienProfil }: { supabase: SupabaseClient; profilId: string; params: ParamsRessources; base: string; lienProfil?: string }) {
  const profil = { id: profilId };
  // La RLS ne renvoie que les ressources publiées « pour toutes » et celles choisies pour elle :
  // la recherche ne peut donc jamais trouver une ressource qui n'est pas pour elle.
  const [ressources, categories, favoris, ecoutes] = await Promise.all([
    lireRessourcesCompletes(supabase),
    lireCategories(supabase),
    lireFavorisRessources(supabase, profil.id),
    lireEcoutes(supabase, profil.id),
  ]);
  const f = lireFiltresRessources(params);
  const filtre = Boolean(f.q || f.categorie || f.ecouter || f.favoris);
  const resultats = filtrerRessources(ressources, f, favoris);
  const avecAudio = ressources.some((r) => r.audio_path);
  const categoriesUtilisees = [...categories, { id: "autres", nom: "Autres", ordre: 999 }].filter((c) =>
    ressources.some((r) => (c.id === "autres" ? r.categorie_id === null : r.categorie_id === c.id)),
  );
  const lien = (o: Partial<Record<keyof ParamsRessources, string | null>>) => {
    const u = new URLSearchParams();
    const v = { q: f.q || null, categorie: f.categorie, ecouter: f.ecouter ? "1" : null, favoris: f.favoris ? "1" : null, ...o };
    for (const [k, x] of Object.entries(v)) if (x) u.set(k, x);
    const q = u.toString();
    return `${base}${q ? `?${q}` : ""}`;
  };
  const groupes = [...categories, { id: null, nom: "Autres", ordre: 999 }]
    .map((c) => ({ ...c, items: ressources.filter((r) => r.categorie_id === c.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <EnTete titre="Mes ressources" sousTitre="Guides, fiches pratiques, audios… tout ce que je prépare pour toi 💛" profil={lienProfil} />
      {ressources.length === 0 ? (
        <BientotDisponible icone={<IconeRessources className="size-6" />} titre="Bientôt ici" texte="J’ajouterai ici mes guides et fiches pratiques." />
      ) : (
        <div className="flex flex-col gap-5 px-5 pb-6 pt-3">
          <form action={base} role="search" className="flex items-center gap-2 rounded-full bg-blanc-casse py-1 pl-4 pr-1 shadow-douce focus-within:ring-2 focus-within:ring-accent-pale">
            <IconeRecherche className="size-5 shrink-0 text-texte-2" />
            <input
              key={f.q}
              type="search"
              name="q"
              defaultValue={f.q}
              placeholder="Chercher un mot…"
              aria-label="Chercher dans mes ressources"
              enterKeyHint="search"
              className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-texte-2/70"
            />
            {f.categorie && <input type="hidden" name="categorie" value={f.categorie} />}
            {f.ecouter && <input type="hidden" name="ecouter" value="1" />}
            {f.favoris && <input type="hidden" name="favoris" value="1" />}
            <button type="submit" className="min-h-10 shrink-0 rounded-full bg-chocolat px-4 text-[14.5px] font-medium text-creme">
              Chercher
            </button>
          </form>

          <nav aria-label="Filtres" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            <Puce href={base} actif={!filtre}>
              Toutes
            </Puce>
            {avecAudio && (
              <Puce href={lien({ ecouter: f.ecouter ? null : "1" })} actif={f.ecouter}>
                🎧 À écouter
              </Puce>
            )}
            <Puce href={lien({ favoris: f.favoris ? null : "1" })} actif={f.favoris}>
              ♥ Mes favoris
            </Puce>
            {categoriesUtilisees.map((c) => (
              <Puce key={c.id} href={lien({ categorie: f.categorie === c.id ? null : c.id })} actif={f.categorie === c.id}>
                {c.nom}
              </Puce>
            ))}
          </nav>

          {filtre ? (
            <section aria-live="polite" className="flex flex-col gap-3">
              <p className="text-[14px] text-texte-2">
                {resultats.length === 0
                  ? f.favoris && !f.q
                    ? "Pas encore de favoris : touche le cœur d’une ressource pour la retrouver ici."
                    : f.q
                      ? `Rien trouvé pour « ${f.q} ». Essaie un autre mot.`
                      : "Rien ici pour l’instant."
                  : `${resultats.length} ressource${resultats.length > 1 ? "s" : ""}${f.q ? ` pour « ${f.q} »` : ""}`}
              </p>
              <ul className="flex flex-col gap-3">
                {resultats.map((r) => (
                  <li key={r.id}>
                    <CarteRessource base={base} r={r} favori={favoris.has(r.id)} ecoute={ecoutes.get(r.id)} extraitTexte={f.q ? extrait(r.contenu, f.q) : null} />
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            groupes.map((g) => (
              <section key={g.id ?? "autres"} className="flex flex-col gap-3">
                <Surtitre>{g.nom}</Surtitre>
                <ul className="flex flex-col gap-3">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <CarteRessource base={base} r={r} favori={favoris.has(r.id)} ecoute={ecoutes.get(r.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
    </>
  );
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cx("inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[14px] whitespace-nowrap", actif ? "bg-chocolat text-creme" : "bg-blanc-casse shadow-douce")}
    >
      {children}
    </Link>
  );
}

function CarteRessource({ base, r, favori, ecoute, extraitTexte }: { base: string; r: RessourceComplete; favori: boolean; ecoute?: Ecoute; extraitTexte?: string | null }) {
  // Un simple lien (sans fiche ni audio) s'ouvre directement ; le reste a sa page.
  const externe = Boolean(r.url) && !r.contenu && !r.audio_path;
  const reprise = r.audio_path ? positionDeReprise(ecoute ?? null, r.audio_duree) : 0;
  const infoAudio = r.audio_path
    ? [
        r.contenu ? "Fiche + audio" : "Audio",
        dureeCourte(r.audio_duree),
        ecoute?.terminee ? "écoutée ✓" : reprise > 0 ? `reprendre à ${horloge(reprise)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const corps = (
    <>
      <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-full", r.audio_path ? "bg-sable text-[19px]" : "bg-accent-pale")} aria-hidden>
        {r.audio_path ? "🎧" : <IconeRessources className="size-5" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{r.titre}</span>
        {r.description && <span className="text-[14px] leading-snug text-texte-2">{r.description}</span>}
        {infoAudio && <span className="mt-0.5 text-[13px] font-medium text-caramel-texte">{infoAudio}</span>}
        {extraitTexte && <span className="mt-1 text-[13.5px] italic leading-snug text-texte-2">{extraitTexte}</span>}
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-2 rounded-carte bg-blanc-casse p-4 pr-3 shadow-douce">
      {externe ? (
        <a href={r.url!} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-4 transition-transform active:scale-[0.98]">
          {corps}
          <IconeExterne className="size-5 shrink-0 text-texte-2" />
        </a>
      ) : (
        <Link href={`${base}/${r.id}`} className="flex min-w-0 flex-1 items-center gap-4 transition-transform active:scale-[0.98]">
          {corps}
          <IconeFleche className="size-5 shrink-0 text-texte-2" />
        </Link>
      )}
      <CoeurRessource id={r.id} favori={favori} titre={r.titre} />
    </div>
  );
}
