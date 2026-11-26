import type { Metadata } from "next";
import Link from "next/link";
import { cx } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { DUREES_EXPRESS, accesExpress, filtrerExpress, libelleNiveau, lireFiltres } from "@/lib/seances-express";
import { lireSeancesExpress } from "@/lib/seances-express-serveur";
import { BientotDisponible, EnTete } from "../composants";
import { IconeSport } from "@/components/icones";
import { CoeurExpress } from "./favori";

export const metadata: Metadata = { title: "Séances express" };

type Params = { duree?: string; materiel?: string; type?: string; favoris?: string };

export default async function PageSeancesExpressCliente({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase, profil, fiche } = await exigerCliente();
  const params = await searchParams;
  const ouvert = accesExpress(fiche);
  const [seances, { data: favorisLus }] = ouvert
    ? await Promise.all([lireSeancesExpress(supabase, { publiees: true }), supabase.from("seances_express_favoris").select("seance_id").eq("cliente_id", profil.id)])
    : [null, { data: [] }];
  const favoris = new Set((favorisLus ?? []).map((f) => f.seance_id as string));
  const f = lireFiltres(params);
  const liste = filtrerExpress(seances ?? [], f, favoris);
  // Filtres proposés : seulement les valeurs utilisées par ses séances.
  const types = [...new Set((seances ?? []).map((s) => s.type))].sort((a, b) => a.localeCompare(b, "fr"));
  const materiels = [...new Set((seances ?? []).flatMap((s) => s.materiel).filter((m) => m.toLowerCase() !== "aucun"))].sort((a, b) => a.localeCompare(b, "fr"));
  const durees = DUREES_EXPRESS.filter((d) => (seances ?? []).some((s) => s.duree_minutes === d));
  const lien = (o: Partial<Record<keyof Params, string | null>>) => {
    const u = new URLSearchParams();
    const v = { duree: f.duree ? String(f.duree) : null, materiel: f.materiel, type: f.type, favoris: f.favoris ? "1" : null, ...o };
    for (const [k, x] of Object.entries(v)) if (x) u.set(k, x);
    const q = u.toString();
    return `/seances-express${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <EnTete titre="Séances express" sousTitre="Pas le temps, pas de salle, en déplacement ? Une petite séance vaut toujours mieux que rien 💛" />
      {!ouvert ? (
        <BientotDisponible
          icone={<IconeSport className="size-6" />}
          titre="Pas disponible pour le moment"
          texte="Les séances express ne sont pas disponibles sur ton compte. Écris-moi si tu penses que c’est une erreur 💛"
        />
      ) : seances === null || seances.length === 0 ? (
        <BientotDisponible icone={<IconeSport className="size-6" />} titre="Bientôt ici" texte="Je prépare tes premières séances express : reviens très vite !" />
      ) : (
        <div className="flex flex-col gap-4 px-5 pb-6 pt-3">
          <nav className="flex flex-col gap-2.5" aria-label="Filtres">
            <Rangee>
              <Puce href={lien({ duree: null, type: null, materiel: null, favoris: null })} actif={!f.duree && !f.type && !f.materiel && !f.favoris}>
                Toutes
              </Puce>
              <Puce href={lien({ favoris: f.favoris ? null : "1" })} actif={f.favoris}>
                ♥ Mes favoris
              </Puce>
              {durees.map((d) => (
                <Puce key={d} href={lien({ duree: f.duree === d ? null : String(d) })} actif={f.duree === d}>
                  {d} min
                </Puce>
              ))}
            </Rangee>
            {types.length > 1 && (
              <Rangee>
                {types.map((t) => (
                  <Puce key={t} href={lien({ type: f.type === t ? null : t })} actif={f.type === t}>
                    {t}
                  </Puce>
                ))}
              </Rangee>
            )}
            <Rangee>
              <Puce href={lien({ materiel: f.materiel === "Aucun" ? null : "Aucun" })} actif={f.materiel === "Aucun"}>
                Sans matériel
              </Puce>
              {materiels.map((m) => (
                <Puce key={m} href={lien({ materiel: f.materiel === m ? null : m })} actif={f.materiel === m}>
                  J’ai : {m}
                </Puce>
              ))}
            </Rangee>
          </nav>

          {liste.length === 0 ? (
            <p className="rounded-carte bg-blanc-casse p-5 text-[15px] text-texte-2 shadow-douce">
              {f.favoris ? "Pas encore de favori : touche le cœur d’une séance pour la retrouver ici." : "Aucune séance ne correspond : enlève un filtre."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {liste.map((s) => (
                <li key={s.id} className="flex flex-col gap-3 rounded-carte bg-blanc-casse p-4 shadow-douce">
                  <div className="flex items-start gap-3">
                    <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent-pale font-titre leading-none">
                      <span className="text-[20px] font-bold">{s.duree_minutes}</span>
                      <span className="text-[11px]">min</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-titre text-[18px] font-bold leading-snug">{s.titre}</span>
                      <span className="text-[13.5px] text-texte-2">
                        {s.type} · {libelleNiveau(s.niveau)} · {s.materiel.filter((m) => m.toLowerCase() !== "aucun").join(", ") || "sans matériel"}
                      </span>
                    </span>
                    <CoeurExpress id={s.id} favori={favoris.has(s.id)} titre={s.titre} />
                  </div>
                  {s.description && <p className="text-[14.5px] text-texte-2">{s.description}</p>}
                  <Link
                    href={`/seance/express/${s.id}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15.5px] font-medium text-white"
                  >
                    ▶ C’est parti
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function Rangee({ children }: { children: React.ReactNode }) {
  return <div className="defilement -mx-5 flex gap-2 overflow-x-auto px-5 py-0.5">{children}</div>;
}

function Puce({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "true" : undefined}
      className={cx("inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-medium", actif ? "bg-chocolat text-creme" : "bg-blanc-casse text-chocolat shadow-douce")}
    >
      {children}
    </Link>
  );
}
