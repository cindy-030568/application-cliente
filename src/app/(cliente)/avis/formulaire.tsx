"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, Message, cx } from "@/components/ui";
import { changerPublication, laisserAvis, supprimerAvis, type EtatAvis } from "@/app/avis-actions";
import { LIBELLE_NOM_AFFICHE, type NomAffiche } from "@/lib/parrainage";

const NOMS: NomAffiche[] = ["prenom", "initiale", "anonyme"];

function ChoixNom({ prenom, valeur, onChange, nom = "nom_affiche" }: { prenom: string; valeur: NomAffiche | null; onChange: (n: NomAffiche) => void; nom?: string }) {
  const exemple: Record<NomAffiche, string> = { prenom: prenom || "Ton prénom", initiale: prenom ? `${prenom[0].toUpperCase()}.` : "L.", anonyme: "Une cliente de Cindy" };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Sous quel nom ?</legend>
      <div className="flex flex-wrap gap-2">
        {NOMS.map((n) => (
          <label key={n} className={cx("cursor-pointer rounded-full border px-4 py-2 text-[14px]", valeur === n ? "border-chocolat bg-chocolat text-creme" : "border-ligne bg-white")}>
            <input type="radio" name={nom} value={n} checked={valeur === n} onChange={() => onChange(n)} className="sr-only" />
            {LIBELLE_NOM_AFFICHE[n]} <span className="opacity-70">({exemple[n]})</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Nouveau témoignage : le texte, puis une case SÉPARÉE pour autoriser la publication. */
export function FormulaireAvis({ prenom, contexte }: { prenom: string; contexte: string }) {
  const [etat, envoyer] = useActionState<EtatAvis, FormData>(laisserAvis, {});
  const [publiable, setPubliable] = useState(false);
  const [nom, setNom] = useState<NomAffiche | null>(null);
  if (etat.succes) return <Message ton="succes">{etat.succes}</Message>;
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <input type="hidden" name="contexte" value={contexte} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Ton témoignage</span>
        <textarea
          name="texte"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          placeholder="Ce que l’accompagnement t’a apporté, ce qui a changé pour toi, ce que tu dirais à une amie qui hésite…"
          className="rounded-xl border border-ligne bg-white px-4 py-3 text-[16px] focus:border-chocolat focus:outline-none focus:ring-2 focus:ring-accent-pale"
        />
      </label>
      <div className="flex flex-col gap-3 rounded-xl bg-sable/50 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="publiable" checked={publiable} onChange={(e) => setPubliable(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
          <span className="flex flex-col">
            <span className="text-[15px] font-medium">J’autorise Cindy à publier mon témoignage</span>
            <span className="text-[13px] text-texte-2">Sur son site ou ses réseaux. Facultatif : sans cette case, il reste entre vous. Tu peux changer d’avis à tout moment.</span>
          </span>
        </label>
        {publiable && <ChoixNom prenom={prenom} valeur={nom} onChange={setNom} />}
      </div>
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      <BoutonEnvoi pleineLargeur enCours="Envoi…">
        Envoyer mon témoignage
      </BoutonEnvoi>
    </form>
  );
}

/** Un témoignage déjà envoyé : changer l'autorisation de publication, ou le retirer. */
export function AvisEnvoye({ a, prenom }: { a: { id: string; texte: string; publiable: boolean; nom_affiche: NomAffiche | null; cree_le: string }; prenom: string }) {
  const [publiable, setPubliable] = useState(a.publiable);
  const [nom, setNom] = useState<NomAffiche | null>(a.nom_affiche);
  const [etat, setEtat] = useState<EtatAvis>({});
  const [retire, setRetire] = useState(false);
  const [enCours, demarrer] = useTransition();
  if (retire) return null;
  const enregistrer = (p: boolean, n: NomAffiche | null) => {
    setPubliable(p);
    setNom(n);
    if (p && !n) return;
    demarrer(async () => setEtat(await changerPublication(a.id, p, n)));
  };
  return (
    <li className="flex flex-col gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce">
      <p className="whitespace-pre-line text-[15px]">« {a.texte} »</p>
      <label className="flex cursor-pointer items-center gap-3 text-[14.5px]">
        <input type="checkbox" checked={publiable} disabled={enCours} onChange={(e) => enregistrer(e.target.checked, nom)} className="size-5 accent-[var(--accent)]" />
        Cindy peut le publier
      </label>
      {publiable && <ChoixNom prenom={prenom} valeur={nom} onChange={(n) => enregistrer(true, n)} nom={`nom-${a.id}`} />}
      {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
      {etat.succes && <Message ton="succes">{etat.succes}</Message>}
      <Bouton
        variante="discret"
        className="w-fit"
        disabled={enCours}
        onClick={() => {
          if (window.confirm("Retirer ce témoignage ?"))
            demarrer(async () => {
              const r = await supprimerAvis(a.id);
              if (r.erreur) setEtat(r);
              else setRetire(true);
            });
        }}
      >
        Retirer ce témoignage
      </Bouton>
    </li>
  );
}
