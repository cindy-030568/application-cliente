"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton, CaseACocher, Champ, Message, ZoneTexte, cx } from "@/components/ui";
import { TYPES_DEFI, maxObjectif, objectifParDefaut, texteObjectif, textePeriode, typeDefi, unite, type Defi, type TypeDefi } from "@/lib/defis";
import { enregistrerDefi, publierDefi, supprimerDefi, type EtatDefi } from "./actions";

/** Création ou modification d'un défi du mois, avec l'aperçu de la règle telle que la verront tes clientes. */
export function FormulaireDefi({
  initial,
  periode,
  communauteOuverte,
  aujourdhui,
}: {
  initial?: Defi;
  periode: { debut: string; fin: string };
  communauteOuverte: boolean;
  aujourdhui: string;
}) {
  const router = useRouter();
  const [etat, envoyer, enCours] = useActionState<EtatDefi, FormData>(async (avant, fd) => {
    const r = await enregistrerDefi(initial?.id ?? null, avant, fd);
    if (r.succes && !initial && r.id) router.push(`/coach/defis/${r.id}`);
    return r;
  }, {});
  const [type, setType] = useState<TypeDefi>(initial?.type ?? "pas");
  const [seuil, setSeuil] = useState(String(initial?.seuil ?? typeDefi("pas").defaut ?? ""));
  const [debut, setDebut] = useState(initial?.debut ?? periode.debut);
  const [fin, setFin] = useState(initial?.fin ?? periode.fin);
  // L'objectif suit les dates et le type tant que la coach ne l'a pas changé elle-même.
  const [objectifChoisi, setObjectifChoisi] = useState<string | null>(initial ? String(initial.objectif) : null);
  const t = typeDefi(type);
  const datesOk = /^\d{4}-\d{2}-\d{2}$/.test(debut) && /^\d{4}-\d{2}-\d{2}$/.test(fin) && fin >= debut;
  const max = datesOk ? maxObjectif({ type, debut, fin }) : 0;
  const objectif = objectifChoisi ?? (datesOk && max > 0 ? String(objectifParDefaut({ type, debut, fin })) : "");
  const seuilNombre = Number(seuil.replace(",", ".").replace(/\s/g, ""));
  const apercu =
    datesOk && Number(objectif) >= 1 && (!t.seuil || seuilNombre > 0)
      ? `${texteObjectif({ type, seuil: t.seuil ? seuilNombre : null, objectif: Number(objectif), debut, fin })}, ${textePeriode({ debut, fin })}.`
      : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => envoyer(fd));
      }}
      className="flex flex-col gap-5"
    >
      <Champ label="Titre" name="titre" required maxLength={100} defaultValue={initial?.titre} placeholder="ex. Décembre en mouvement" aide="Visible par toutes : évite d’y mettre des chiffres, certaines clientes sont en mode sans chiffres." />
      <ZoneTexte
        label="Ton petit mot (facultatif)"
        name="description"
        maxLength={500}
        defaultValue={initial?.description ?? ""}
        placeholder="ex. Ce mois-ci, on bouge un peu plus chaque jour, ensemble. Une marche après le déjeuner, les escaliers plutôt que l’ascenseur…"
        className="[&_textarea]:min-h-24"
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Type de défi</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES_DEFI.map((x) => (
            <label key={x.code} className={cx("cursor-pointer rounded-full px-4 py-2 text-[14px]", type === x.code ? "bg-chocolat text-creme" : "bg-creme hover:bg-sable")}>
              <input
                type="radio"
                name="type"
                value={x.code}
                checked={type === x.code}
                onChange={() => {
                  setType(x.code);
                  setSeuil(String(x.defaut ?? ""));
                  setObjectifChoisi(null);
                }}
                className="sr-only"
              />
              {x.emoji} {x.libelle}
            </label>
          ))}
        </div>
        <span className="text-[12.5px] text-texte-2">
          {type === "seances"
            ? "Séances du programme et séances express comptent. Les semaines démarrent le premier jour du défi."
            : type === "journal"
              ? "Un jour compte dès que la journée est remplie dans le journal."
              : "Compté à partir de ce que ta cliente note dans son journal."}
        </span>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {t.seuil && (
          <Champ
            key={type}
            label={t.seuil}
            name="seuil"
            inputMode="decimal"
            required
            value={seuil}
            onChange={(e) => setSeuil(e.target.value)}
          />
        )}
        <Champ
          label={`Nombre de ${unite(type, 2)} à réussir`}
          name="objectif"
          type="number"
          min={1}
          max={max || undefined}
          required
          value={objectif}
          onChange={(e) => setObjectifChoisi(e.target.value)}
          aide={datesOk ? `Ce défi compte ${max} ${unite(type, max)}.` : undefined}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ label="Début" name="debut" type="date" required value={debut} onChange={(e) => setDebut(e.target.value)} />
        <Champ label="Fin" name="fin" type="date" required value={fin} min={debut} onChange={(e) => setFin(e.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Pour qui ?</legend>
        <div className="flex flex-wrap gap-2">
          {(["toutes", "communaute"] as const).map((a) => (
            <label key={a} className="cursor-pointer">
              <input type="radio" name="audience" value={a} defaultChecked={(initial?.audience ?? "toutes") === a} className="peer sr-only" />
              <span className="inline-flex rounded-full bg-creme px-4 py-2 text-[14px] hover:bg-sable peer-checked:bg-chocolat peer-checked:text-creme peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                {a === "toutes" ? "Toutes mes clientes en suivi" : "Les membres de la communauté"}
              </span>
            </label>
          ))}
        </div>
        {!communauteOuverte && <span className="text-[12.5px] text-texte-2">La communauté est fermée : un défi « communauté » ne sera vu par personne, et aucun prénom ne sera fêté.</span>}
      </fieldset>
      {datesOk && debut > aujourdhui && (
        <Message ton="info">
          Ce défi commence dans le futur : tes clientes le verront sur leur accueil (« Il commence le … »), et pourront le relever à partir de ce jour-là. Pour un test, mets la date de début à aujourd’hui.
        </Message>
      )}
      {apercu && (
        <div className="rounded-xl bg-creme/70 p-4">
          <p className="text-[12.5px] font-medium uppercase tracking-[0.1em] text-caramel-texte">Ce que verront tes clientes</p>
          <p className="mt-1 text-[15.5px]">
            {t.emoji} {apercu}
          </p>
        </div>
      )}
      {!initial && <CaseACocher name="publie" label="Publié tout de suite (sinon, il reste en brouillon)" aide="Tes clientes reçoivent une petite notification le jour où il commence." />}
      {initial && <p className="text-[13px] text-texte-2">Changer la règle ou les dates change la progression de toutes les participantes.</p>}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <Bouton type="submit" disabled={enCours} className="w-fit">
        {enCours ? "Enregistrement…" : initial ? "Enregistrer" : "Créer le défi"}
      </Bouton>
    </form>
  );
}

export function ActionsDefi({ id, publie }: { id: string; publie: boolean }) {
  const [etat, setEtat] = useState<EtatDefi>({});
  const [enCours, demarrer] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Bouton variante="contour" disabled={enCours} onClick={() => demarrer(async () => setEtat(await publierDefi(id, !publie)))}>
        {publie ? "Repasser en brouillon" : "Publier"}
      </Bouton>
      <Bouton
        variante="discret"
        disabled={enCours}
        onClick={() => {
          if (window.confirm("Supprimer ce défi ? Les participations et les progrès de tes clientes sur ce défi seront effacés."))
            demarrer(async () => {
              const r = await supprimerDefi(id);
              if (r.erreur) setEtat(r);
              else router.push("/coach/defis");
            });
        }}
      >
        Supprimer
      </Bouton>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
    </div>
  );
}
