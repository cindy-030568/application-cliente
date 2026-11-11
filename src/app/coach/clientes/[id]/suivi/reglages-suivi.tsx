"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Champ, Message } from "@/components/ui";
import { reglerSuivi } from "../../suivi-actions";

export function ReglagesSuivi({
  clienteId,
  sansChiffres,
  masquerPoids,
  rdv,
  lienRdv,
}: {
  clienteId: string;
  sansChiffres: boolean;
  masquerPoids: boolean;
  rdv: string;
  lienRdv: string;
}) {
  const [etat, envoyer] = useActionState(reglerSuivi.bind(null, clienteId), {});
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <CaseACocher
        name="mode_sans_chiffres"
        label="Mode sans chiffres"
        aide="Ni poids, ni mensurations, ni photos : seulement ses ressentis."
        defaultChecked={sansChiffres}
      />
      <CaseACocher
        name="masquer_graph_poids"
        label="Masquer le graphique du poids"
        aide="Les autres graphiques restent visibles."
        defaultChecked={masquerPoids}
      />
      <hr className="border-ligne" />
      <Champ label="Prochain rendez-vous" name="prochain_rdv" type="datetime-local" defaultValue={rdv} />
      <Champ
        label="Lien de visio (facultatif)"
        name="lien_rdv"
        type="url"
        placeholder="https://meet.google.com/…"
        defaultValue={lienRdv}
        aide="Affiché sur son accueil avec un bouton « Rejoindre »."
      />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <BoutonEnvoi variante="sombre">Enregistrer</BoutonEnvoi>
      </div>
    </form>
  );
}
