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
import { aujourdhuiParis, bilanAvecPhotos, echeanceOuverte, formaterDate, rdvAVenir } from "@/lib/bilan";
import { CarteInstallation } from "@/components/pwa";
import { accesCommunaute } from "@/lib/communaute-serveur";
import { lireMonPaiement, lireSuiviSport } from "@/lib/paiements-serveur";
import { mensualiteASignaler } from "@/components/mon-paiement";
import { EnTete } from "./composants";

export default async function PageAccueil() {
  const { supabase, profil, fiche, reglages } = await exigerCliente();
  const { data: nonVus } = await supabase
    .from("plans")
    .select("type")
    .eq("actif", true)
    .is("vu_le", null);
  const nouveau = (type: string) => (nonVus ?? []).some((p) => p.type === type);
  const auj = aujourdhuiParis();
  const ouverte =
    fiche.statut === "active"
      ? echeanceOuverte(fiche.date_debut, fiche.frequence_bilan_jours, reglages.fenetre_bilan_jours, auj)
      : null;
  const [{ data: dejaEnvoye }, { data: retoursNonLus }] = await Promise.all([
    ouverte
      ? supabase.from("bilans").select("id").eq("echeance", ouverte.echeance).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("retours_bilan").select("bilan_id").is("lu_le", null).limit(1),
  ]);
  const bilanAFaire = ouverte && !dejaEnvoye ? ouverte : null;
  const retourNonLu = retoursNonLus?.[0]?.bilan_id as string | undefined;
  const rdv = rdvAVenir(fiche.prochain_rdv);
  const formatRdv = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  const formationOuverte = fiche.acces_formation && Boolean(reglages.lien_formation);
  const [communaute, sport, monPaiement] = await Promise.all([
    carteCommunaute(supabase, profil.id),
    lireSuiviSport(supabase, profil.id),
    lireMonPaiement(supabase),
  ]);
  const mensualite = mensualiteASignaler(monPaiement, auj);

  return (
    <>
      <EnTete
        titre={
          <>
            Bonjour <span className="text-accent">{profil.prenom || "toi"}</span>
          </>
        }
        sousTitre={
          <span className="font-main text-[24px] leading-tight text-caramel-texte">
            On avance ensemble, à ton rythme.
          </span>
        }
      />

      <div className="flex flex-col gap-4 px-5 pt-4">
        {retourNonLu && (
          <Link
            href={`/suivi/${retourNonLu}`}
            className="flex items-center gap-4 rounded-carte bg-chocolat p-4 text-creme apparition"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-carte-sombre font-main text-xl text-caramel-clair">
              C
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-medium">Cindy a répondu à ton bilan</span>
              <span className="text-[14px] text-texte-clair">Touche pour lire son message 💛</span>
            </span>
            <IconeFleche className="size-5 shrink-0" />
          </Link>
        )}

        {bilanAFaire && (
          <Link href="/suivi/bilan" className="flex items-center gap-4 rounded-carte bg-accent-pale p-4 apparition">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blanc-casse">
              <IconeCalendrier className="size-5" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-medium">
                {bilanAFaire.statut === "ouverte" ? "Ton bilan est ouvert" : "Ton bilan t’attend"}
                {bilanAvecPhotos(fiche.date_debut, fiche.frequence_bilan_jours, bilanAFaire.echeance) && " · avec tes photos 📸"}
              </span>
              <span className="text-[14px] text-texte-2">
                {bilanAFaire.statut === "ouverte"
                  ? `Pour le ${formaterDate(bilanAFaire.echeance, { year: undefined })} · quelques minutes suffisent.`
                  : "Il est encore temps de l’envoyer."}
              </span>
            </span>
            <IconeFleche className="size-5 shrink-0" />
          </Link>
        )}

        {mensualite && (
          <Link href="/profil" className="flex items-center gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce apparition">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sable text-xl" aria-hidden>
              💳
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-medium">{mensualite.titre}</span>
              <span className="text-[14px] text-texte-2">{mensualite.texte}</span>
            </span>
            <IconeFleche className="size-5 shrink-0 text-texte-2" />
          </Link>
        )}

        <CarteInstallation />

        {rdv && (
          <div className="flex items-center gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce apparition">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sable">
              <IconeCalendrier className="size-5" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] text-texte-2">Prochain rendez-vous</span>
              <span className="font-medium first-letter:uppercase">{formatRdv.format(new Date(rdv))}</span>
            </span>
            {fiche.lien_rdv && (
              <a
                href={fiche.lien_rdv}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full bg-chocolat px-4 py-2 text-[14px] font-medium text-creme"
              >
                Rejoindre
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Tuile
            href="/nutrition"
            icone={<IconeNutrition className="size-6" />}
            titre="Mon plan alimentaire"
            nouveau={nouveau("nutrition")}
          />
          {sport ? (
            <Tuile
              href="/sport"
              icone={<IconeSport className="size-6" />}
              titre="Mon programme sportif"
              nouveau={nouveau("sport")}
            />
          ) : (
            <Tuile href="/ressources" icone={<IconeRessources className="size-6" />} titre="Ressources" />
          )}
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

        {communaute && (
          <Link
            href="/communaute"
            className="flex items-center gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce apparition"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-pale text-xl" aria-hidden>
              💬
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-titre text-[17px] font-bold">La communauté</span>
              <span className="text-[14px] text-texte-2">{communaute.texte}</span>
            </span>
            {communaute.nonLus > 0 && (
              <span className="rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium text-white tabular-nums">
                {communaute.nonLus > 99 ? "99+" : communaute.nonLus}
              </span>
            )}
            <IconeFleche className="size-5 shrink-0 text-texte-2" />
          </Link>
        )}

        {sport && (
          <div className="grid grid-cols-2 gap-3">
            <Tuile href="/sport/videos" icone={<IconeVideo className="size-6" />} titre="Vidéos d’exercices" />
            <Tuile href="/ressources" icone={<IconeRessources className="size-6" />} titre="Ressources" />
          </div>
        )}

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

/** Carte « Communauté » de l'accueil (rien si elle est fermée, si la cliente a été retirée ou avant la mise à jour 0009). */
async function carteCommunaute(supabase: Parameters<typeof accesCommunaute>[0], moi: string) {
  const acces = await accesCommunaute(supabase, moi);
  if (!acces) return null;
  if (!acces.membre) return { nonLus: 0, texte: "Échange avec les autres clientes de Cindy" };
  const n = acces.nonLus;
  return { nonLus: n, texte: n === 0 ? "Pas de nouveau message" : n === 1 ? "1 nouveau message" : `${n > 99 ? "99+" : n} nouveaux messages` };
}

function Tuile({
  href,
  icone,
  titre,
  nouveau,
}: {
  href: string;
  icone: ReactNode;
  titre: string;
  nouveau?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-32 flex-col justify-between gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce apparition",
        "transition-transform active:scale-[0.98]",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent-pale text-chocolat">
          {icone}
        </span>
        {nouveau && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-medium text-white">
            Nouveau
          </span>
        )}
      </span>
      <span className="font-titre text-[17px] font-bold leading-snug">{titre}</span>
    </Link>
  );
}
