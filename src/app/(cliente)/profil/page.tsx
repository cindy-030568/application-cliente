import type { Metadata } from "next";
import Link from "next/link";
import { IconeDeconnexion, IconeRetour } from "@/components/icones";
import { Carte } from "@/components/ui";
import { exigerCliente } from "@/lib/auth";
import { formaterDate } from "@/lib/bilan";
import { LIBELLES_STATUT } from "@/lib/types";

export const metadata: Metadata = { title: "Mon profil" };

export default async function PageProfil() {
  const { profil, fiche, reglages } = await exigerCliente();
  return (
    <div className="pt-encoche flex flex-col gap-6 px-5">
      <Link href="/" className="inline-flex items-center gap-1 text-[15px] text-texte-2">
        <IconeRetour className="size-5" /> Accueil
      </Link>
      <h1 className="font-titre text-[30px] font-bold leading-tight">Mon profil</h1>

      <Carte className="flex flex-col gap-4">
        <Ligne label="Prénom et nom" valeur={`${profil.prenom} ${profil.nom}`.trim()} />
        <Ligne label="Email" valeur={profil.email} />
        <Ligne label="Mon accompagnement" valeur={LIBELLES_STATUT[fiche.statut]} />
        {fiche.date_debut && <Ligne label="Début" valeur={formaterDate(fiche.date_debut)} />}
        {fiche.date_fin && <Ligne label="Fin prévue" valeur={formaterDate(fiche.date_fin)} />}
      </Carte>

      <p className="text-[14px] text-texte-2">
        Une info à corriger ? Écris simplement à Cindy, elle s’en occupe.
      </p>

      {reglages.lien_politique && (
        <a
          href={reglages.lien_politique}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] underline underline-offset-4"
        >
          Politique de confidentialité
        </a>
      )}

      <form action="/auth/deconnexion" method="post">
        <button
          type="submit"
          className="inline-flex items-center gap-2 text-[15px] font-medium text-erreur"
        >
          <IconeDeconnexion className="size-5" /> Me déconnecter
        </button>
      </form>
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[13px] text-texte-2">{label}</span>
      <span className="text-[16px]">{valeur || "—"}</span>
    </div>
  );
}
