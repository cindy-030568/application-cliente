import type { Metadata } from "next";
import { IconeExterne, IconeRessources } from "@/components/icones";
import { Surtitre } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { COLONNES_RESSOURCE, type CategorieRessource, type Ressource } from "@/lib/types";
import { BientotDisponible, EnTete } from "../composants";

export const metadata: Metadata = { title: "Ressources" };

export default async function PageRessources() {
  const { supabase } = await exigerCliente();
  const [{ data: categories }, { data: ressources }] = await Promise.all([
    supabase.from("categories_ressource").select("id, nom, ordre").order("ordre").returns<CategorieRessource[]>(),
    // La RLS ne renvoie que les ressources « pour toutes » et celles choisies pour elle.
    supabase.from("ressources").select(COLONNES_RESSOURCE).order("titre").returns<Ressource[]>(),
  ]);

  const groupes = [...(categories ?? []), { id: null, nom: "Autres", ordre: 999 }]
    .map((c) => ({ ...c, items: (ressources ?? []).filter((r) => r.categorie_id === c.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <EnTete titre="Mes ressources" sousTitre="Guides, listes de courses, fiches pratiques…" />
      {groupes.length === 0 ? (
        <BientotDisponible
          icone={<IconeRessources className="size-6" />}
          titre="Bientôt ici"
          texte="Cindy ajoutera ici ses guides et fiches pratiques."
        />
      ) : (
        <div className="flex flex-col gap-7 px-5 pt-3">
          {groupes.map((g) => (
            <section key={g.id ?? "autres"} className="flex flex-col gap-3">
              <Surtitre>{g.nom}</Surtitre>
              <ul className="flex flex-col gap-3">
                {g.items.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 rounded-carte bg-blanc-casse p-4 shadow-douce transition-transform active:scale-[0.98]"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-pale">
                        <IconeRessources className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{r.titre}</span>
                        {r.description && (
                          <span className="text-[14px] leading-snug text-texte-2">{r.description}</span>
                        )}
                      </span>
                      <IconeExterne className="size-5 shrink-0 text-texte-2" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
