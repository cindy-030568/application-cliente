"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { IconePlus } from "@/components/icones";
import { Bouton, Carte, Etiquette, Message, classesBouton, cx, type VarianteBouton } from "@/components/ui";
import { formaterQuantite } from "@/lib/nutrition";
import {
  BASES,
  LIMITES,
  apportsChoix,
  apportsRepas,
  arrondiGrammes,
  arrondiUnites,
  heureParDefaut,
  quantiteEquivalente,
  recalculerLigne,
  type AlimentPlan,
  type Base,
  type Choix,
  type ContenuPlan,
  type Ligne,
  type Objectifs,
  type RepasPlan,
} from "@/lib/plan-alimentaire";
import {
  enregistrerPlanAlimentaire,
  publierPlanAlimentaire,
  supprimerPlanAlimentaire,
  type EtatPlanAlim,
  type ResultatAliment,
} from "../../../plan-alimentaire-actions";
import { AnalysePlan } from "./analyse";
import { RechercheAliment } from "./recherche-aliment";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

type Props = {
  clienteId: string;
  planId: string;
  prenom: string;
  titre: string;
  contenu: ContenuPlan;
  recommandations: string;
  publie: boolean;
  infoPublication: string | null;
  objectifsBesoins: Objectifs | null;
};

/** Quantité par défaut d'un aliment ajouté : 1 unité s'il en a une, sinon 100 g. */
function choixInitial(a: AlimentPlan): Choix {
  return a.poids_unite_g ? { aliment: a, quantite: 1, unite: "unite" } : { aliment: a, quantite: 100, unite: "g" };
}

/** Boutons de la barre du bas, plus compacts que les boutons standard. */
const compact = (v: VarianteBouton) => classesBouton(v).replace("min-h-12", "min-h-10").replace("px-6 py-3", "px-4 py-2").replace("text-[15px]", "text-[14px]");

const memesObjectifs = (a: Objectifs | null, b: Objectifs | null) =>
  a === b || (!!a && !!b && (["kcal", "proteines", "glucides", "lipides", "fibres"] as const).every((k) => a[k] === b[k]));

export function EditeurPlan(p: Props) {
  const [titre, setTitre] = useState(p.titre);
  const [contenu, setContenu] = useState<ContenuPlan>(p.contenu);
  const [recos, setRecos] = useState(p.recommandations);
  const [modifie, setModifie] = useState(false);
  const [etat, setEtat] = useState<EtatPlanAlim>({});
  const [enCours, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState<string | null>(null); // recherche ouverte : "r2", "r2-l3"

  const changer = useCallback((f: (c: ContenuPlan) => ContenuPlan) => {
    setContenu(f);
    setModifie(true);
    setEtat({});
  }, []);
  const changerRepas = (i: number, f: (r: RepasPlan) => RepasPlan) =>
    changer((c) => ({ ...c, repas: c.repas.map((r, k) => (k === i ? f(r) : r)) }));
  const changerLigne = (i: number, j: number, f: (l: Ligne) => Ligne) =>
    changerRepas(i, (r) => ({ ...r, lignes: r.lignes.map((l, k) => (k === j ? f(l) : l)) }));

  const enregistrer = useCallback(
    (ensuite?: () => Promise<EtatPlanAlim>) =>
      demarrer(async () => {
        const r = await enregistrerPlanAlimentaire(p.clienteId, p.planId, { titre, contenu, recommandations: recos });
        if (r.erreur) return setEtat(r);
        setModifie(false);
        setEtat(ensuite ? await ensuite() : r);
      }),
    [p.clienteId, p.planId, titre, contenu, recos],
  );

  // Raccourci Ctrl/Cmd + S, et avertissement si on quitte sans enregistrer.
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        enregistrer();
      }
    };
    const quitter = (e: BeforeUnloadEvent) => {
      if (modifie) e.preventDefault();
    };
    window.addEventListener("keydown", clavier);
    window.addEventListener("beforeunload", quitter);
    return () => {
      window.removeEventListener("keydown", clavier);
      window.removeEventListener("beforeunload", quitter);
    };
  }, [enregistrer, modifie]);

  const deplacer = <T,>(liste: T[], i: number, d: -1 | 1): T[] => {
    const j = i + d;
    if (j < 0 || j >= liste.length) return liste;
    const copie = [...liste];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    return copie;
  };

  return (
    <div className="flex flex-col gap-5 pb-32">
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Titre du plan"
          value={titre}
          maxLength={80}
          onChange={(e) => {
            setTitre(e.target.value);
            setModifie(true);
          }}
          className="min-h-12 min-w-0 flex-1 basis-72 rounded-xl border border-transparent bg-transparent px-2 font-titre text-[28px] font-bold hover:border-ligne focus:border-chocolat focus:bg-white focus:outline-none"
        />
        {p.publie ? <Etiquette ton="vert">{p.infoPublication ?? "Publié"}</Etiquette> : <Etiquette ton="sable">Brouillon</Etiquette>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Carte className="lg:hidden">
            <AnalysePlan contenu={contenu} objectifs={contenu.objectifs} compacte />
          </Carte>

          {contenu.repas.map((r, i) => {
            const a = apportsRepas(r);
            return (
              <Carte key={i} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    aria-label={`Heure du repas ${r.libelle}`}
                    value={r.heure ?? ""}
                    onChange={(e) => changerRepas(i, (x) => ({ ...x, heure: e.target.value || null }))}
                    className="min-h-10 rounded-lg border border-ligne bg-white px-2 text-[14px] tabular-nums"
                  />
                  <input
                    aria-label="Nom du repas"
                    value={r.libelle}
                    maxLength={LIMITES.libelle}
                    onChange={(e) => changerRepas(i, (x) => ({ ...x, libelle: e.target.value }))}
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-titre text-xl font-bold hover:border-ligne focus:border-chocolat focus:bg-white focus:outline-none"
                  />
                  <PetitsBoutons
                    nom={`le repas ${r.libelle}`}
                    monter={i > 0 ? () => changer((c) => ({ ...c, repas: deplacer(c.repas, i, -1) })) : undefined}
                    descendre={i < contenu.repas.length - 1 ? () => changer((c) => ({ ...c, repas: deplacer(c.repas, i, 1) })) : undefined}
                    supprimer={() => {
                      if (r.lignes.length === 0 || window.confirm(`Supprimer le repas « ${r.libelle} » et ses aliments ?`))
                        changer((c) => ({ ...c, repas: c.repas.filter((_, k) => k !== i) }));
                    }}
                  />
                </div>

                {r.lignes.length === 0 && <p className="text-[14px] text-texte-2">Aucun aliment pour l’instant.</p>}
                <ol className="flex flex-col gap-3">
                  {r.lignes.map((l, j) => (
                    <li key={j}>
                      <BlocLigne
                        ligne={l}
                        ouvert={ouvert === `r${i}-l${j}`}
                        ouvrir={(o) => setOuvert(o ? `r${i}-l${j}` : null)}
                        changer={(f) => changerLigne(i, j, f)}
                        monter={j > 0 ? () => changerRepas(i, (x) => ({ ...x, lignes: deplacer(x.lignes, j, -1) })) : undefined}
                        descendre={j < r.lignes.length - 1 ? () => changerRepas(i, (x) => ({ ...x, lignes: deplacer(x.lignes, j, 1) })) : undefined}
                        supprimer={() => changerRepas(i, (x) => ({ ...x, lignes: x.lignes.filter((_, k) => k !== j) }))}
                      />
                    </li>
                  ))}
                </ol>

                {ouvert === `r${i}` ? (
                  <RechercheAliment
                    placeholder="Ajouter un aliment (ex. pain complet, skyr…)"
                    onFermer={() => setOuvert(null)}
                    onChoisir={(res: ResultatAliment) => {
                      changerRepas(i, (x) => ({ ...x, lignes: [...x.lignes, { principal: choixInitial(res.aliment), alternatives: [], base: "kcal" }] }));
                      setOuvert(null);
                    }}
                  />
                ) : (
                  r.lignes.length < LIMITES.lignes && (
                    <button
                      type="button"
                      onClick={() => setOuvert(`r${i}`)}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-accent-pale/60 text-[14.5px] font-medium hover:bg-accent-pale"
                    >
                      <IconePlus className="size-4" /> Ajouter un aliment
                    </button>
                  )
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-texte-2">Notes du repas (alternatives, recettes, conseils…)</span>
                  <textarea
                    value={r.note}
                    maxLength={LIMITES.note}
                    onChange={(e) => changerRepas(i, (x) => ({ ...x, note: e.target.value }))}
                    rows={r.note ? Math.min(10, r.note.split("\n").length + 1) : 2}
                    className="rounded-xl border border-ligne bg-white px-3 py-2 text-[14.5px]"
                  />
                </label>

                <dl className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-ligne pt-3 text-[13px]">
                  {[
                    ["Énergie", `${nf.format(a.kcal)} kcal`],
                    ["Lipides", `${nf1.format(a.lipides)} g`],
                    ["Glucides", `${nf1.format(a.glucides)} g`],
                    ["Protéines", `${nf1.format(a.proteines)} g`],
                    ["Fibres", `${nf1.format(a.fibres)} g`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <dt className="text-texte-2">{k}</dt>
                      <dd className="font-medium tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Carte>
            );
          })}

          {contenu.repas.length < LIMITES.repas && (
            <Bouton
              type="button"
              variante="contour"
              onClick={() =>
                changer((c) => ({ ...c, repas: [...c.repas, { libelle: "Collation", heure: heureParDefaut("Collation"), lignes: [], note: "" }] }))
              }
            >
              <IconePlus className="size-5" /> Ajouter un repas
            </Bouton>
          )}

          <Carte className="flex flex-col gap-2">
            <h2 className="font-titre text-xl font-bold">Recommandations</h2>
            <p className="text-[13px] text-texte-2">
              Hydratation, activité physique, aliments à éviter, conseils généraux… Elle les lit sous son plan.
            </p>
            <textarea
              aria-label="Recommandations"
              value={recos}
              maxLength={10000}
              onChange={(e) => {
                setRecos(e.target.value);
                setModifie(true);
              }}
              rows={Math.min(24, Math.max(6, recos.split("\n").length + 1))}
              className="rounded-xl border border-ligne bg-white px-3 py-2 text-[14.5px]"
            />
          </Carte>

          <div className="flex flex-wrap gap-3">
            <Bouton
              type="button"
              variante="danger"
              disabled={enCours}
              onClick={() => {
                if (window.confirm("Supprimer ce plan ? Il disparaîtra aussi de son application s’il est publié."))
                  demarrer(async () => setEtat(await supprimerPlanAlimentaire(p.clienteId, p.planId)));
              }}
            >
              Supprimer le plan
            </Bouton>
          </div>
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-4">
          <Carte className="flex flex-col gap-3">
            <h2 className="font-titre text-lg font-bold">Analyse du plan</h2>
            <AnalysePlan contenu={contenu} objectifs={contenu.objectifs} />
          </Carte>
          {!memesObjectifs(contenu.objectifs, p.objectifsBesoins) && p.objectifsBesoins && (
            <Carte className="flex flex-col gap-2 text-[13.5px]">
              <p>Ses besoins ont changé depuis la création du plan ({nf.format(p.objectifsBesoins.kcal)} kcal).</p>
              <Bouton type="button" variante="contour" onClick={() => changer((c) => ({ ...c, objectifs: p.objectifsBesoins }))}>
                Reprendre ses besoins actuels
              </Bouton>
            </Carte>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ligne bg-blanc-casse/95 backdrop-blur-md md:left-64">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-x-3 gap-y-2 px-4 py-2.5">
          <p className="mr-auto min-w-0 basis-full text-[13px] sm:basis-auto" role="status">
            {etat.erreur ? (
              <span className="text-erreur">{etat.erreur}</span>
            ) : etat.succes ? (
              <span className="text-succes">{etat.succes}</span>
            ) : modifie ? (
              <span className="text-texte-2">Modifications non enregistrées</span>
            ) : (
              <span className="text-texte-2">Tout est enregistré</span>
            )}
          </p>
          <a href={`/plan-alimentaire/${p.planId}/pdf`} className={cx("text-[14px] underline underline-offset-4", modifie && "pointer-events-none opacity-50")} aria-disabled={modifie}>
            PDF
          </a>
          {p.publie && (
            <button type="button" className={compact("contour")} disabled={enCours} onClick={() => enregistrer(() => publierPlanAlimentaire(p.clienteId, p.planId, false))}>
              Retirer
            </button>
          )}
          <button type="button" className={compact(modifie ? "sombre" : "contour")} disabled={enCours || !modifie} onClick={() => enregistrer()}>
            {enCours ? "…" : "Enregistrer"}
          </button>
          <button
            type="button"
            className={compact("principal")}
            disabled={enCours || contenu.repas.every((r) => r.lignes.length === 0)}
            onClick={() => enregistrer(() => publierPlanAlimentaire(p.clienteId, p.planId, true))}
          >
            {p.publie ? "Mettre à jour son plan" : `Publier pour ${p.prenom}`}
          </button>
        </div>
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
    </div>
  );
}

// ---------------------------------------------------------------- Une ligne : aliment + alternatives « ou »

function BlocLigne({
  ligne,
  ouvert,
  ouvrir,
  changer,
  monter,
  descendre,
  supprimer,
}: {
  ligne: Ligne;
  ouvert: boolean;
  ouvrir: (o: boolean) => void;
  changer: (f: (l: Ligne) => Ligne) => void;
  monter?: () => void;
  descendre?: () => void;
  supprimer: () => void;
}) {
  const kcal = apportsChoix(ligne.principal).kcal;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ligne bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 basis-40 text-[15px] font-medium">{ligne.principal.aliment.nom}</span>
        <ChampQuantite
          choix={ligne.principal}
          onChange={(c) => changer((l) => recalculerLigne({ ...l, principal: c }))}
        />
        <span className="w-16 text-right text-[12.5px] tabular-nums text-texte-2">{nf.format(kcal)} kcal</span>
        <PetitsBoutons nom={ligne.principal.aliment.nom} monter={monter} descendre={descendre} supprimer={supprimer} />
      </div>

      {ligne.alternatives.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-l-2 border-sable pl-3">
          {ligne.alternatives.map((a, k) => (
            <li key={k} className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-medium text-caramel-texte">ou</span>
              <span className="min-w-0 flex-1 basis-36 text-[14.5px]">{a.aliment.nom}</span>
              <ChampQuantite
                choix={a}
                onChange={(c) =>
                  changer((l) => ({ ...l, alternatives: l.alternatives.map((x, n) => (n === k ? { ...c, manuel: true } : x)) }))
                }
              />
              {a.manuel ? (
                <button
                  type="button"
                  title="Recalculer l’équivalence"
                  onClick={() =>
                    changer((l) => recalculerLigne({ ...l, alternatives: l.alternatives.map((x, n) => (n === k ? { ...x, manuel: false } : x)) }))
                  }
                  className="rounded-full px-2 py-1 text-[12px] text-texte-2 underline underline-offset-2 hover:text-chocolat"
                >
                  recalculer
                </button>
              ) : (
                <span className="px-2 text-[12px] text-texte-2">auto</span>
              )}
              <button
                type="button"
                aria-label={`Retirer l’alternative ${a.aliment.nom}`}
                onClick={() => changer((l) => ({ ...l, alternatives: l.alternatives.filter((_, n) => n !== k) }))}
                className="flex size-8 items-center justify-center rounded-full text-texte-2 hover:bg-accent-pale hover:text-erreur"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {ouvert ? (
        <RechercheAliment
          placeholder="Alternative : remplacer par…"
          onFermer={() => ouvrir(false)}
          onChoisir={(res) => {
            changer((l) => {
              const unite = res.aliment.poids_unite_g ? "unite" : "g";
              const q = quantiteEquivalente(l.principal, res.aliment, l.base, unite) ?? (unite === "unite" ? 1 : 100);
              return { ...l, alternatives: [...l.alternatives, { aliment: res.aliment, quantite: q, unite }] };
            });
            ouvrir(false);
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {ligne.alternatives.length < LIMITES.alternatives && (
            <button type="button" onClick={() => ouvrir(true)} className="text-[13.5px] font-medium text-accent hover:underline">
              + ou… (alternative)
            </button>
          )}
          {ligne.alternatives.length > 0 && (
            <label className="ml-auto flex items-center gap-1.5 text-[12.5px] text-texte-2">
              Équivalence en
              <select
                value={ligne.base}
                onChange={(e) => changer((l) => recalculerLigne({ ...l, base: e.target.value as Base }))}
                className="rounded-lg border border-ligne bg-white px-1.5 py-1 text-[12.5px]"
              >
                {Object.entries(BASES).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/** Quantité + unité (g, ou l'unité de l'aliment : œuf, tranche…). Garde la saisie en cours intacte. */
function ChampQuantite({ choix, onChange }: { choix: Choix; onChange: (c: Choix) => void }) {
  const affichage = (q: number) => String(q).replace(".", ",");
  const [texte, setTexte] = useState(affichage(choix.quantite));
  const [precedente, setPrecedente] = useState(choix.quantite);
  const [focus, setFocus] = useState(false);
  if (choix.quantite !== precedente && !focus) {
    setPrecedente(choix.quantite);
    setTexte(affichage(choix.quantite));
  }
  const a = choix.aliment;
  return (
    <span className="flex items-center gap-1">
      <input
        aria-label={`Quantité de ${a.nom}`}
        inputMode="decimal"
        value={texte}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          setTexte(affichage(choix.quantite));
        }}
        onChange={(e) => {
          setTexte(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          if (e.target.value.trim() && Number.isFinite(n) && n > 0 && n <= (choix.unite === "unite" ? 50 : 5000)) {
            setPrecedente(n);
            onChange({ ...choix, quantite: n });
          }
        }}
        className="min-h-9 w-16 rounded-lg border border-ligne bg-white px-1 text-center text-[14.5px] tabular-nums"
      />
      {a.poids_unite_g ? (
        <select
          aria-label={`Unité de ${a.nom}`}
          value={choix.unite}
          onChange={(e) => {
            const unite = e.target.value as Choix["unite"];
            if (unite === choix.unite) return;
            const g = choix.unite === "unite" ? choix.quantite * a.poids_unite_g! : choix.quantite;
            onChange({ ...choix, unite, quantite: unite === "unite" ? arrondiUnites(g / a.poids_unite_g!) : arrondiGrammes(g) });
          }}
          className="min-h-9 rounded-lg border border-ligne bg-white px-1 text-[13.5px]"
        >
          <option value="g">g</option>
          <option value="unite">{formaterQuantite(2, "unite", a.nom_unite).replace(/^2 /, "")}</option>
        </select>
      ) : (
        <span className="text-[13.5px] text-texte-2">g</span>
      )}
    </span>
  );
}

function PetitsBoutons({ nom, monter, descendre, supprimer }: { nom: string; monter?: () => void; descendre?: () => void; supprimer: () => void }) {
  const cls = "flex size-8 items-center justify-center rounded-full text-texte-2 hover:bg-sable disabled:opacity-30";
  return (
    <span className="flex items-center">
      <button type="button" aria-label={`Monter ${nom}`} disabled={!monter} onClick={monter} className={cls}>
        ↑
      </button>
      <button type="button" aria-label={`Descendre ${nom}`} disabled={!descendre} onClick={descendre} className={cls}>
        ↓
      </button>
      <button type="button" aria-label={`Supprimer ${nom}`} onClick={supprimer} className={cx(cls, "hover:bg-accent-pale hover:text-erreur")}>
        ✕
      </button>
    </span>
  );
}
