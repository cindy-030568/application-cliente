"use client";

import { useActionState } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { CaseACocher, Champ, Message, ZoneTexte } from "@/components/ui";
import { enregistrerOffre, type EtatOffre } from "./actions";

export type ValeursOffre = { actif: boolean; titre: string; texte: string; prixMensuel: string | null; prixAnnuel: string | null; lienCgv: string | null };

export function FormulaireOffre({ v, prixLus }: { v: ValeursOffre; prixLus: { mensuel: string | null; annuel: string | null } }) {
  const [etat, envoyer] = useActionState<EtatOffre, FormData>(enregistrerOffre, {});
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <Champ label="Titre de l’offre" name="titre" required maxLength={120} defaultValue={v.titre} />
      <ZoneTexte label="Ton texte de présentation" name="texte" maxLength={1500} defaultValue={v.texte} className="[&_textarea]:min-h-28" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ
          label="Prix mensuel (identifiant Stripe)"
          name="prix_mensuel"
          defaultValue={v.prixMensuel ?? ""}
          placeholder="price_…"
          aide={v.prixMensuel ? (prixLus.mensuel ? `✓ ${prixLus.mensuel}` : "⚠️ Prix introuvable dans Stripe (ou clé absente)") : "Laisse vide si tu ne proposes pas de formule au mois."}
        />
        <Champ
          label="Prix annuel (identifiant Stripe)"
          name="prix_annuel"
          defaultValue={v.prixAnnuel ?? ""}
          placeholder="price_…"
          aide={v.prixAnnuel ? (prixLus.annuel ? `✓ ${prixLus.annuel}` : "⚠️ Prix introuvable dans Stripe (ou clé absente)") : "Laisse vide si tu ne proposes pas de formule à l’année."}
        />
      </div>
      <Champ label="Lien de tes conditions de vente" name="lien_cgv" type="url" defaultValue={v.lienCgv ?? ""} placeholder="https://…" aide="Une page (Google Docs publié, Notion, ton site) avec tes conditions de vente pour l’abonnement." />
      <CaseACocher name="actif" label="Inscriptions ouvertes : la page publique accepte les nouvelles abonnées" defaultChecked={v.actif} />
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <BoutonEnvoi className="w-fit">Enregistrer</BoutonEnvoi>
    </form>
  );
}
