import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FilCommunaute } from "@/components/communaute/fil";
import { Adhesion, ReglagesMembre } from "@/components/communaute/reglages-membre";
import { cx } from "@/components/ui";
import type { Salon } from "@/lib/communaute";
import { chargerMessages, lireEtatCommunaute, lireMembre } from "@/lib/communaute-serveur";

/** Les onglets des salons (coachées et coach) : « Entre coachées » et « Tout le monde ». */
export function OngletsSalons({ salon, base, coach = false }: { salon: Salon; base: string; coach?: boolean }) {
  const onglets: { salon: Salon; label: string; href: string }[] = [
    { salon: "coachees", label: coach ? "Salon des coachées" : "Entre coachées", href: base },
    { salon: "commun", label: coach ? "Espace commun" : "Tout le monde", href: `${base}?salon=commun` },
  ];
  return (
    <nav aria-label="Salons" className="flex gap-1 rounded-full bg-sable/60 p-1">
      {onglets.map((o) => (
        <Link
          key={o.salon}
          href={o.href}
          aria-current={o.salon === salon ? "page" : undefined}
          className={cx(
            "flex min-h-10 flex-1 items-center justify-center rounded-full px-3 text-[14px] transition-colors",
            o.salon === salon ? "bg-blanc-casse font-medium text-chocolat shadow-douce" : "text-texte-2 hover:text-chocolat",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

export const salonDepuis = (brut: string | string[] | undefined): Salon => (brut === "commun" ? "commun" : "coachees");

/**
 * La communauté vue par une membre (coachée ou abonnée) : adhésion, puis le fil du salon choisi.
 * Une abonnée n'a que l'espace commun ; une coachée a aussi son salon réservé.
 */
export async function EspaceCommunaute({
  supabase,
  moi,
  lienPolitique,
  salon,
  abonnee = false,
  base,
}: {
  supabase: SupabaseClient;
  moi: string;
  lienPolitique: string | null;
  salon: Salon;
  abonnee?: boolean;
  base: string;
}) {
  const etat = await lireEtatCommunaute(supabase);
  const membre = etat?.ouverte ? await lireMembre(supabase, moi) : null;

  if (!etat?.ouverte) {
    return (
      <Encadre emoji="🌱" titre="Bientôt ouverte">
        La communauté n’est pas ouverte pour le moment. Je te préviens dès qu’elle ouvre.
      </Encadre>
    );
  }
  if (!membre) return <Adhesion charte={etat.charte} lienPolitique={lienPolitique} abonnee={abonnee} />;
  if (membre.statut === "exclue") {
    return (
      <Encadre emoji="🔒" titre="Tu n’as plus accès à la communauté">
        J’ai retiré ton accès à la communauté. Si tu veux en parler, écris-moi directement
        {abonnee ? "." : " : ton accompagnement, lui, continue normalement."}
      </Encadre>
    );
  }

  await supabase.rpc("reglages_membre", { p_vu: true });
  const [{ messages, encore }, { count: appareils }] = await Promise.all([
    chargerMessages(supabase, moi, { salon }),
    supabase.from("abonnements_push").select("id", { count: "exact", head: true }).eq("cliente_id", moi),
  ]);
  return (
    <>
      {!abonnee && <OngletsSalons salon={salon} base={base} />}
      {!abonnee && (
        <p className="-mt-2 text-[13.5px] text-texte-2">
          {salon === "coachees"
            ? "Ici, on est entre clientes coachées 💛"
            : "Ici, on échange avec tout le monde : mes clientes coachées et les membres de l’appli."}
        </p>
      )}
      <FilCommunaute key={salon} moi={moi} salon={salon} initial={{ messages, encore, maintenant: new Date().toISOString() }} />
      <ReglagesMembre notifications={membre.notifications} appareil={(appareils ?? 0) > 0} charte={etat.charte} />
    </>
  );
}

export function Encadre({ emoji, titre, children }: { emoji: string; titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-bloc border border-dashed border-caramel-clair bg-blanc-casse/60 px-6 py-10 text-center apparition">
      <span className="text-4xl" aria-hidden>
        {emoji}
      </span>
      <p className="font-titre text-xl font-bold">{titre}</p>
      <p className="max-w-xs text-[15px] text-texte-2">{children}</p>
    </div>
  );
}
