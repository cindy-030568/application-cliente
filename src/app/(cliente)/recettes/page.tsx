import type { Metadata } from "next";
import Link from "next/link";
import { IconeCoeur, IconeHorloge, IconePanier, IconeRecettes, IconeRecherche } from "@/components/icones";
import { Etiquette, cx } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { chargerTags, urlPhotoRecette } from "@/lib/recettes";
import { recettesAdapteesCliente, recettesInspiration, type RecettePourCliente } from "@/lib/recettes-adaptees";
import { normaliser } from "@/lib/texte";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Recettes" };

type Vue = { type: "repas"; index: number } | { type: "toutes" } | { type: "favoris" };

function lireVue(param: string | undefined, nbRepas: number): Vue {
  if (param === "toutes") return { type: "toutes" };
  if (param === "favoris") return { type: "favoris" };
  const i = Number(param ?? 0);
  return Number.isInteger(i) && i >= 0 && i < nbRepas ? { type: "repas", index: i } : { type: "repas", index: 0 };
}

export default async function PageRecettes({
  searchParams,
}: {
  searchParams: Promise<{ repas?: string; tag?: string; q?: string }>;
}) {
  const { supabase, profil, reglages } = await exigerCliente();
  const params = await searchParams;
  const [repas, tags, { data: favoris }, { count: nbCourses }] = await Promise.all([
    recettesAdapteesCliente(supabase, profil.id, reglages),
    chargerTags(supabase),
    supabase.from("favoris").select("recette_id").eq("cliente_id", profil.id),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("coche", false),
  ]);

  const lienCourses = (
    <Link
      href="/recettes/courses"
      className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-blanc-casse px-4 text-[14.5px] font-medium shadow-douce"
    >
      <IconePanier className="size-5" /> Ma liste de courses
      {!!nbCourses && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-white">{nbCourses}</span>
      )}
    </Link>
  );

  if (repas.length === 0) {
    return (
      <>
        <EnTete titre="Des recettes plaisir, adaptées à toi" />
        <BientotDisponible
          icone={<IconeRecettes className="size-6" />}
          titre="Bientôt prêtes pour toi"
          texte="Cindy prépare tes repères pour chaque repas. Dès que c’est fait, tes recettes apparaîtront ici avec tes quantités."
        />
      </>
    );
  }

  const vue = lireVue(params.repas, repas.length);
  const idsFavoris = new Set((favoris ?? []).map((f) => f.recette_id as string));
  const toutes = recettesInspiration(repas);

  let liste: RecettePourCliente[];
  if (vue.type === "repas") {
    const r = repas[vue.index];
    liste = [
      ...r.compatibles.map((a) => ({ recette: a.recette.source, repas: [vue.index], approximative: false })),
      ...r.approximatives.map((a) => ({ recette: a.recette.source, repas: [vue.index], approximative: true })),
    ];
  } else if (vue.type === "favoris") {
    liste = toutes.filter((x) => idsFavoris.has(x.recette.id));
  } else {
    liste = toutes;
  }

  const tagActif = tags.find((t) => t.id === params.tag)?.id;
  const q = (params.q ?? "").trim().slice(0, 60);
  const filtrees = liste.filter(
    (x) =>
      (!tagActif || x.recette.tags.includes(tagActif)) &&
      (!q || normaliser(x.recette.titre).includes(normaliser(q))),
  );

  const valeurVue = vue.type === "repas" ? String(vue.index) : vue.type;
  const lien = (o: { repas?: string; tag?: string | null }) => {
    const u = new URLSearchParams();
    u.set("repas", o.repas ?? valeurVue);
    const t = o.tag === undefined ? tagActif : o.tag;
    if (t) u.set("tag", t);
    if (q) u.set("q", q);
    return `/recettes?${u}`;
  };

  return (
    <>
      <EnTete titre="Des recettes plaisir, adaptées à toi" sousTitre="Les quantités sont déjà calculées pour toi." />
      <div className="flex flex-col gap-5 px-5 pb-6 pt-3">
        {lienCourses}

        <section className="flex flex-col gap-2.5" aria-labelledby="titre-repas">
          <h2 id="titre-repas" className="font-titre text-lg font-bold">
            Quel repas veux-tu remplacer ?
          </h2>
          <nav className="defilement -mx-5 flex gap-2.5 overflow-x-auto px-5 py-0.5" aria-label="Repas">
            {repas.map((r, i) => (
              <Puce key={i} href={lien({ repas: String(i) })} actif={vue.type === "repas" && vue.index === i}>
                {r.repas.libelle}
              </Puce>
            ))}
            <Puce href={lien({ repas: "toutes" })} actif={vue.type === "toutes"}>
              Toutes
            </Puce>
            <Puce href={lien({ repas: "favoris" })} actif={vue.type === "favoris"}>
              <IconeCoeur className="size-4" /> Favoris
            </Puce>
          </nav>
        </section>

        <form action="/recettes" className="flex flex-col gap-2.5">
          <input type="hidden" name="repas" value={valeurVue} />
          {tagActif && <input type="hidden" name="tag" value={tagActif} />}
          <label className="relative">
            <span className="sr-only">Chercher une recette</span>
            <IconeRecherche className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-texte-2" />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Chercher une recette"
              className="min-h-12 w-full rounded-full border border-ligne bg-white pl-11 pr-4 text-[16px] focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale"
            />
          </label>
          <div className="defilement -mx-5 flex gap-2.5 overflow-x-auto px-5 py-0.5">
            {tags.map((t) => (
              <Link
                key={t.id}
                href={lien({ tag: tagActif === t.id ? null : t.id })}
                aria-pressed={tagActif === t.id}
                className={cx(
                  "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[13.5px]",
                  tagActif === t.id ? "border-chocolat bg-chocolat text-creme" : "border-ligne bg-blanc-casse text-chocolat",
                )}
              >
                {t.nom}
              </Link>
            ))}
          </div>
        </form>

        {vue.type === "repas" && repas[vue.index].exclues > 0 && (
          <p className="text-[13px] text-texte-2">
            Les recettes avec tes aliments exclus ne sont pas affichées.
          </p>
        )}

        {filtrees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-bloc border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-10 text-center">
            <p className="font-titre text-lg font-bold">
              {vue.type === "favoris" && !q && !tagActif ? "Pas encore de favoris" : "Aucune recette ici"}
            </p>
            <p className="max-w-xs text-[14.5px] text-texte-2">
              {vue.type === "favoris" && !q && !tagActif
                ? "Touche le cœur sur une recette pour la retrouver ici."
                : q || tagActif
                  ? "Essaie un autre mot ou enlève le filtre."
                  : "Cindy ajoute régulièrement des recettes : reviens bientôt !"}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4">
            {filtrees.map((x) => (
              <li key={x.recette.id}>
                <CarteRecette
                  x={x}
                  href={`/recettes/${x.recette.id}?repas=${x.repas[0]}`}
                  favori={idsFavoris.has(x.recette.id)}
                  libelleRepas={vue.type === "repas" ? null : x.repas.map((i) => repas[i].repas.libelle).join(" · ")}
                  tags={tags.filter((t) => x.recette.tags.includes(t.id)).map((t) => t.nom)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14.5px] font-medium",
        actif ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat shadow-douce",
      )}
    >
      {children}
    </Link>
  );
}

function CarteRecette({
  x,
  href,
  favori,
  libelleRepas,
  tags,
}: {
  x: RecettePourCliente;
  href: string;
  favori: boolean;
  libelleRepas: string | null;
  tags: string[];
}) {
  const photo = urlPhotoRecette(x.recette.photo_path);
  return (
    <Link href={href} className="group block overflow-hidden rounded-carte bg-blanc-casse shadow-douce">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-caramel-clair/60 to-accent-pale">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-chocolat/40">
            <IconeRecettes className="size-10" />
          </span>
        )}
        {favori && (
          <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-blanc-casse/90 text-accent">
            <IconeCoeur className="size-5" fill="currentColor" aria-label="Dans tes favoris" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <span className="font-medium leading-snug group-hover:text-accent">{x.recette.titre}</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-texte-2">
          {x.recette.temps_prep_min && (
            <span className="inline-flex items-center gap-1">
              <IconeHorloge className="size-4" /> {x.recette.temps_prep_min} min
            </span>
          )}
          {tags.slice(0, 3).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        {(libelleRepas || x.approximative) && (
          <div className="flex flex-wrap items-center gap-2">
            {libelleRepas && <span className="text-[12.5px] text-texte-2">Pour : {libelleRepas}</span>}
            {x.approximative && <Etiquette ton="sable">Approximative</Etiquette>}
          </div>
        )}
      </div>
    </Link>
  );
}
