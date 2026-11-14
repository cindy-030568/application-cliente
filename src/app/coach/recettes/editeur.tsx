"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, CaseACocher, Champ, Message, ZoneTexte, cx } from "@/components/ui";
import { compresserPhoto } from "@/lib/image";
import {
  REPAS_RECETTE,
  ROLES,
  additionner,
  arrondir,
  bornesParDefaut,
  macrosDe,
  roleSuggere,
  type Role,
  type Unite,
} from "@/lib/nutrition";
import { clientDepot } from "@/lib/supabase/navigateur";
import { nomIngredient } from "@/lib/noms-aliments";
import type { Aliment, Recette, Tag } from "@/lib/types";
import { chercherAliments } from "../aliments/actions";
import { enregistrerRecette, preparerPhotoRecette, supprimerRecette } from "./actions";

type AlimentLigne = Pick<
  Aliment,
  "id" | "nom" | "proteines_100" | "glucides_100" | "lipides_100" | "kcal_100" | "nom_unite" | "poids_unite_g"
>;
type Ligne = {
  cle: string;
  aliment: AlimentLigne;
  role: Role;
  unite: Unite;
  qte_base: number;
  qte_min: number;
  qte_max: number;
  pas: number;
  note: string;
  auto: boolean;
};

let compteur = 0;
const nouvelleCle = () => `l${++compteur}`;

function ligneDepuisAliment(a: Aliment): Ligne {
  const role = roleSuggere(a);
  const unite: Unite = a.nom_unite && role !== "fixe" ? "unite" : "g";
  const base = unite === "unite" ? 1 : role === "lipide" ? 10 : role === "fixe" ? 50 : 100;
  const pas = unite === "unite" ? 1 : base >= 20 ? 5 : 1;
  const { min, max } = bornesParDefaut(role, base, unite, pas);
  return { cle: nouvelleCle(), aliment: a, role, unite, qte_base: base, qte_min: min, qte_max: max, pas, note: "", auto: true };
}

function RechercheAliment({ onChoix }: { onChoix: (a: Aliment) => void }) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<Aliment[]>([]);
  const [, demarrer] = useTransition();
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(minuteur.current);
    if (q.trim().length < 2) return;
    minuteur.current = setTimeout(() => demarrer(async () => setResultats(await chercherAliments(q))), 250);
    return () => clearTimeout(minuteur.current);
  }, [q]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="+ Ajouter un ingrédient : tape « poulet filet », « riz », « skyr »…"
        aria-label="Rechercher un aliment à ajouter"
        className="min-h-12 w-full rounded-xl border border-dashed border-caramel-clair bg-white px-4 text-[15px] focus:border-chocolat focus:outline-none"
      />
      {q.trim().length >= 2 && resultats.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-ligne bg-white shadow-douce">
          {resultats.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  onChoix(a);
                  setQ("");
                  setResultats([]);
                }}
                className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-sable/40"
              >
                <span className="text-[14.5px]">
                  {a.nom}
                  {a.source === "perso" && <span className="ml-2 text-[12px] text-succes">perso</span>}
                </span>
                <span className="text-[12.5px] tabular-nums text-texte-2">
                  /100 g : P {a.proteines_100} · G {a.glucides_100} · L {a.lipides_100} · {Math.round(a.kcal_100)} kcal
                  {a.nom_unite ? ` · 1 ${a.nom_unite} = ${a.poids_unite_g} g` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Nombre({
  valeur,
  onChange,
  label,
  desactive,
}: {
  valeur: number;
  onChange: (n: number) => void;
  label: string;
  desactive?: boolean;
}) {
  const [texte, setTexte] = useState(String(valeur).replace(".", ","));
  const [valeurVue, setValeurVue] = useState(valeur);
  // Valeur changée de l'extérieur (bornes recalculées) : on resynchronise le texte affiché.
  if (valeur !== valeurVue) {
    setValeurVue(valeur);
    if (Number(texte.replace(",", ".")) !== valeur) setTexte(String(valeur).replace(".", ","));
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={texte}
      disabled={desactive}
      onChange={(e) => {
        setTexte(e.target.value);
        const n = Number(e.target.value.replace(",", "."));
        if (Number.isFinite(n)) onChange(n);
      }}
      className="min-h-9 w-16 rounded-lg border border-ligne bg-white px-2 text-center text-[14px] tabular-nums disabled:bg-creme/60 disabled:text-texte-2"
    />
  );
}

export function EditeurRecette({ recette, tags, urlPhoto }: { recette?: Recette; tags: Tag[]; urlPhoto: string | null }) {
  const [etat, envoyer] = useActionState(enregistrerRecette.bind(null, recette?.id ?? null), {});
  const [lignes, setLignes] = useState<Ligne[]>(() =>
    (recette?.ingredients ?? []).map((i) => ({
      cle: nouvelleCle(),
      aliment: i.aliment,
      role: i.role,
      unite: i.unite,
      qte_base: i.qte_base,
      qte_min: i.qte_min,
      qte_max: i.qte_max,
      pas: i.pas,
      note: i.note ?? "",
      auto: false,
    })),
  );
  const [photo, setPhoto] = useState<{ chemin: string | null; apercu: string | null }>({
    chemin: recette?.photo_path ?? null,
    apercu: urlPhoto,
  });
  const [etapePhoto, setEtapePhoto] = useState<string>();
  const [erreurPhoto, setErreurPhoto] = useState<string>();
  const [enSuppression, demarrerSuppression] = useTransition();

  const total = useMemo(
    () => additionner(lignes.map((l) => macrosDe({ ...l.aliment, poids_unite_g: l.aliment.poids_unite_g }, l.qte_base, l.unite))),
    [lignes],
  );

  function modifier(cle: string, changement: Partial<Ligne>) {
    setLignes((ls) =>
      ls.map((l) => {
        if (l.cle !== cle) return l;
        const n = { ...l, ...changement };
        const bornesTouchees = "qte_min" in changement || "qte_max" in changement;
        if (bornesTouchees) n.auto = false;
        if (n.role === "fixe") {
          n.qte_min = n.qte_base;
          n.qte_max = n.qte_base;
        } else if (n.auto || ("role" in changement && l.role === "fixe")) {
          const b = bornesParDefaut(n.role, n.qte_base, n.unite, n.pas);
          n.qte_min = b.min;
          n.qte_max = b.max;
        }
        return n;
      }),
    );
  }

  function deplacer(i: number, sens: -1 | 1) {
    setLignes((ls) => {
      const j = i + sens;
      if (j < 0 || j >= ls.length) return ls;
      const copie = [...ls];
      [copie[i], copie[j]] = [copie[j], copie[i]];
      return copie;
    });
  }

  async function choisirPhoto(fichier: File | undefined) {
    if (!fichier) return;
    setErreurPhoto(undefined);
    try {
      setEtapePhoto("Préparation…");
      const blob = await compresserPhoto(fichier, 1400, 0.82);
      setEtapePhoto("Envoi…");
      const prep = await preparerPhotoRecette();
      if (!prep.chemin || !prep.jeton) throw new Error(prep.erreur ?? "Envoi impossible.");
      const { error } = await clientDepot()
        .storage.from("recettes")
        .uploadToSignedUrl(prep.chemin, prep.jeton, blob, { contentType: "image/jpeg" });
      if (error) throw new Error("La photo n’a pas pu être envoyée.");
      setPhoto({ chemin: prep.chemin, apercu: URL.createObjectURL(blob) });
    } catch (e) {
      setErreurPhoto(e instanceof Error ? e.message : "La photo n’a pas pu être envoyée.");
    } finally {
      setEtapePhoto(undefined);
    }
  }

  const ingredientsJson = JSON.stringify(
    lignes.map((l) => ({
      aliment_id: l.aliment.id,
      role: l.role,
      unite: l.unite,
      qte_base: l.qte_base,
      qte_min: l.qte_min,
      qte_max: l.qte_max,
      pas: l.pas,
      note: l.note.trim() || null,
    })),
  );

  return (
    <form action={envoyer} className="flex flex-col gap-8">
      <input type="hidden" name="ingredients" value={ingredientsJson} />
      <input type="hidden" name="photo_path" value={photo.chemin ?? ""} />

      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <Champ label="Titre" name="titre" required maxLength={120} defaultValue={recette?.titre} />
          <Champ
            label="Phrase d’accroche (facultatif)"
            name="description"
            maxLength={400}
            defaultValue={recette?.description ?? ""}
            placeholder="Le grand classique sucré-salé, version maison."
          />
          <Champ
            label="Temps de préparation (minutes)"
            name="temps_prep_min"
            type="number"
            min={0}
            max={600}
            defaultValue={recette?.temps_prep_min ?? ""}
            className="max-w-48"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Photo</span>
          <label className="relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-caramel-clair bg-white text-[13px] text-texte-2">
            {photo.apercu ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.apercu} alt="Photo de la recette" className="size-full object-cover" />
            ) : (
              (etapePhoto ?? "Ajouter une photo")
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => choisirPhoto(e.target.files?.[0])} />
          </label>
          {etapePhoto && photo.apercu && <span className="text-[12.5px] text-texte-2">{etapePhoto}</span>}
          {photo.chemin && (
            <button
              type="button"
              className="self-start text-[13px] text-texte-2 underline underline-offset-2"
              onClick={() => setPhoto({ chemin: null, apercu: null })}
            >
              Retirer la photo
            </button>
          )}
          {erreurPhoto && <span className="text-[13px] text-erreur">{erreurPhoto}</span>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-sm font-medium">Pour quels repas ?</legend>
          {Object.entries(REPAS_RECETTE).map(([v, l]) => (
            <CaseACocher key={v} name="repas" value={v} label={l} defaultChecked={recette?.repas.includes(v)} />
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-sm font-medium">Étiquettes</legend>
          {tags.map((t) => (
            <CaseACocher key={t.id} name="tags" value={t.id} label={t.nom} defaultChecked={recette?.tags.includes(t.id)} />
          ))}
        </fieldset>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-titre text-xl font-bold">Ingrédients (pour 1 portion, poids cru)</h2>
            <p className="text-[13.5px] text-texte-2">
              Le rôle indique ce que le moteur ajuste. La fourchette (min – max) et le pas encadrent les quantités proposées.
            </p>
          </div>
          <p className="rounded-full bg-chocolat px-4 py-1.5 text-[13.5px] tabular-nums text-creme">
            Recette de base : {Math.round(total.kcal)} kcal · P {arrondir(total.proteines)} · G {arrondir(total.glucides)} · L{" "}
            {arrondir(total.lipides)}
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-ligne bg-white">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead className="text-left text-[12.5px] text-texte-2">
              <tr>
                <th className="px-3 py-2 font-medium">Aliment</th>
                <th className="px-2 py-2 font-medium">Rôle</th>
                <th className="px-2 py-2 font-medium">Unité</th>
                <th className="px-2 py-2 text-center font-medium">Base</th>
                <th className="px-2 py-2 text-center font-medium">Min</th>
                <th className="px-2 py-2 text-center font-medium">Max</th>
                <th className="px-2 py-2 text-center font-medium">Pas</th>
                <th className="px-2 py-2 font-medium">Note</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => {
                const m = macrosDe(l.aliment, l.qte_base, l.unite);
                return (
                  <tr key={l.cle} className="border-t border-ligne align-middle">
                    <td className="px-3 py-2">
                      <span className="block max-w-64 leading-snug">{nomIngredient(l.aliment.nom)}</span>
                      {nomIngredient(l.aliment.nom) !== l.aliment.nom && (
                        <span className="block max-w-64 text-[12px] leading-snug text-texte-2">{l.aliment.nom}</span>
                      )}
                      <span className="text-[12px] tabular-nums text-texte-2">
                        {Math.round(m.kcal)} kcal · P {arrondir(m.proteines, 1)} · G {arrondir(m.glucides, 1)} · L {arrondir(m.lipides, 1)}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        aria-label="Rôle"
                        value={l.role}
                        title={ROLES[l.role].aide}
                        onChange={(e) => modifier(l.cle, { role: e.target.value as Role })}
                        className={cx(
                          "min-h-9 rounded-lg border border-ligne px-2 text-[13.5px]",
                          l.role === "fixe" ? "bg-creme/70" : "bg-accent-pale/50",
                        )}
                      >
                        {Object.entries(ROLES).map(([v, r]) => (
                          <option key={v} value={v}>
                            {r.libelle}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      {l.aliment.nom_unite ? (
                        <select
                          aria-label="Unité"
                          value={l.unite}
                          onChange={(e) => {
                            const unite = e.target.value as Unite;
                            const base = unite === "unite" ? 1 : Math.round(l.qte_base * (l.aliment.poids_unite_g ?? 1));
                            modifier(l.cle, { unite, qte_base: base, pas: unite === "unite" ? 1 : 5, auto: true });
                          }}
                          className="min-h-9 rounded-lg border border-ligne bg-white px-2 text-[13.5px]"
                        >
                          <option value="g">g</option>
                          <option value="unite">{l.aliment.nom_unite}</option>
                        </select>
                      ) : (
                        <span className="px-2 text-texte-2">g</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Nombre label="Quantité de base" valeur={l.qte_base} onChange={(n) => modifier(l.cle, { qte_base: n })} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Nombre label="Minimum" valeur={l.qte_min} desactive={l.role === "fixe"} onChange={(n) => modifier(l.cle, { qte_min: n })} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Nombre label="Maximum" valeur={l.qte_max} desactive={l.role === "fixe"} onChange={(n) => modifier(l.cle, { qte_max: n })} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Nombre label="Pas d’arrondi" valeur={l.pas} desactive={l.role === "fixe"} onChange={(n) => modifier(l.cle, { pas: n })} />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label="Note"
                        value={l.note}
                        maxLength={80}
                        placeholder="cru, mixé…"
                        onChange={(e) => modifier(l.cle, { note: e.target.value })}
                        className="min-h-9 w-28 rounded-lg border border-ligne bg-white px-2 text-[13.5px]"
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button type="button" aria-label="Monter" onClick={() => deplacer(i, -1)} className="px-1 text-texte-2">
                        ▲
                      </button>
                      <button type="button" aria-label="Descendre" onClick={() => deplacer(i, 1)} className="px-1 text-texte-2">
                        ▼
                      </button>
                      <button
                        type="button"
                        aria-label={`Retirer ${l.aliment.nom}`}
                        onClick={() => setLignes((ls) => ls.filter((x) => x.cle !== l.cle))}
                        className="px-1.5 text-texte-2 hover:text-erreur"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <RechercheAliment onChoix={(a) => setLignes((ls) => [...ls, ligneDepuisAliment(a)])} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <ZoneTexte
          label="Étapes (une par ligne)"
          name="etapes"
          defaultValue={recette?.etapes.join("\n")}
          className="[&_textarea]:min-h-40"
        />
        <ZoneTexte label="Astuce de Cindy (facultatif)" name="astuce" maxLength={600} defaultValue={recette?.astuce ?? ""} />
      </div>

      <div className="rounded-xl bg-creme/70 p-4">
        <CaseACocher
          name="publiee"
          label="Visible par les clientes"
          aide="Décoche pour la garder en brouillon."
          defaultChecked={recette?.publiee ?? true}
        />
      </div>

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div className="flex flex-wrap gap-3">
        <BoutonEnvoi enCours="Enregistrement…">{recette ? "Enregistrer" : "Créer la recette"}</BoutonEnvoi>
        {recette && (
          <Bouton
            type="button"
            variante="danger"
            disabled={enSuppression}
            onClick={() => {
              if (confirm(`Supprimer « ${recette.titre} » ?`)) demarrerSuppression(async () => void (await supprimerRecette(recette.id)));
            }}
          >
            Supprimer
          </Bouton>
        )}
      </div>
    </form>
  );
}
