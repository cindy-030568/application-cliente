"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bouton, Etiquette, Message, cx } from "@/components/ui";
import { LIBELLES_REPAS, arrondir, kcalDesMacros, type TypeRepas } from "@/lib/nutrition";
import type { Aliment, CategorieAliment } from "@/lib/types";
import { chercherAliments } from "../../aliments/actions";
import { enregistrerExclusions, enregistrerRepas, type EtatNutrition, type RepasSaisi } from "../nutrition-actions";

type LigneRepas = RepasSaisi & { cle: string };
let n = 0;
const cle = () => `r${++n}`;

function libelleParDefaut(type: TypeRepas, liste: LigneRepas[]): string {
  if (type !== "collation") return LIBELLES_REPAS[type];
  const k = liste.filter((r) => r.type_repas === "collation").length + 1;
  return k === 1 ? "Collation" : `Collation ${k}`;
}

function Gramme({ valeur, onChange, label }: { valeur: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      defaultValue={valeur ? String(valeur).replace(".", ",") : ""}
      onChange={(e) => {
        const v = Number(e.target.value.replace(",", "."));
        onChange(Number.isFinite(v) ? v : 0);
      }}
      className="min-h-10 w-14 rounded-lg border border-ligne bg-white px-1 text-center tabular-nums"
    />
  );
}

export function BlocRepas({ clienteId, initiaux }: { clienteId: string; initiaux: RepasSaisi[] }) {
  const [repas, setRepas] = useState<LigneRepas[]>(() => initiaux.map((r) => ({ ...r, cle: cle() })));
  const [etat, setEtat] = useState<EtatNutrition>({});
  const [enCours, demarrer] = useTransition();
  const modifier = (k: string, c: Partial<RepasSaisi>) => setRepas((rs) => rs.map((r) => (r.cle === k ? { ...r, ...c } : r)));
  const total = repas.reduce(
    (t, r) => ({ p: t.p + r.proteines_g, g: t.g + r.glucides_g, l: t.l + r.lipides_g }),
    { p: 0, g: 0, l: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      {repas.length === 0 && (
        <p className="text-[14px] text-texte-2">
          Ajoute les repas de son plan avec leurs cibles : le moteur adaptera les recettes à chacun.
        </p>
      )}
      {repas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead className="text-left text-[12.5px] text-texte-2">
              <tr>
                <th className="py-2 pr-2 font-medium">Repas</th>
                <th className="px-1 py-2 text-center font-medium">P (g)</th>
                <th className="px-1 py-2 text-center font-medium">G (g)</th>
                <th className="px-1 py-2 text-center font-medium">L (g)</th>
                <th className="px-1 py-2 text-right font-medium">kcal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {repas.map((r) => (
                <tr key={r.cle} className="border-t border-ligne">
                  <td className="py-2 pr-2">
                    <div className="flex flex-col gap-1">
                      <select
                        aria-label="Type de repas"
                        value={r.type_repas}
                        onChange={(e) => modifier(r.cle, { type_repas: e.target.value })}
                        className="min-h-9 w-32 rounded-lg border border-ligne bg-white px-2 text-[13px]"
                      >
                        {Object.entries(LIBELLES_REPAS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="Nom du repas"
                        value={r.libelle}
                        maxLength={40}
                        onChange={(e) => modifier(r.cle, { libelle: e.target.value })}
                        className="min-h-9 w-32 rounded-lg border border-ligne bg-white px-2 text-[14px]"
                      />
                    </div>
                  </td>
                  <td className="px-1 py-2 text-center">
                    <Gramme label="Protéines" valeur={r.proteines_g} onChange={(v) => modifier(r.cle, { proteines_g: v })} />
                  </td>
                  <td className="px-1 py-2 text-center">
                    <Gramme label="Glucides" valeur={r.glucides_g} onChange={(v) => modifier(r.cle, { glucides_g: v })} />
                  </td>
                  <td className="px-1 py-2 text-center">
                    <Gramme label="Lipides" valeur={r.lipides_g} onChange={(v) => modifier(r.cle, { lipides_g: v })} />
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums text-texte-2">
                    {Math.round(kcalDesMacros(r.proteines_g, r.glucides_g, r.lipides_g))}
                  </td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      aria-label={`Retirer ${r.libelle}`}
                      onClick={() => setRepas((rs) => rs.filter((x) => x.cle !== r.cle))}
                      className="px-1 text-texte-2 hover:text-erreur"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-ligne font-medium">
                <td className="py-2">Total de la journée</td>
                <td className="px-1 py-2 text-center tabular-nums">{arrondir(total.p)}</td>
                <td className="px-1 py-2 text-center tabular-nums">{arrondir(total.g)}</td>
                <td className="px-1 py-2 text-center tabular-nums">{arrondir(total.l)}</td>
                <td className="px-1 py-2 text-right tabular-nums">{Math.round(kcalDesMacros(total.p, total.g, total.l))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LIBELLES_REPAS) as TypeRepas[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() =>
              setRepas((rs) => [...rs, { cle: cle(), type_repas: t, libelle: libelleParDefaut(t, rs), proteines_g: 0, glucides_g: 0, lipides_g: 0 }])
            }
            className="rounded-full border border-dashed border-caramel-clair px-3 py-1.5 text-[13.5px] hover:bg-sable/50"
          >
            + {LIBELLES_REPAS[t]}
          </button>
        ))}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <Bouton
          variante="sombre"
          disabled={enCours}
          onClick={() => demarrer(async () => setEtat(await enregistrerRepas(clienteId, repas.map(({ cle: _c, ...r }) => (void _c, r)))))}
        >
          {enCours ? "Enregistrement…" : "Enregistrer les repas"}
        </Bouton>
      </div>
    </div>
  );
}

const PRESETS: { nom: string; categories: string[] }[] = [
  { nom: "Végétarienne", categories: ["Viande", "Porc", "Volaille", "Poisson", "Fruits de mer"] },
  { nom: "Sans porc", categories: ["Porc"] },
  { nom: "Sans lactose", categories: ["Produits laitiers"] },
  { nom: "Sans gluten", categories: ["Gluten"] },
];

export function BlocExclusions({
  clienteId,
  categories,
  categoriesInitiales,
  alimentsInitiaux,
}: {
  clienteId: string;
  categories: CategorieAliment[];
  categoriesInitiales: string[];
  alimentsInitiaux: { id: string; nom: string }[];
}) {
  const [cats, setCats] = useState<Set<string>>(new Set(categoriesInitiales));
  const [alis, setAlis] = useState(alimentsInitiaux);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<Aliment[]>([]);
  const [etat, setEtat] = useState<EtatNutrition>({});
  const [enCours, demarrer] = useTransition();
  const [, chercher] = useTransition();
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);
  const idDe = (nom: string) => categories.find((c) => c.nom === nom)?.id;

  useEffect(() => {
    clearTimeout(minuteur.current);
    if (q.trim().length < 2) return;
    minuteur.current = setTimeout(() => chercher(async () => setResultats(await chercherAliments(q))), 250);
    return () => clearTimeout(minuteur.current);
  }, [q]);

  const basculer = (id: string) =>
    setCats((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-[13px] text-texte-2">Raccourcis :</span>
        {PRESETS.map((p) => (
          <button
            key={p.nom}
            type="button"
            onClick={() => setCats((s) => new Set([...s, ...p.categories.map(idDe).filter((x): x is string => Boolean(x))]))}
            className="rounded-full border border-caramel-clair px-3 py-1.5 text-[13.5px] hover:bg-sable/50"
          >
            {p.nom}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Catégories exclues">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={cats.has(c.id)}
            onClick={() => basculer(c.id)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[14px] transition-colors",
              cats.has(c.id) ? "bg-erreur text-white" : "bg-blanc-casse text-chocolat ring-1 ring-ligne hover:bg-sable",
            )}
          >
            {cats.has(c.id) ? "✕ " : ""}
            {c.nom}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Aliments précis (aversions, allergies particulières…)</span>
        {alis.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alis.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1">
                <Etiquette ton="sombre">{a.nom}</Etiquette>
                <button
                  type="button"
                  aria-label={`Retirer ${a.nom}`}
                  onClick={() => setAlis((l) => l.filter((x) => x.id !== a.id))}
                  className="text-[13px] text-texte-2 hover:text-erreur"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher : coriandre, champignon, avocat…"
            aria-label="Ajouter un aliment exclu"
            className="min-h-11 w-full rounded-xl border border-dashed border-caramel-clair bg-white px-4 text-[15px]"
          />
          {q.trim().length >= 2 && resultats.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ligne bg-white shadow-douce">
              {resultats.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAlis((l) => (l.some((x) => x.id === a.id) ? l : [...l, { id: a.id, nom: a.nom }]));
                      setQ("");
                      setResultats([]);
                    }}
                    className="w-full px-4 py-2 text-left text-[14px] hover:bg-sable/40"
                  >
                    {a.nom}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[12.5px] text-texte-2">
          Un aliment exclu retire toutes les recettes qui le contiennent. Pour exclure « tous les champignons », ajoute chaque
          champignon utilisé dans tes recettes.
        </p>
      </div>

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <Bouton
          variante="sombre"
          disabled={enCours}
          onClick={() => demarrer(async () => setEtat(await enregistrerExclusions(clienteId, [...cats], alis.map((a) => a.id))))}
        >
          {enCours ? "Enregistrement…" : "Enregistrer les exclusions"}
        </Bouton>
      </div>
    </div>
  );
}
