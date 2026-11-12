"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, CaseACocher, Champ, Message, ZoneTexte } from "@/components/ui";
import { FAMILLES, type FiltreVideo, type Video } from "@/lib/types";
import { idYoutube, urlMiniature } from "@/lib/youtube";
import { enregistrerVideo, supprimerVideo } from "./actions";

export function FormulaireVideo({ filtres, video }: { filtres: FiltreVideo[]; video?: Video }) {
  const [etat, envoyer] = useActionState(enregistrerVideo.bind(null, video?.id ?? null), {});
  const [lien, setLien] = useState(video ? `https://youtu.be/${video.youtube_id}` : "");
  const [enSuppression, demarrer] = useTransition();
  const [erreurSuppression, setErreurSuppression] = useState<string>();
  const id = idYoutube(lien);

  return (
    <form action={envoyer} className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-4">
          <Champ label="Nom de l’exercice" name="titre" required maxLength={120} defaultValue={video?.titre} />
          <Champ
            label="Lien de la vidéo YouTube"
            name="lien"
            required
            value={lien}
            onChange={(e) => setLien(e.target.value)}
            placeholder="https://youtu.be/…"
            aide="Sur YouTube : Partager → Copier. Mets la vidéo en « Non répertoriée » (pas « Privée »)."
            erreur={lien && !id ? "Lien non reconnu" : undefined}
          />
        </div>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-sable text-[13px] text-texte-2 md:mt-7">
          {id ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlMiniature(id, "mq")} alt="Aperçu de la vidéo" className="size-full object-cover" />
          ) : (
            "Aperçu"
          )}
        </div>
      </div>

      <ZoneTexte
        label="Présentation courte (facultatif)"
        name="description"
        maxLength={600}
        defaultValue={video?.description ?? ""}
        className="[&_textarea]:min-h-20"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ZoneTexte
          label="Points clés (un par ligne)"
          name="points_cles"
          defaultValue={video?.points_cles.join("\n")}
          placeholder={"Pieds à largeur de hanches\nMenton rentré\nExpire en poussant"}
        />
        <ZoneTexte
          label="Erreurs fréquentes (une par ligne)"
          name="erreurs"
          defaultValue={video?.erreurs.join("\n")}
          placeholder={"Genoux qui rentrent\nDos qui s’arrondit"}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {FAMILLES.map(({ valeur, libelle }) => (
          <fieldset key={valeur} className="flex flex-col gap-2.5">
            <legend className="mb-1 text-sm font-medium">{libelle}</legend>
            {filtres
              .filter((f) => f.famille === valeur)
              .map((f) => (
                <CaseACocher
                  key={f.id}
                  name="filtres"
                  value={f.id}
                  label={f.nom}
                  defaultChecked={video?.filtres.includes(f.id)}
                />
              ))}
          </fieldset>
        ))}
      </div>

      <div className="rounded-xl bg-creme/70 p-4">
        <CaseACocher
          name="publiee"
          label="Visible par les clientes"
          aide="Décoche pour la préparer en brouillon."
          defaultChecked={video?.publiee ?? true}
        />
      </div>

      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      {erreurSuppression && <Message ton="erreur">{erreurSuppression}</Message>}
      <div className="flex flex-wrap items-center gap-3">
        <BoutonEnvoi enCours="Enregistrement…">{video ? "Enregistrer" : "Ajouter la vidéo"}</BoutonEnvoi>
        {video && (
          <Bouton
            type="button"
            variante="danger"
            disabled={enSuppression}
            onClick={() => {
              if (confirm(`Supprimer « ${video.titre} » de la bibliothèque ?`))
                demarrer(async () => setErreurSuppression((await supprimerVideo(video.id))?.erreur));
            }}
          >
            Supprimer
          </Bouton>
        )}
      </div>
    </form>
  );
}
