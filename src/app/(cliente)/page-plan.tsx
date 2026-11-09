import Link from "next/link";
import { IconeExterne, IconeNutrition, IconeRetour, IconeSport } from "@/components/icones";
import { Etiquette, Surtitre, classesBouton } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { COLONNES_PLAN, type Plan, type TypePlan } from "@/lib/types";
import { BoutonTelecharger, MarquerVu } from "./actions-plan";
import { BientotDisponible, EnTete } from "./composants";
import { LecteurPdf } from "./lecteur-pdf";

const TEXTES: Record<TypePlan, { titre: string; attente: string; chemin: string }> = {
  nutrition: {
    titre: "Mon plan alimentaire",
    attente: "Cindy prépare ton plan alimentaire. Il apparaîtra ici dès qu’il sera prêt 💛",
    chemin: "/nutrition",
  },
  sport: {
    titre: "Mon programme sportif",
    attente: "Cindy prépare ton programme. Il apparaîtra ici dès qu’il sera prêt 💪",
    chemin: "/sport",
  },
};

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export async function PagePlan({ type, version }: { type: TypePlan; version?: string }) {
  const { supabase } = await exigerCliente();
  const { data } = await supabase
    .from("plans")
    .select(COLONNES_PLAN)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .returns<Plan[]>();
  const plans = data ?? [];
  const actuel = plans.find((p) => p.actif) ?? null;
  const choisi = (version && plans.find((p) => p.id === version)) || actuel;
  const anciens = plans.filter((p) => !p.actif);
  const t = TEXTES[type];

  if (!choisi) {
    return (
      <>
        <EnTete titre={t.titre} />
        <BientotDisponible
          icone={type === "nutrition" ? <IconeNutrition className="size-6" /> : <IconeSport className="size-6" />}
          titre="Bientôt ici"
          texte={t.attente}
        />
      </>
    );
  }

  let urlPdf: string | null = null;
  if (choisi.source === "pdf" && choisi.fichier_path) {
    const { data: signe } = await supabase.storage.from("plans").createSignedUrl(choisi.fichier_path, 300);
    urlPdf = signe?.signedUrl ?? null;
  }
  const ancienneVersion = !choisi.actif;

  return (
    <>
      <EnTete titre={t.titre} />
      {choisi.actif && !choisi.vu_le && <MarquerVu planId={choisi.id} />}

      <div className="flex flex-col gap-5 px-5 pt-3">
        {ancienneVersion ? (
          <div className="flex flex-col gap-2 rounded-carte bg-sable/70 p-4">
            <p className="text-[14px]">
              Tu consultes une <strong className="font-medium">ancienne version</strong> (
              {dateLongue.format(new Date(choisi.created_at))}).
            </p>
            {actuel && (
              <Link href={t.chemin} className="inline-flex items-center gap-1 text-[14px] font-medium text-accent">
                <IconeRetour className="size-4" /> Revenir à mon plan actuel
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-titre text-lg font-bold">{choisi.titre}</p>
            {!choisi.vu_le && <Etiquette>Nouveau</Etiquette>}
          </div>
        )}

        {choisi.source === "pdf" ? (
          urlPdf ? (
            <>
              <LecteurPdf url={urlPdf} titre={choisi.titre} />
              <div className="flex flex-col gap-2">
                <BoutonTelecharger planId={choisi.id} />
                <a
                  href={urlPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-[14px] text-texte-2 underline underline-offset-4"
                >
                  Ouvrir en plein écran pour zoomer
                </a>
              </div>
            </>
          ) : (
            <p className="rounded-xl bg-accent-pale px-4 py-3 text-[14px] text-erreur">
              Ton plan n’est pas disponible pour le moment. Réessaie dans un instant ou écris à Cindy.
            </p>
          )
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-bloc bg-blanc-casse px-6 py-10 text-center shadow-douce">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent-pale">
              {type === "nutrition" ? <IconeNutrition className="size-6" /> : <IconeSport className="size-6" />}
            </span>
            <p className="max-w-xs text-[15px] text-texte-2">
              {choisi.source === "nutrium"
                ? "Ton plan est sur Nutrium. Il s’ouvre dans l’app ou le site Nutrium."
                : "Ton plan est sur Google Drive. Il s’ouvre dans un nouvel onglet."}
            </p>
            <a
              href={choisi.url!}
              target="_blank"
              rel="noopener noreferrer"
              className={classesBouton("principal", true)}
            >
              {choisi.source === "nutrium" ? "Ouvrir mon plan sur Nutrium" : "Ouvrir mon plan"}
              <IconeExterne className="size-5" />
            </a>
          </div>
        )}

        {anciens.length > 0 && (
          <section className="flex flex-col gap-3 pt-2" aria-labelledby={`historique-${type}`}>
            <Surtitre>
              <span id={`historique-${type}`}>Mes versions précédentes</span>
            </Surtitre>
            <ul className="flex flex-col divide-y divide-ligne rounded-carte bg-blanc-casse shadow-douce">
              {anciens.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`${t.chemin}?version=${p.id}`}
                    aria-current={p.id === choisi.id ? "page" : undefined}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 aria-[current=page]:bg-sable/50"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px]">{p.titre}</span>
                      <span className="text-[13px] text-texte-2">
                        {dateLongue.format(new Date(p.created_at))}
                      </span>
                    </span>
                    <span className="text-[13px] text-texte-2">Voir</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
