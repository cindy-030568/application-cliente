import type { Metadata } from "next";
import { nomIngredient } from "@/lib/noms-aliments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Etiquette, Message, Surtitre, cx } from "@/components/ui";
import { exigerCoach, lireReglages } from "@/lib/auth";
import type { RecetteAdaptee } from "@/lib/moteur";
import { formaterQuantite } from "@/lib/nutrition";
import { recettesAdapteesCliente, type RecettePourMoteur } from "@/lib/recettes-adaptees";
import { urlPhotoRecette } from "@/lib/recettes";

export const metadata: Metadata = { title: "Aperçu des recettes" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export default async function PageApercuRecettes({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ repas?: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: c } = await supabase
    .from("clientes")
    .select("id, profils!inner(prenom, nom)")
    .eq("id", id)
    .maybeSingle<{ id: string; profils: { prenom: string; nom: string } }>();
  if (!c) notFound();

  const reglages = await lireReglages();
  const repas = await recettesAdapteesCliente(supabase, id, reglages);
  const indexDemande = Number((await searchParams).repas ?? 0);
  const index = Number.isInteger(indexDemande) && indexDemande >= 0 && indexDemande < repas.length ? indexDemande : 0;
  const actif = repas[index];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/coach/clientes/${id}`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Fiche de {c.profils.prenom}
      </Link>
      <div>
        <Surtitre>Aperçu des recettes</Surtitre>
        <h1 className="font-titre text-[32px] font-bold leading-tight">
          {c.profils.prenom} {c.profils.nom}
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-texte-2">
          Ce que {c.profils.prenom} verra quand elle voudra changer de recette, avec les quantités calculées pour
          ses cibles. Écart accepté : ±{nf.format(reglages.tolerance_pct)} % ou ±{nf.format(reglages.tolerance_g)} g
          par macro.{" "}
          <Link href="/coach/reglages" className="underline">
            Modifier
          </Link>
        </p>
      </div>

      {repas.length === 0 ? (
        <Message ton="info">
          Aucun repas n’est encore défini pour {c.profils.prenom}. Ajoute ses repas et leurs cibles dans{" "}
          <Link href={`/coach/clientes/${id}`} className="underline">
            sa fiche
          </Link>
          .
        </Message>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Repas">
            {repas.map((r, i) => (
              <Link
                key={i}
                href={`/coach/clientes/${id}/recettes?repas=${i}`}
                aria-current={i === index ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14.5px] font-medium",
                  i === index ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat shadow-douce",
                )}
              >
                {r.repas.libelle}
                <span className={cx("text-[12.5px]", i === index ? "text-texte-clair" : "text-texte-2")}>
                  {r.compatibles.length}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-texte-2">
            <span>
              Cible : P {nf.format(actif.cible.proteines)} g · G {nf.format(actif.cible.glucides)} g · L{" "}
              {nf.format(actif.cible.lipides)} g
            </span>
            <span>
              {actif.compatibles.length} recette{actif.compatibles.length > 1 ? "s" : ""} proposée
              {actif.compatibles.length > 1 ? "s" : ""}
            </span>
            {actif.exclues > 0 && (
              <span>
                {actif.exclues} écartée{actif.exclues > 1 ? "s" : ""} (aliments exclus)
              </span>
            )}
          </div>

          {actif.compatibles.length === 0 && actif.approximatives.length === 0 && (
            <Message ton="info">
              Aucune recette ne correspond à ce repas pour l’instant. Vérifie ses cibles et ses exclusions, ou ajoute des
              recettes pour ce type de repas.
            </Message>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {actif.compatibles.map((a) => (
              <CarteRecette key={a.recette.id} a={a} />
            ))}
            {actif.approximatives.map((a) => (
              <CarteRecette key={a.recette.id} a={a} approximative />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CarteRecette({ a, approximative = false }: { a: RecetteAdaptee<RecettePourMoteur>; approximative?: boolean }) {
  const r = a.recette.source;
  const photo = urlPhotoRecette(r.photo_path);
  const quantites = new Map(a.resultat.quantites.map((q) => [q.id, q.quantite]));
  const m = a.resultat.macros;
  return (
    <Carte className="flex flex-col gap-3 p-0">
      <div className="aspect-[16/9] overflow-hidden rounded-t-carte bg-gradient-to-br from-caramel-clair/60 to-accent-pale">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/coach/recettes/${r.id}`} className="font-medium leading-snug hover:text-accent">
            {r.titre}
          </Link>
          {approximative && <Etiquette ton="sable">Approximative</Etiquette>}
        </div>
        <ul className="flex flex-col gap-1 text-[14px]">
          {[...r.ingredients]
            .sort((x, y) => x.ordre - y.ordre)
            .map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span className="text-texte-2" title={i.aliment.nom}>{nomIngredient(i.aliment.nom)}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formaterQuantite(quantites.get(i.id) ?? i.qte_base, i.unite, i.aliment.nom_unite)}
                </span>
              </li>
            ))}
        </ul>
        <p className="text-[12.5px] text-texte-2">
          P {nf.format(m.proteines)} g · G {nf.format(m.glucides)} g · L {nf.format(m.lipides)} g ·{" "}
          {Math.round(m.kcal)} kcal
        </p>
      </div>
    </Carte>
  );
}
