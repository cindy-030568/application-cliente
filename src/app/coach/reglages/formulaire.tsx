"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Champ, Message } from "@/components/ui";
import type { Reglages } from "@/lib/types";
import { enregistrerReglages } from "./actions";

export function FormulaireReglages({ reglages }: { reglages: Reglages }) {
  const [etat, envoyer] = useActionState(enregistrerReglages, {});
  return (
    <form action={envoyer} className="flex flex-col gap-5">
      <Champ
        label="Lien de la formation (Notion)"
        name="lien_formation"
        type="url"
        placeholder="https://www.notion.so/…"
        defaultValue={reglages.lien_formation ?? ""}
        aide="Un seul lien pour toutes les clientes qui ont l’accès formation."
      />
      <Champ
        label="Message de la carte Formation verrouillée"
        name="message_formation"
        required
        maxLength={300}
        defaultValue={reglages.message_formation}
      />
      <Champ
        label="Lien « En parler avec Cindy »"
        name="lien_contact"
        type="url"
        placeholder="https://wa.me/33… ou https://instagram.com/fitw_cindy"
        defaultValue={reglages.lien_contact ?? ""}
      />
      <Champ
        label="Lien de ta politique de confidentialité"
        name="lien_politique"
        type="url"
        placeholder="https://ton-site.fr/confidentialite"
        defaultValue={reglages.lien_politique ?? ""}
        aide="Affiché sur l’écran de consentement et dans le profil des clientes."
      />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <div>
        <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
      </div>
    </form>
  );
}
