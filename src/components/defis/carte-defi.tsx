import { formaterDate } from "@/lib/bilan";
import { etatDefi, texteGroupe, texteObjectif, textePeriode, texteProgression, typeDefi } from "@/lib/defis";
import type { DefiCliente } from "@/lib/defis-serveur";
import { Jauge, ParticipationDefi, ReleverDefi } from "@/app/(cliente)/defis/participation";

/** Un défi du mois tel que le voit une participante (cliente coachée ou abonnée). */
export function CarteDefiCliente({ d, auj, sansChiffres, communaute }: { d: DefiCliente; auj: string; sansChiffres: boolean; communaute: boolean }) {
  const etat = etatDefi(d, auj);
  const p = d.progression;
  const reussi = Boolean(d.participation?.reussi_le) || Boolean(p?.reussi);
  return (
    <article className="flex flex-col gap-4 rounded-carte bg-blanc-casse p-5 shadow-douce apparition" aria-labelledby={`defi-${d.id}`}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-texte">
          {etat === "a_venir" ? `Commence le ${formaterDate(d.debut, { year: undefined })}` : etat === "termine" ? "Terminé" : `Jusqu’au ${formaterDate(d.fin, { year: undefined })}`}
        </span>
        <h2 id={`defi-${d.id}`} className="font-titre text-[22px] font-bold leading-tight">
          {typeDefi(d.type).emoji} {d.titre}
        </h2>
        <p className="text-[15px]">
          {texteObjectif(d)}, {textePeriode(d)}.
        </p>
        {d.description && <p className="whitespace-pre-line text-[14.5px] text-texte-2">{d.description}</p>}
      </div>

      {d.participation && p && (
        <div className="flex flex-col gap-2 rounded-xl bg-creme/70 p-4">
          <span className="text-[13px] font-medium">Ma progression</span>
          <Jauge part={reussi ? 1 : (p.reussites ?? 0) / p.objectif} />
          <span className={reussi ? "font-titre text-[18px] font-bold" : "text-[14.5px]"}>{texteProgression(d.type, { ...p, reussi }, sansChiffres)}</span>
        </div>
      )}

      {p && etat !== "a_venir" && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">Le groupe</span>
          {p.groupe !== null && <Jauge part={p.groupe / 100} couleur="caramel" />}
          <span className="text-[14px] text-texte-2">{texteGroupe(p, sansChiffres)}</span>
        </div>
      )}

      {d.participation ? (
        <ParticipationDefi id={d.id} afficherPrenom={d.participation.afficher_prenom} reussi={reussi} enCours={etat === "en_cours"} communaute={communaute} />
      ) : etat === "en_cours" ? (
        <ReleverDefi id={d.id} communaute={communaute} />
      ) : etat === "a_venir" ? (
        <p className="text-[14px] text-texte-2">Tu pourras le relever dès le premier jour 💪</p>
      ) : null}
    </article>
  );
}
