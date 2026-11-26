"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Bouton, Carte, Message, ZoneTexte, cx } from "@/components/ui";
import { JOURS_SEMAINE, LIBELLES_REPAS_MENU, REPAS_MENU, type CaseMenu, type RepasMenu } from "@/lib/menus";
import { choisirRecetteMenu, enregistrerTextesMenu, proposerEtapesBatch, proposerMenuSemaine, publierMenu, type EtatMenu } from "../actions";

type RecetteChoix = { id: string; titre: string; repas: string[] };

/** La grille du menu (7 jours × 4 repas), ton mot, le batch cooking, la publication. */
export function EditeurMenu({
  lundi,
  publie,
  mot,
  batch: batchInitial,
  cases: casesInitiales,
  recettes,
}: {
  lundi: string;
  publie: boolean;
  mot: string;
  batch: string;
  cases: CaseMenu[];
  recettes: RecetteChoix[];
}) {
  const [cases, setCases] = useState(() => new Map(casesInitiales.map((c) => [`${c.jour}|${c.repas}`, c.recette_id])));
  const [etat, setEtat] = useState<EtatMenu>({});
  const [enCours, demarrer] = useTransition();
  const [batch, setBatch] = useState(batchInitial);
  const [etatTextes, envoyerTextes, enregistrement] = useActionState(enregistrerTextesMenu.bind(null, lundi), {});
  // Après une nouvelle proposition, la page est rechargée : on repart de ses cases.
  const [vues, setVues] = useState(casesInitiales);
  if (vues !== casesInitiales) {
    setVues(casesInitiales);
    setCases(new Map(casesInitiales.map((c) => [`${c.jour}|${c.repas}`, c.recette_id])));
  }

  const lancer = (f: () => Promise<EtatMenu>) =>
    demarrer(async () => {
      setEtat({});
      const r = await f();
      if (r.batch !== undefined) setBatch(r.batch);
      setEtat(r);
    });

  const choisir = (jour: number, repas: RepasMenu, id: string) => {
    const cle = `${jour}|${repas}`;
    const avant = cases.get(cle);
    setCases((m) => {
      const n = new Map(m);
      if (id) n.set(cle, id);
      else n.delete(cle);
      return n;
    });
    demarrer(async () => {
      const r = await choisirRecetteMenu(lundi, jour, repas, id || null);
      if (r.erreur) {
        setEtat(r);
        setCases((m) => {
          const n = new Map(m);
          if (avant) n.set(cle, avant);
          else n.delete(cle);
          return n;
        });
      }
    });
  };

  const titre = new Map(recettes.map((r) => [r.id, r.titre]));
  const remplies = cases.size;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Bouton type="button" disabled={enCours} onClick={() => lancer(() => proposerMenuSemaine(lundi, "vides"))}>
          ✨ {remplies ? "Compléter les cases vides" : "Proposer le menu"}
        </Bouton>
        {remplies > 0 && (
          <Bouton
            type="button"
            variante="contour"
            disabled={enCours}
            onClick={() => {
              if (window.confirm("Reproposer tout le menu ? Tes choix de la semaine seront remplacés.")) lancer(() => proposerMenuSemaine(lundi, "tout"));
            }}
          >
            Tout reproposer
          </Bouton>
        )}
        <span className="text-[14px] text-texte-2">{remplies} repas sur 28</span>
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}

      <div className="overflow-x-auto rounded-carte bg-blanc-casse shadow-douce">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="w-28 p-3" />
              {REPAS_MENU.map((repas) => (
                <th key={repas} scope="col" className="p-3 text-left font-titre text-[15px] font-bold">
                  {LIBELLES_REPAS_MENU[repas]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {JOURS_SEMAINE.map((j, i) => (
              <tr key={j} className="border-t border-ligne align-top">
                <th scope="row" className="p-3 text-left font-medium">
                  {j}
                </th>
                {REPAS_MENU.map((repas) => {
                  const choix = recettes.filter((r) => r.repas.includes(repas));
                  const id = cases.get(`${i + 1}|${repas}`) ?? "";
                  return (
                    <td key={repas} className="p-1.5">
                      <select
                        aria-label={`${j}, ${LIBELLES_REPAS_MENU[repas]}`}
                        title={id ? titre.get(id) : undefined}
                        value={id}
                        onChange={(e) => choisir(i + 1, repas, e.target.value)}
                        className={cx("w-full rounded-lg border border-ligne bg-white px-2 py-2 text-[13px] leading-snug", !id && "text-texte-2")}
                      >
                        <option value="">—</option>
                        {/* Une recette choisie qui n'est plus proposée pour ce repas reste affichée. */}
                        {id && !choix.some((r) => r.id === id) && <option value={id}>{titre.get(id) ?? "Recette retirée"}</option>}
                        {choix.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.titre}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={envoyerTextes} className="grid gap-5 lg:grid-cols-2">
        <Carte className="flex flex-col gap-3">
          <h2 className="font-titre text-xl font-bold">Mon mot de la semaine</h2>
          <ZoneTexte
            label="Ce que tu veux leur dire (facultatif)"
            name="mot"
            maxLength={1000}
            defaultValue={mot}
            placeholder="Cette semaine, on mise sur les légumes de saison…"
          />
        </Carte>
        <Carte className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-titre text-xl font-bold">Batch cooking du dimanche</h2>
            <Bouton type="button" variante="discret" disabled={enCours} onClick={() => lancer(() => proposerEtapesBatch(lundi))}>
              ✨ Proposer les étapes
            </Bouton>
          </div>
          <ZoneTexte
            label="Une étape par ligne"
            name="batch"
            maxLength={4000}
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="[&_textarea]:min-h-48"
          />
          <p className="text-[12.5px] text-texte-2">La proposition part des déjeuners et dîners du menu : relis-la et écris-la à ta façon, puis enregistre.</p>
        </Carte>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <Bouton type="submit" variante="contour" disabled={enregistrement}>
            {enregistrement ? "Enregistrement…" : "Enregistrer le mot et le batch"}
          </Bouton>
          {etatTextes.erreur && <Message ton="erreur">{etatTextes.erreur}</Message>}
          {etatTextes.succes && <Message ton="succes">{etatTextes.succes}</Message>}
        </div>
      </form>

      <Carte className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-[14.5px] text-texte-2">
          {publie
            ? "Ce menu est publié : tes abonnées le voient dans « Recettes → Mon menu », avec la liste de courses et le batch cooking."
            : "Publie le menu quand il te plaît. Le dimanche, tes abonnées reçoivent une notification : leur menu et leur batch cooking sont prêts."}
        </p>
        <div className="flex gap-3">
          <Link href="/coach/menus" className="self-center text-[14px] text-texte-2 underline underline-offset-4">
            Retour
          </Link>
          <Bouton type="button" variante={publie ? "contour" : "principal"} disabled={enCours} onClick={() => lancer(() => publierMenu(lundi, !publie))}>
            {publie ? "Repasser en brouillon" : "Publier le menu"}
          </Bouton>
        </div>
      </Carte>
    </div>
  );
}
