import type { Metadata } from "next";
import Link from "next/link";
import { IconePlus } from "@/components/icones";
import { Carte, Etiquette, LienBouton, Message, Surtitre, cx } from "@/components/ui";
import { chargerCategoriesAliment, rechercherAliments } from "@/lib/aliments";
import { exigerCoach } from "@/lib/auth";
import { BoutonImportCiqual } from "./import";

export const metadata: Metadata = { title: "Aliments" };

const FILTRES = [
  { cle: "", label: "Tous" },
  { cle: "perso", label: "Mes aliments" },
  { cle: "ciqual", label: "Ciqual" },
  { cle: "unite", label: "À l’unité" },
];

export default async function PageAliments({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtre?: string; ajoute?: string; supprime?: string }>;
}) {
  const { q = "", filtre = "", ajoute, supprime } = await searchParams;
  const { supabase } = await exigerCoach();
  const [{ count: nbCiqual }, { count: nbPerso }, categories] = await Promise.all([
    supabase.from("aliments").select("id", { count: "exact", head: true }).eq("source", "ciqual"),
    supabase.from("aliments").select("id", { count: "exact", head: true }).eq("source", "perso"),
    chargerCategoriesAliment(supabase),
  ]);
  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));
  const resultats =
    q.trim() || filtre
      ? await rechercherAliments(supabase, q, {
          source: filtre === "perso" || filtre === "ciqual" ? filtre : undefined,
          avecUnite: filtre === "unite",
          limite: 60,
        })
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Surtitre>Aliments</Surtitre>
          <h1 className="font-titre text-[34px] font-bold leading-tight">Base d’aliments</h1>
          <p className="mt-1 text-[15px] text-texte-2">
            {nbCiqual ?? 0} aliments Ciqual · {nbPerso ?? 0} aliment{(nbPerso ?? 0) > 1 ? "s" : ""} perso · valeurs pour 100 g
          </p>
        </div>
        <LienBouton href="/coach/aliments/nouveau">
          <IconePlus className="size-5" /> Nouvel aliment
        </LienBouton>
      </div>
      {ajoute && <Message ton="succes">Aliment ajouté.</Message>}
      {supprime && <Message ton="succes">Aliment supprimé.</Message>}

      {!nbCiqual ? (
        <Carte className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">Première étape : la table Ciqual</h2>
          <p className="text-[15px] text-texte-2">
            La table officielle de l’ANSES : 3 049 aliments avec leurs protéines, glucides, lipides et kcal. Les catégories
            d’exclusion (gluten, lactose, viande…) sont proposées automatiquement, à vérifier.
          </p>
          <BoutonImportCiqual premier />
        </Carte>
      ) : null}

      <form className="flex flex-col gap-3" action="/coach/aliments">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher : poulet filet, riz basmati, skyr…"
          aria-label="Rechercher un aliment"
          className="min-h-12 w-full rounded-full border border-ligne bg-white px-5 text-[16px] focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale"
        />
        <input type="hidden" name="filtre" value={filtre} />
        <div className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <Link
              key={f.cle}
              href={`/coach/aliments?${new URLSearchParams({ q, filtre: f.cle })}`}
              className={cx(
                "rounded-full px-4 py-2 text-[14px]",
                filtre === f.cle ? "bg-chocolat text-creme" : "bg-blanc-casse hover:bg-sable",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </form>

      {resultats.length > 0 ? (
        <Carte className="overflow-hidden p-0">
          <table className="w-full text-[14px]">
            <thead className="text-left text-texte-2">
              <tr>
                <th className="px-4 py-3 font-medium">Aliment</th>
                <th className="px-3 py-3 text-right font-medium">P</th>
                <th className="px-3 py-3 text-right font-medium">G</th>
                <th className="px-3 py-3 text-right font-medium">L</th>
                <th className="px-3 py-3 text-right font-medium">kcal</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {resultats.map((a) => (
                <tr key={a.id} className={cx("border-t border-ligne hover:bg-sable/30", !a.actif && "opacity-50")}>
                  <td className="px-4 py-2.5">
                    <Link href={`/coach/aliments/${a.id}`} className="flex flex-col gap-1 hover:text-accent">
                      <span className="font-medium">{a.nom}</span>
                      <span className="flex flex-wrap gap-1.5">
                        {a.source === "perso" && <Etiquette ton="vert">Perso</Etiquette>}
                        {a.nom_unite && <Etiquette ton="sable">1 {a.nom_unite} = {a.poids_unite_g} g</Etiquette>}
                        {a.categories.map((c) => (
                          <Etiquette key={c} ton="rose">
                            {nomCategorie.get(c)}
                          </Etiquette>
                        ))}
                        {a.incomplet && <Etiquette ton="sombre">Incomplet</Etiquette>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right">{a.proteines_100}</td>
                  <td className="px-3 py-2.5 text-right">{a.glucides_100}</td>
                  <td className="px-3 py-2.5 text-right">{a.lipides_100}</td>
                  <td className="px-3 py-2.5 text-right">{Math.round(a.kcal_100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Carte>
      ) : q.trim() ? (
        <Carte className="text-center text-texte-2">Aucun aliment trouvé. Essaie un autre mot, ou crée un aliment perso.</Carte>
      ) : (
        <p className="text-[14px] text-texte-2">Tape un nom d’aliment pour le retrouver.</p>
      )}

      {Boolean(nbCiqual) && (
        <Carte className="flex flex-col gap-2 shadow-none">
          <p className="text-[14px] text-texte-2">
            Source : ANSES, Table Ciqual 2020 (Licence Ouverte Etalab). Ta mise à jour conserve tes unités et les catégories que tu
            as vérifiées.
          </p>
          <div>
            <BoutonImportCiqual premier={false} />
          </div>
        </Carte>
      )}
    </div>
  );
}
