import Link from "next/link";
import { Carte, Etiquette, LienBouton } from "@/components/ui";
import { BoutonSupprimerDemande } from "./bouton-demande";

export type Demande = {
  id: string;
  recue_le: string;
  prenom: string;
  nom: string;
  email: string;
  objectif: string | null;
  exclusions_texte: string | null;
  categories_exclues: string[];
  reponses: { question: string; reponse: string }[];
  doublon_de: string | null;
};

const quand = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Fiches à valider : demandes venues du formulaire Tally, jamais invitées automatiquement. */
export function FichesAValider({ demandes, categories }: { demandes: Demande[]; categories: Map<string, string> }) {
  if (!demandes.length) return null;
  return (
    <section id="a-valider" className="flex flex-col gap-3 scroll-mt-6">
      <div>
        <h2 className="font-titre text-[24px] font-bold leading-tight">
          Fiches à valider <span className="text-texte-2">({demandes.length})</span>
        </h2>
        <p className="text-[14px] text-texte-2">
          Arrivées par ton formulaire d’inscription. Rien ne leur a été envoyé : vérifie, puis crée leur fiche et invite-les.
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {demandes.map((d) => (
          <Carte key={d.id} className="flex flex-col gap-3 border-2 border-caramel/40">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-titre text-xl font-bold">
                  {d.prenom} {d.nom}
                </span>
                <span className="truncate text-[14px] text-texte-2">{d.email}</span>
              </div>
              <Etiquette ton="sable">reçue le {quand.format(new Date(d.recue_le))}</Etiquette>
            </div>
            {d.doublon_de && (
              <p className="rounded-xl bg-accent-pale px-3 py-2 text-[14px]">
                ⚠️ Un compte existe déjà avec cet email.{" "}
                <Link href={`/coach/clientes/${d.doublon_de}`} className="font-medium underline underline-offset-4">
                  Voir sa fiche
                </Link>
              </p>
            )}
            <dl className="flex flex-col gap-1.5 text-[14px]">
              {d.objectif && (
                <div>
                  <dt className="inline font-medium">Objectif : </dt>
                  <dd className="inline">{d.objectif}</dd>
                </div>
              )}
              {d.exclusions_texte && (
                <div>
                  <dt className="inline font-medium">Allergies, aliments évités : </dt>
                  <dd className="inline">{d.exclusions_texte}</dd>
                </div>
              )}
              {d.categories_exclues.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <dt className="font-medium">Exclusions proposées :</dt>
                  {d.categories_exclues.map((c) => (
                    <dd key={c}>
                      <Etiquette ton="rose">{categories.get(c) ?? "?"}</Etiquette>
                    </dd>
                  ))}
                </div>
              )}
            </dl>
            {d.reponses.length > 0 && (
              <details className="group rounded-xl bg-sable/40 px-3 py-2">
                <summary className="cursor-pointer text-[14px] font-medium">Toutes ses réponses ({d.reponses.length})</summary>
                <dl className="mt-2 flex flex-col gap-2 text-[14px]">
                  {d.reponses.map((r, i) => (
                    <div key={i}>
                      <dt className="text-texte-2">{r.question}</dt>
                      <dd className="whitespace-pre-line">{r.reponse}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {!d.doublon_de && <LienBouton href={`/coach/clientes/nouvelle?demande=${d.id}`}>Vérifier et inviter</LienBouton>}
              <BoutonSupprimerDemande id={d.id} prenom={d.prenom} />
            </div>
          </Carte>
        ))}
      </div>
    </section>
  );
}
