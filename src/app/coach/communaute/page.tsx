import type { Metadata } from "next";
import { FilCommunaute } from "@/components/communaute/fil";
import { Carte, Message, Surtitre } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { chargerMessages, lireEtatCommunaute } from "@/lib/communaute-serveur";
import { ListeMembres, ListeSignalements, ReglagesCommunaute, type MembreCoach, type SignalementGroupe } from "./moderation";

export const metadata: Metadata = { title: "Communauté" };

type Profil = { prenom: string; nom: string };
const un = <T,>(x: T | T[] | null | undefined): T | undefined => (Array.isArray(x) ? x[0] : (x ?? undefined));

export default async function PageCommunauteCoach() {
  const { supabase, profil } = await exigerCoach();
  const etat = await lireEtatCommunaute(supabase);
  if (!etat) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        <Entete />
        <Message ton="info">
          Fais d’abord la mise à jour de la base : fichier 0009_communaute.sql (voir le guide, phase 10).
        </Message>
      </div>
    );
  }

  const [{ messages, encore }, { data: signalements }, { data: membres }] = await Promise.all([
    chargerMessages(supabase, profil.id),
    supabase
      .from("signalements_communaute")
      .select("message_id, motif, created_at, profils(prenom), messages_communaute(texte, auteur_prenom, photo_path, created_at)")
      .eq("traite", false)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("membres_communaute")
      .select("cliente_id, statut, notifications, charte_acceptee_le, clientes(statut, profils(prenom, nom))")
      .order("charte_acceptee_le", { ascending: false }),
  ]);

  const groupes = new Map<string, SignalementGroupe>();
  for (const s of signalements ?? []) {
    const msg = un(s.messages_communaute as unknown as { texte: string; auteur_prenom: string; photo_path: string | null; created_at: string });
    if (!msg) continue;
    const g: SignalementGroupe = groupes.get(s.message_id) ?? {
      messageId: s.message_id,
      auteur: msg.auteur_prenom,
      texte: msg.texte,
      photo: Boolean(msg.photo_path),
      creeLe: msg.created_at,
      signalements: [],
    };
    g.signalements.push({ par: un(s.profils as unknown as Profil)?.prenom || "Une membre", motif: s.motif ?? null });
    groupes.set(s.message_id, g);
  }

  const liste: MembreCoach[] = (membres ?? []).map((m) => {
    const c = un(m.clientes as unknown as { statut: string; profils: Profil | Profil[] });
    const p = un(c?.profils);
    return {
      clienteId: m.cliente_id,
      nom: `${p?.prenom ?? ""} ${p?.nom ?? ""}`.trim() || "Cliente",
      statut: m.statut as "membre" | "exclue",
      accompagnementTermine: c?.statut === "fermee",
      notifications: m.notifications,
      depuis: m.charte_acceptee_le,
    };
  });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Entete />
      <Carte className="flex flex-col gap-4">
        <ReglagesCommunaute ouverte={etat.ouverte} charte={etat.charte} />
      </Carte>

      {groupes.size > 0 && (
        <Carte className="flex flex-col gap-4 border-2 border-accent">
          <h2 className="font-titre text-xl font-bold">Signalements à regarder ({groupes.size})</h2>
          <ListeSignalements groupes={[...groupes.values()]} />
        </Carte>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-titre text-xl font-bold">Le fil</h2>
        <p className="text-[14px] text-texte-2">
          Tes messages apparaissent avec le badge « Coach ». Tu peux épingler un message (il reste en haut) ou supprimer
          n’importe quel message.
        </p>
        <FilCommunaute moi={profil.id} coach initial={{ messages, encore, maintenant: new Date().toISOString() }} />
      </section>

      <Carte className="flex flex-col gap-4">
        <div>
          <h2 className="font-titre text-xl font-bold">Membres ({liste.filter((m) => m.statut === "membre").length})</h2>
          <p className="text-[14px] text-texte-2">
            Une cliente retirée ne voit plus la communauté et ne peut pas revenir seule. Une cliente dont l’accompagnement est
            terminé perd l’accès automatiquement.
          </p>
        </div>
        <ListeMembres membres={liste} />
      </Carte>
    </div>
  );
}

function Entete() {
  return (
    <div>
      <Surtitre>Communauté</Surtitre>
      <h1 className="font-titre text-[34px] font-bold leading-tight">Le groupe des clientes</h1>
    </div>
  );
}
