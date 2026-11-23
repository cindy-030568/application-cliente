import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconeRetour } from "@/components/icones";
import { Carte, Etiquette, Message, cx } from "@/components/ui";
import { exigerCoach } from "@/lib/auth";
import { OBJECTIFS, type Conseil, type Niveau, type Objectif } from "@/lib/analyse-cliente";
import { chargerAnalyse } from "@/lib/analyse-cliente-serveur";
import { aujourdhuiParis } from "@/lib/bilan";

export const metadata: Metadata = { title: "Analyse & conseils" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const f1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("fr-FR");
const signe = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${f1(Math.abs(n))}`;
const kcal = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} kcal`;

const SECTIONS: { niveau: Niveau; titre: string; sousTitre: string }[] = [
  { niveau: "important", titre: "À traiter en priorité", sousTitre: "Ce qui mérite un ajustement rapide" },
  { niveau: "surveiller", titre: "À surveiller", sousTitre: "Des signaux à garder en tête au prochain bilan" },
  { niveau: "info", titre: "Bon à savoir", sousTitre: "Pistes et rappels" },
  { niveau: "bravo", titre: "Ses réussites 🎉", sousTitre: "À valoriser dans ton prochain retour" },
];
const BORDURE: Record<Niveau, string> = {
  important: "border-l-erreur",
  surveiller: "border-l-caramel",
  info: "border-l-sable",
  bravo: "border-l-succes",
};

export default async function PageAnalyse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await exigerCoach();
  const { data: c } = await supabase
    .from("clientes")
    .select("id, date_debut, date_fin, derniere_visite, created_at, frequence_bilan_jours, profils!inner(prenom, nom)")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      date_debut: string | null;
      date_fin: string | null;
      derniere_visite: string | null;
      created_at: string;
      frequence_bilan_jours: number;
      profils: { prenom: string; nom: string };
    }>();
  if (!c) notFound();
  const auj = aujourdhuiParis();
  const { analyse, besoins, donnees } = await chargerAnalyse(supabase, id, c, auj);
  const i = analyse.indicateurs;
  const objectif = donnees.objectif ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/coach/clientes/${id}`} className="inline-flex items-center gap-1 text-[14px] text-texte-2">
        <IconeRetour className="size-4" /> Fiche de {c.profils.prenom}
      </Link>
      <div>
        <h1 className="font-titre text-[32px] font-bold leading-tight">Analyse & conseils</h1>
        <p className="text-[15px] text-texte-2">
          {c.profils.prenom} {c.profils.nom}
          {objectif ? ` · ${OBJECTIFS[objectif as Objectif]}` : ""} · d’après ses bilans, son journal, son plan et ses séances.
        </p>
      </div>

      {!besoins && (
        <Message ton="info">
          Pour débloquer les conseils nutrition (métabolisme, déficit, plan de départ progressif), renseigne ses besoins : taille, date de
          naissance, poids, objectif et ce qu’elle mange aujourd’hui.{" "}
          <Link href={`/coach/clientes/${id}/plan-alimentaire`} className="font-medium underline underline-offset-4">
            Renseigner ses besoins
          </Link>
        </Message>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur
          libelle="Poids"
          valeur={i.poidsActuel !== null ? `${f1(i.poidsActuel)} kg` : "—"}
          detail={i.evolutionPoids !== null ? `${signe(i.evolutionPoids)} kg depuis le début` : "pas encore de pesée"}
        />
        <Indicateur
          libelle="Rythme (4 semaines)"
          valeur={i.rythme ? `${signe(i.rythme.kgSemaine)} kg/sem` : "—"}
          detail={i.rythme ? `${signe(i.rythme.pctSemaine)} % du poids par semaine` : "au moins 3 pesées sur 2 semaines"}
        />
        <Indicateur
          libelle="Tour de taille"
          valeur={i.evolutionTaille !== null ? `${signe(i.evolutionTaille)} cm` : "—"}
          detail={donnees.tourTaille.length ? `dernière mesure : ${f1(donnees.tourTaille.at(-1)!.valeur)} cm` : "pas encore mesuré"}
        />
        <Indicateur
          libelle="Calories"
          valeur={donnees.kcalObjectif ? kcal(donnees.kcalObjectif) : "—"}
          detail={[
            donnees.kcalActuelles ? `mange ~${kcal(donnees.kcalActuelles)}` : null,
            donnees.depense ? `dépense ~${kcal(donnees.depense)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "objectif du plan"}
        />
        <Indicateur
          libelle="Protéines"
          valeur={i.proteinesParKg !== null ? `${f1(i.proteinesParKg)} g/kg` : "—"}
          detail={donnees.plan ? `${Math.round(donnees.plan.proteines)} g/jour dans son plan` : "pas de plan en ligne"}
        />
        <Indicateur
          libelle="Séances par semaine"
          valeur={i.seancesParSemaine !== null ? f1(i.seancesParSemaine) : "—"}
          detail={donnees.programme ? `${donnees.programme.seancesParSemaine} prévues` : "pas de programme en ligne"}
        />
        <Indicateur
          libelle="Pas par jour"
          valeur={i.pasMoyens !== null ? Math.round(i.pasMoyens).toLocaleString("fr-FR") : "—"}
          detail="moyenne des 2 dernières semaines"
        />
        <Indicateur
          libelle="Sommeil"
          valeur={i.sommeilMoyen !== null ? `${f1(i.sommeilMoyen)} h` : "—"}
          detail="moyenne des 2 dernières semaines"
        />
      </div>

      {analyse.paliers && (
        <Carte className="flex flex-col gap-3 border-2 border-caramel/40">
          <div>
            <h2 className="font-titre text-xl font-bold">Plan de départ progressif</h2>
            <p className="text-[14px] text-texte-2">
              Elle mange aujourd’hui ~{kcal(donnees.kcalActuelles!)}. Proposition : +100 kcal par semaine, en surveillant l’énergie, la faim et la
              digestion. Mets à jour son objectif calorique (ses besoins) à chaque palier.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {analyse.paliers.map((p) => (
              <div key={p.semaine} className="flex min-w-[96px] flex-col items-center rounded-xl bg-sable/50 px-3 py-2">
                <span className="text-[12.5px] text-texte-2">Semaine {p.semaine}</span>
                <span className="font-titre text-[18px] font-bold tabular-nums">{p.kcal.toLocaleString("fr-FR")}</span>
                <span className="text-[12px] text-texte-2">kcal/jour</span>
              </div>
            ))}
          </div>
          <Link href={`/coach/clientes/${id}/plan-alimentaire`} className="w-fit text-[14px] font-medium text-accent underline underline-offset-4">
            Ajuster son objectif calorique
          </Link>
        </Carte>
      )}

      {analyse.conseils.length === 0 ? (
        <Carte>
          <p className="text-[15px] text-texte-2">Rien de particulier à signaler pour l’instant : tout roule. 💛</p>
        </Carte>
      ) : (
        SECTIONS.map((s) => {
          const liste = analyse.conseils.filter((x) => x.niveau === s.niveau);
          if (!liste.length) return null;
          return (
            <section key={s.niveau} className="flex flex-col gap-3">
              <div>
                <h2 className="font-titre text-[22px] font-bold leading-tight">{s.titre}</h2>
                <p className="text-[13.5px] text-texte-2">{s.sousTitre}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {liste.map((x) => (
                  <CarteConseil key={x.id} c={x} />
                ))}
              </div>
            </section>
          );
        })
      )}

      <p className="rounded-xl bg-sable/40 px-4 py-3 text-[13px] text-texte-2">
        Ces pistes sont calculées automatiquement à partir de ses chiffres et de repères de coaching courants. Elles ne remplacent ni ton
        jugement ni un avis médical : en cas de signe inquiétant (perte très rapide, fatigue extrême, absence de règles, troubles du
        comportement alimentaire), oriente-la vers un médecin.
      </p>
    </div>
  );
}

function Indicateur({ libelle, valeur, detail }: { libelle: string; valeur: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-carte bg-blanc-casse p-4 shadow-douce">
      <span className="text-[13px] font-medium text-texte-2">{libelle}</span>
      <span className="font-titre text-[22px] font-bold leading-tight tabular-nums sm:text-[24px]">{valeur}</span>
      <span className="text-[12.5px] text-texte-2">{detail}</span>
    </div>
  );
}

function CarteConseil({ c }: { c: Conseil }) {
  return (
    <Carte className={cx("flex flex-col gap-2.5 border-l-4", BORDURE[c.niveau])}>
      <Etiquette ton={c.niveau === "bravo" ? "vert" : c.niveau === "important" ? "rose" : "sable"} className="w-fit">
        {c.domaine}
      </Etiquette>
      <h3 className="text-[17px] font-semibold leading-snug">{c.titre}</h3>
      <p className="text-[14px] text-texte-2">{c.constat}</p>
      <ul className="flex flex-col gap-1.5 text-[14.5px]">
        {c.actions.map((a) => (
          <li key={a} className="flex gap-2">
            <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-caramel" />
            <span>{a.replace(/^\d\.\s/, "")}</span>
          </li>
        ))}
      </ul>
      {c.lien && (
        <Link href={c.lien.href} className="w-fit text-[14px] font-medium text-accent underline underline-offset-4">
          {c.lien.libelle}
        </Link>
      )}
    </Carte>
  );
}
