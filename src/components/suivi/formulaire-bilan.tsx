"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { IconePlus } from "@/components/icones";
import { Bouton, Champ, Message, ZoneTexte, cx } from "@/components/ui";
import { libelleChamp, parSection } from "@/lib/champs";
import { compresserPhoto } from "@/lib/image";
import { clientDepot } from "@/lib/supabase/navigateur";
import { ANGLES, type AnglePhoto, type ChampMesure } from "@/lib/types";
import {
  confirmerPhoto,
  enregistrerBilan,
  preparerDepotPhoto,
  supprimerPhoto,
} from "@/app/suivi-actions";

type EtatPhoto = { apercu: string | null; fichier: Blob | null; supprimer: boolean };

const classeSaisie =
  "w-full rounded-xl border border-ligne bg-white px-4 text-[16px] text-chocolat focus:border-chocolat focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent-pale";

export function FormulaireBilan({
  champs,
  jours,
  intro,
  valeursInitiales = {},
  precisionsInitiales = {},
  photosInitiales = {},
  bilanId = null,
  clienteCible = null,
  dateInitiale,
  dateMax,
  commentaireInitial = "",
  avecCommentaire = false,
  sansPhotos = false,
  redirection,
  libelleEnvoi,
  libelleCommentaire = "Un mot pour Cindy (facultatif)",
}: {
  champs: ChampMesure[];
  /** Rythme de bilan de la cliente, pour les libellés contenant {jours}. */
  jours: number;
  intro?: string;
  valeursInitiales?: Record<string, string>;
  precisionsInitiales?: Record<string, string>;
  photosInitiales?: Partial<Record<AnglePhoto, string>>;
  bilanId?: string | null;
  clienteCible?: string | null;
  dateInitiale: string;
  dateMax: string;
  commentaireInitial?: string;
  avecCommentaire?: boolean;
  sansPhotos?: boolean;
  /** Adresse après l'envoi ; « {id} » est remplacé par l'identifiant du bilan. */
  redirection: string;
  libelleEnvoi: string;
  libelleCommentaire?: string;
}) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState<Record<string, string>>(valeursInitiales);
  const [precisions, setPrecisions] = useState<Record<string, string>>(precisionsInitiales);
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(precisionsInitiales).map((k) => [k, true])),
  );
  const [photos, setPhotos] = useState<Record<AnglePhoto, EtatPhoto>>(() => ({
    face: { apercu: photosInitiales.face ?? null, fichier: null, supprimer: false },
    profil: { apercu: photosInitiales.profil ?? null, fichier: null, supprimer: false },
    dos: { apercu: photosInitiales.dos ?? null, fichier: null, supprimer: false },
  }));
  const [erreur, setErreur] = useState<string>();
  const [etape, setEtape] = useState<string>();
  const [enCours, demarrer] = useTransition();

  useEffect(
    () => () => {
      Object.values(photos).forEach((p) => p.fichier && p.apercu && URL.revokeObjectURL(p.apercu));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sections = parSection(champs);
  const aDesMesures = champs.some((c) => c.groupe === "mesure");
  const definir = (id: string, v: string) => setValeurs((x) => ({ ...x, [id]: v }));

  async function choisirPhoto(angle: AnglePhoto, fichier: File | undefined) {
    if (!fichier) return;
    setErreur(undefined);
    try {
      const blob = await compresserPhoto(fichier);
      setPhotos((p) => ({ ...p, [angle]: { apercu: URL.createObjectURL(blob), fichier: blob, supprimer: false } }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Cette photo ne peut pas être utilisée.");
    }
  }

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("champs_presentes", champs.map((c) => c.id).join(","));
    for (const [id, v] of Object.entries(valeurs)) fd.set(`champ_${id}`, v);
    for (const [id, v] of Object.entries(precisions)) fd.set(`precision_${id}`, v);
    demarrer(async () => {
      setErreur(undefined);
      setEtape("Enregistrement…");
      const r = await enregistrerBilan(clienteCible, bilanId, {}, fd);
      if (r.erreur || !r.bilanId) {
        setEtape(undefined);
        setErreur(r.erreur ?? "Le bilan n’a pas pu être enregistré.");
        return;
      }
      const id = r.bilanId;
      if (!sansPhotos) {
        for (const { valeur: angle, libelle } of ANGLES) {
          const p = photos[angle];
          if (p.fichier) {
            setEtape(`Envoi de la photo « ${libelle} »…`);
            const prep = await preparerDepotPhoto(id, angle);
            const depot =
              prep.chemin && prep.jeton
                ? await clientDepot()
                    .storage.from("photos")
                    .uploadToSignedUrl(prep.chemin, prep.jeton, p.fichier, { contentType: "image/jpeg" })
                : { error: true };
            const conf =
              !depot.error && prep.chemin ? await confirmerPhoto(id, angle, prep.chemin) : { erreur: "x" };
            if (conf.erreur) {
              setEtape(undefined);
              setErreur(
                `Ton bilan est enregistré, mais la photo « ${libelle} » n’a pas pu partir. Réessaie en modifiant ton bilan.`,
              );
              router.push(redirection.replace("{id}", id));
              return;
            }
          } else if (p.supprimer) {
            await supprimerPhoto(id, angle);
          }
        }
      }
      router.push(redirection.replace("{id}", id));
      router.refresh();
    });
  }

  function precision(c: ChampMesure) {
    if (!c.avec_precision) return null;
    if (!ouvertes[c.id]) {
      return (
        <button
          type="button"
          onClick={() => setOuvertes((o) => ({ ...o, [c.id]: true }))}
          className="self-start text-[13.5px] text-texte-2 underline underline-offset-4 hover:text-chocolat"
        >
          + Préciser si tu veux
        </button>
      );
    }
    return (
      <textarea
        aria-label={`Précision : ${libelleChamp(c, jours)}`}
        value={precisions[c.id] ?? ""}
        onChange={(e) => setPrecisions((p) => ({ ...p, [c.id]: e.target.value }))}
        maxLength={1000}
        rows={2}
        placeholder="Quelques mots si tu veux…"
        className={cx(classeSaisie, "py-3")}
      />
    );
  }

  function question(c: ChampMesure) {
    const libelle = libelleChamp(c, jours);
    if (c.type === "texte") {
      return (
        <div key={c.id} className="flex flex-col gap-2">
          <label htmlFor={`champ_${c.id}`} className="text-[15px] font-medium">
            {libelle}
          </label>
          {c.aide && <p className="-mt-1 text-[12.5px] text-texte-2">{c.aide}</p>}
          <textarea
            id={`champ_${c.id}`}
            value={valeurs[c.id] ?? ""}
            onChange={(e) => definir(c.id, e.target.value)}
            maxLength={2000}
            rows={3}
            className={cx(classeSaisie, "min-h-24 py-3")}
          />
        </div>
      );
    }
    if (c.type === "nombre") {
      return (
        <div key={c.id} className="flex flex-col gap-1.5">
          <label htmlFor={`champ_${c.id}`} className="text-sm font-medium">
            {libelle}
          </label>
          <div className="relative">
            <input
              id={`champ_${c.id}`}
              inputMode="decimal"
              autoComplete="off"
              value={valeurs[c.id] ?? ""}
              onChange={(e) => definir(c.id, e.target.value.replace(/[^0-9.,]/g, ""))}
              className={cx(classeSaisie, "min-h-12 pr-12")}
            />
            {c.unite && (
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-texte-2">
                {c.unite}
              </span>
            )}
          </div>
          {c.aide && <p className="text-[12px] leading-snug text-texte-2">{c.aide}</p>}
        </div>
      );
    }
    return (
      <div key={c.id} className="flex flex-col gap-2" role="group" aria-labelledby={`titre_${c.id}`}>
        <div>
          <p id={`titre_${c.id}`} className="text-[15px] font-medium">
            {libelle}
          </p>
          {c.aide && <p className="text-[12.5px] text-texte-2">{c.aide}</p>}
        </div>
        {c.type === "echelle" ? (
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={valeurs[c.id] === n}
                aria-label={`${libelle} : ${n} sur 10`}
                onClick={() => definir(c.id, valeurs[c.id] === n ? "" : n)}
                className={cx(
                  "flex h-10 items-center justify-center rounded-lg text-[14px] transition-colors",
                  valeurs[c.id] === n ? "bg-accent font-medium text-white" : "bg-white text-chocolat hover:bg-accent-pale",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(c.options ?? []).map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={valeurs[c.id] === o}
                onClick={() => definir(c.id, valeurs[c.id] === o ? "" : o)}
                className={cx(
                  "rounded-full px-4 py-2 text-[14px] transition-colors",
                  valeurs[c.id] === o ? "bg-chocolat text-creme" : "bg-white text-chocolat hover:bg-sable",
                )}
              >
                {o}
              </button>
            ))}
          </div>
        )}
        {precision(c)}
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-8">
      {intro && (
        <p className="rounded-bloc bg-blanc-casse px-5 py-4 text-[15px] leading-relaxed text-texte-2 shadow-douce">
          {intro}
        </p>
      )}

      <Champ label="Date du bilan" name="date_mesure" type="date" required defaultValue={dateInitiale} max={dateMax} />

      {sections.map(({ section, champs: liste }) => {
        const mesures = liste.every((c) => c.groupe === "mesure");
        return (
          <fieldset key={section} className="flex flex-col gap-5">
            <legend className="mb-1 font-titre text-[22px] font-bold">{section}</legend>
            {mesures && (
              <p className="-mt-3 text-[14px] text-texte-2">Remplis ce que tu as pu mesurer, le reste peut rester vide.</p>
            )}
            <div className={cx(mesures ? "grid grid-cols-2 gap-3" : "flex flex-col gap-6")}>{liste.map(question)}</div>
          </fieldset>
        );
      })}

      {!sansPhotos && aDesMesures && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-titre text-[22px] font-bold">Mes photos</legend>
          <p className="-mt-2 text-[14px] text-texte-2">Facultatif. Visibles uniquement par toi et Cindy.</p>
          <div className="grid grid-cols-3 gap-3">
            {ANGLES.map(({ valeur: angle, libelle }) => {
              const p = photos[angle];
              const visible = p.apercu && !p.supprimer;
              return (
                <div key={angle} className="flex flex-col gap-1.5">
                  <label
                    className={cx(
                      "relative flex aspect-[3/4] cursor-pointer items-center justify-center overflow-hidden rounded-xl",
                      visible ? "bg-sable" : "border border-dashed border-caramel-clair bg-white text-texte-2",
                    )}
                  >
                    {visible ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.apercu!} alt={`Photo ${libelle}`} className="size-full object-cover" />
                    ) : (
                      <IconePlus className="size-6" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => choisirPhoto(angle, e.target.files?.[0])}
                    />
                  </label>
                  <div className="flex items-center justify-between text-[13px]">
                    <span>{libelle}</span>
                    {visible && (
                      <button
                        type="button"
                        className="text-texte-2 underline underline-offset-2"
                        onClick={() =>
                          setPhotos((x) => ({ ...x, [angle]: { apercu: x[angle].apercu, fichier: null, supprimer: true } }))
                        }
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {avecCommentaire && (
        <ZoneTexte
          label={libelleCommentaire}
          name="commentaire"
          maxLength={3000}
          defaultValue={commentaireInitial}
          placeholder="Une remarque, une question…"
        />
      )}

      {erreur && <Message ton="erreur">{erreur}</Message>}
      <Bouton type="submit" pleineLargeur disabled={enCours}>
        {etape ?? libelleEnvoi}
      </Bouton>
    </form>
  );
}
