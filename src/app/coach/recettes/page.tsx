import type { Metadata } from "next";
import Link from "next/link";
import { IconePlus } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Message, Surtitre, cx } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { REPAS_RECETTE, additionner, macrosDe } from "@/lib/nutrition";
import { chargerRecettes, urlPhotoRecette } from "@/lib/recettes";
import { normaliser } from "@/lib/texte";
import { BoutonImportRecettes } from "./import";

export const metadata: Metadata = { title: "Recettes" };

export default async function PageRecettesCoach({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; repas?: string; supprimee?: string }>;
}) {
  const { q = "", repas = "", supprimee } = await searchParams;
  const { supabase } = await exigerCoach();
  const recettes = await chargerRecettes(supabase);
  const filtrees = recettes.filter(
    (r) => (!repas || r.repas.includes(repas)) && (!q.trim() || normaliser(r.titre).includes(normaliser(q))),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Recettes</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Recettes maîtres</h1>
          <p className="mt-1 text-[15px] text-texte-2">
            {recettes.length} recette{recettes.length > 1 ? "s" : ""} · les quantités s’adapteront à chaque cliente (phase 6)
          </p>
        </div>
        <LienBouton href="/coach/recettes/nouvelle">
          <IconePlus className="size-5" /> Nouvelle recette
        </LienBouton>
      </div>
      {supprimee && <Message ton="succes">Recette supprimée.</Message>}

      {recettes.length < 50 && (
        <Carte className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">Tes 50 recettes de départ</h2>
          <p className="text-[15px] text-texte-2">
            10 petits-déjeuners, 15 déjeuners, 15 dîners et 10 collations, dont 29 végétariennes. Il faut d’abord avoir importé la
            table Ciqual (menu Aliments). Tu pourras ensuite tout modifier.
          </p>
          <div>
            <BoutonImportRecettes principal={recettes.length === 0} />
          </div>
        </Carte>
      )}

      <form action="/coach/recettes" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher une recette"
          aria-label="Rechercher une recette"
          className="min-h-11 flex-1 basis-64 rounded-full border border-ligne bg-white px-5 text-[15px]"
        />
        <input type="hidden" name="repas" value={repas} />
        {[["", "Toutes"], ...Object.entries(REPAS_RECETTE)].map(([v, l]) => (
          <Link
            key={v}
            href={`/coach/recettes?${new URLSearchParams({ q, repas: v })}`}
            className={cx("rounded-full px-4 py-2 text-[14px]", repas === v ? "bg-chocolat text-creme" : "bg-blanc-casse hover:bg-sable")}
          >
            {l}
          </Link>
        ))}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtrees.map((r) => {
          const t = additionner(r.ingredients.map((i) => macrosDe(i.aliment, i.qte_base, i.unite)));
          const photo = urlPhotoRecette(r.photo_path);
          return (
            <Link key={r.id} href={`/coach/recettes/${r.id}`} className="group overflow-hidden rounded-carte bg-blanc-casse shadow-douce">
              <div className="aspect-[16/9] bg-gradient-to-br from-caramel-clair/60 to-accent-pale">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
                )}
              </div>
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium leading-snug group-hover:text-accent">{r.titre}</span>
                  {!r.publiee && <Etiquette ton="sable">Brouillon</Etiquette>}
                </div>
                <span className="text-[13px] text-texte-2">
                  {r.repas.map((x) => REPAS_RECETTE[x as keyof typeof REPAS_RECETTE]).join(" · ")}
                  {r.temps_prep_min ? ` · ${r.temps_prep_min} min` : ""}
                </span>
                <span className="text-[12.5px] tabular-nums text-texte-2">
                  Base : {Math.round(t.kcal)} kcal · P {Math.round(t.proteines)} · G {Math.round(t.glucides)} · L {Math.round(t.lipides)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {recettes.length > 0 && filtrees.length === 0 && <Carte className="text-center text-texte-2">Aucune recette ne correspond.</Carte>}
    </div>
  );
}
