import Link from "next/link";
import type { ReactNode } from "react";
import {
  IconeCadenas,
  IconeCalendrier,
  IconeExterne,
  IconeFleche,
  IconeFormation,
  IconeNutrition,
  IconeRecettes,
  IconeRessources,
  IconeSport,
  IconeVideo,
} from "@/components/icones";
import { cx } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { aujourdhuiParis, formaterDate, joursEntre, prochainBilan } from "@/lib/bilan";
import { EnTete } from "./composants";

export default async function PageAccueil() {
  const { profil, fiche, reglages } = await exigerCliente();
  const auj = aujourdhuiParis();
  const bilan =
    fiche.statut === "active" ? prochainBilan(fiche.date_debut, fiche.frequence_bilan_jours, auj) : null;
  const joursAvantBilan = bilan ? joursEntre(auj, bilan) : null;
  const formationOuverte = fiche.acces_formation && Boolean(reglages.lien_formation);

  return (
    <>
      <EnTete
        titre={
          <>
            Bonjour <span className="text-accent">{profil.prenom || "toi"}</span>
          </>
        }
        sousTitre={
          <span className="font-main text-[24px] leading-tight text-caramel">
            On avance ensemble, à ton rythme.
          </span>
        }
      />

      <div className="flex flex-col gap-4 px-5 pt-4">
        {joursAvantBilan !== null && joursAvantBilan <= 3 && (
          <Link
            href="/suivi"
            className="flex items-center gap-4 rounded-carte bg-accent-pale p-4 apparition"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blanc-casse">
              <IconeCalendrier className="size-5" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium">
                {joursAvantBilan === 0 ? "C’est le jour de ton bilan !" : "Ton bilan approche"}
              </span>
              <span className="text-[14px] text-texte-2">
                {joursAvantBilan === 0
                  ? "Pense à noter tes mesures aujourd’hui."
                  : `Le ${formaterDate(bilan, { year: undefined })} : pense à noter tes mesures.`}
              </span>
            </span>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Tuile href="/nutrition" icone={<IconeNutrition className="size-6" />} titre="Mon plan alimentaire" />
          <Tuile href="/sport" icone={<IconeSport className="size-6" />} titre="Mon programme sportif" />
        </div>

        <Link
          href="/recettes"
          className="group relative overflow-hidden rounded-bloc bg-chocolat p-6 text-creme apparition"
        >
          <span
            aria-hidden
            className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/30 blur-2xl"
          />
          <span className="relative flex flex-col gap-3">
            <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-caramel-clair">
              Recettes plaisir
            </span>
            <span className="font-titre text-[24px] font-bold leading-tight">
              Envie de changer de repas ?
            </span>
            <span className="text-[15px] text-texte-clair">
              Des recettes gourmandes, déjà adaptées à ton plan.
            </span>
            <span className="mt-1 inline-flex items-center gap-2 text-[15px] font-medium text-white">
              <IconeRecettes className="size-5" /> Découvrir
              <IconeFleche className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Tuile href="/sport#videos" icone={<IconeVideo className="size-6" />} titre="Vidéos d’exercices" />
          <Tuile href="/ressources" icone={<IconeRessources className="size-6" />} titre="Ressources" />
        </div>

        {formationOuverte ? (
          <a
            href={reglages.lien_formation!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-carte bg-blanc-casse p-5 shadow-douce apparition"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sable">
              <IconeFormation className="size-6" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-titre text-lg font-bold">Ma formation</span>
              <span className="text-[14px] text-texte-2">Fitw_cindy Academy, sur Notion</span>
            </span>
            <IconeExterne className="size-5 text-texte-2" />
          </a>
        ) : (
          <div className="flex items-start gap-4 rounded-carte border border-dashed border-caramel-clair bg-blanc-casse/60 p-5 apparition">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sable/70 text-texte-2">
              <IconeCadenas className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-titre text-lg font-bold">Ma formation</span>
              <span className="text-[14px] text-texte-2">{reglages.message_formation}</span>
              {reglages.lien_contact && (
                <a
                  href={reglages.lien_contact}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-[14px] font-medium text-accent underline underline-offset-4"
                >
                  En parler avec Cindy
                </a>
              )}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

function Tuile({ href, icone, titre }: { href: string; icone: ReactNode; titre: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-32 flex-col justify-between gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce apparition",
        "transition-transform active:scale-[0.98]",
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-accent-pale text-chocolat">
        {icone}
      </span>
      <span className="font-titre text-[17px] font-bold leading-snug">{titre}</span>
    </Link>
  );
}
