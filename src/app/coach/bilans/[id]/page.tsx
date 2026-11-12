import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Etiquette, Surtitre } from "@/components/ui";
import { DetailBilan } from "@/components/suivi/detail-bilan";
import { exigerCoach } from "@/lib/auth";
import { formaterDate } from "@/lib/bilan";
import { chargerBilan, chargerBilans, chargerChamps, urlsPhotos } from "@/lib/suivi";
import { ANGLES } from "@/lib/types";
import { chargerFile } from "../donnees";
import { FormulaireRetour } from "./formulaire-retour";

export const metadata: Metadata = { title: "Traiter un bilan" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageTraitementBilan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, profil } = await exigerCoach();
  const bilan = await chargerBilan(supabase, id);
  if (!bilan) notFound();

  const [champs, historique, { data: c }, file] = await Promise.all([
    chargerChamps(supabase, true),
    chargerBilans(supabase, bilan.cliente_id),
    supabase
      .from("clientes")
      .select("mode_sans_chiffres, frequence_bilan_jours, profils!inner(prenom, nom)")
      .eq("id", bilan.cliente_id)
      .single<{ mode_sans_chiffres: boolean; frequence_bilan_jours: number; profils: { prenom: string; nom: string } }>(),
    chargerFile(),
  ]);
  const index = historique.findIndex((b) => b.id === bilan.id);
  const precedent = index >= 0 ? (historique[index + 1] ?? null) : null;
  const urls = await urlsPhotos(
    supabase,
    [...bilan.photos, ...(precedent?.photos ?? [])].map((p) => p.fichier_path),
  );
  const suivant = file.aTraiter.find((b) => b.id !== bilan.id)?.id ?? null;
  const prenom = c?.profils.prenom ?? "";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/coach/bilans" className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> La file des bilans
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Surtitre>{bilan.echeance ? "Bilan" : "Saisie libre"}</Surtitre>
          <h1 className="font-titre text-[32px] font-bold leading-tight">
            {prenom} {c?.profils.nom} · {formaterDate(bilan.date_mesure, { year: undefined })}
          </h1>
          <div className="mt-1 flex flex-wrap gap-2 text-[13.5px] text-texte-2">
            {bilan.saisi_par === profil.id && <Etiquette ton="sable">Saisi par toi</Etiquette>}
            {bilan.modifie_le && <Etiquette ton="sable">Modifié après envoi</Etiquette>}
            {c?.mode_sans_chiffres && <Etiquette ton="sable">Mode sans chiffres</Etiquette>}
            {precedent && <span>Comparé au {formaterDate(precedent.date_mesure, { year: undefined })}</span>}
          </div>
        </div>
        <Link href={`/coach/clientes/${bilan.cliente_id}/suivi`} className="text-[14px] underline underline-offset-4">
          Tout son suivi
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <DetailBilan
            bilan={bilan}
            champs={champs}
            urls={urls}
            jours={c?.frequence_bilan_jours ?? 15}
            precedent={precedent}
            comparer
          />
          {precedent && precedent.photos.length > 0 && bilan.photos.length > 0 && (
            <Carte className="flex flex-col gap-3">
              <h2 className="font-titre text-lg font-bold">Photos : bilan précédent → celui-ci</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {ANGLES.map(({ valeur, libelle }) => {
                  const avant = precedent.photos.find((p) => p.angle === valeur);
                  const apres = bilan.photos.find((p) => p.angle === valeur);
                  if (!avant || !apres) return null;
                  return (
                    <div key={valeur} className="flex flex-col gap-1">
                      <div className="grid grid-cols-2 gap-1">
                        {[avant, apres].map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={p.id}
                            src={urls.get(p.fichier_path)}
                            alt={`${libelle}`}
                            className="aspect-[3/4] w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                      <span className="text-center text-[12.5px] text-texte-2">{libelle}</span>
                    </div>
                  );
                })}
              </div>
            </Carte>
          )}
        </div>
        <Carte className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
          <FormulaireRetour
            key={bilan.id}
            bilanId={bilan.id}
            initial={bilan.retour?.contenu ?? ""}
            prenom={prenom}
            suivant={suivant}
          />
          {bilan.retour?.lu_le && (
            <p className="text-[13px] text-texte-2">
              Lu par {prenom} le{" "}
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(
                new Date(bilan.retour.lu_le),
              )}
            </p>
          )}
        </Carte>
      </div>
    </div>
  );
}
