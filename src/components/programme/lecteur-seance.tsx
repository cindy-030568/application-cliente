"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { IconeVideo } from "@/components/icones";
import { Bouton, Message, cx } from "@/components/ui";
import { cleExercice, type Exercice, type Seance } from "@/lib/programme-sportif";
import { ajouterAFile, estCoupureReseau, nouvelId } from "@/lib/hors-connexion";
import {
  RESSENTIS,
  chargeProposee,
  derniereFois,
  etapesSeance,
  formaterDuree,
  formaterKg,
  lireKg,
  phaseIntervalle,
  type Etape,
  type EtapeChrono,
  type EtapeSerie,
  type HistoriqueCharges,
  type SeanceCharges,
} from "@/lib/seance-guidee";

type Chrono = { debut: number | null; pause: number | null; cumul: number; fini: number | null };
/** Poids noté pour une série (clé « exercice#série ») ; `envoye` : enregistré dans la base. */
type Charge = { kg: number; nom: string; serie: number; envoye: boolean };
type Etat = { index: number; debut: number | null; finRepos: number | null; chrono: Chrono; ref: string | null; charges: Record<string, Charge> };
type Notation = (ref: string, lignes: { exercice: string; serie: number; kg: number }[]) => Promise<boolean>;
type Infos = { dureeMinutes: number | null; ressenti: number | null; commentaire: string };
type Resultat = { erreur?: string; succes?: string };

const CHRONO_VIDE: Chrono = { debut: null, pause: null, cumul: 0, fini: null };
const DEPART: Etat = { index: -1, debut: null, finRepos: null, chrono: CHRONO_VIDE, ref: null, charges: {} };
const nouvelleRef = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
const DECOMPTE = 3000; // « 3, 2, 1 » avant un minuteur de bloc
const GARDE = 6 * 60 * 60 * 1000; // une séance commencée se reprend pendant 6 h

/**
 * Mode séance : la cliente suit sa séance étape par étape — série, repos (minuteur), série suivante.
 * `valider` absent = aperçu de la coach (rien n'est enregistré).
 */
export function LecteurSeance(props: Proprietes) {
  // Rendu seulement dans le navigateur : la séance en cours est gardée sur le téléphone.
  const monte = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!monte) return <div className="min-h-[60dvh]" aria-busy />;
  return <Lecteur {...props} />;
}

type Proprietes = {
  seance: Seance;
  /** Identifie la séance pour reprendre là où elle s'est arrêtée. */
  cle: string;
  retour: string;
  videos?: Record<string, string>;
  lienVideo?: string | null;
  valider?: (infos: Infos, ref?: string | null) => Promise<Resultat>;
  /** Sans réseau (salle en sous-sol) : séance et poids gardés sur le téléphone, envoyés au retour du réseau. */
  horsConnexion?: { programmeId: string | null; seance: number; nom: string; seanceExpressId?: string };
  /** Poids notés les fois précédentes, par exercice. */
  historique?: HistoriqueCharges;
  /** Enregistre les poids de la séance (absent = aperçu coach : rien n'est enregistré). */
  noterCharges?: Notation;
};

/** Reprise après une sortie (vidéo, appel, appli fermée…). */
function lireSauvegarde(stockage: string, n: number): Etat | null {
  try {
    const brut = localStorage.getItem(stockage);
    const s = brut ? (JSON.parse(brut) as Etat & { maj: number; n: number }) : null;
    if (s && s.n === n && s.index >= 0 && s.index <= n && Date.now() - s.maj < GARDE) {
      return { index: s.index, debut: s.debut, finRepos: s.finRepos, chrono: s.chrono ?? CHRONO_VIDE, ref: s.ref ?? null, charges: s.charges ?? {} };
    }
  } catch {
    // stockage indisponible (navigation privée) : on repart du début
  }
  return null;
}

function Lecteur({ seance, cle, retour, videos = {}, lienVideo = null, valider, historique = {}, noterCharges, horsConnexion }: Proprietes) {
  const etapes = useMemo(() => etapesSeance(seance), [seance]);
  const n = etapes.length;
  const stockage = `seance-guidee:${cle}`;
  const [sauvegarde] = useState(() => lireSauvegarde(stockage, n));
  const [etat, setEtat] = useState<Etat>(sauvegarde ?? DEPART);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [reprise, setReprise] = useState(sauvegarde !== null);
  const son = useSon();
  useEffect(() => {
    try {
      if (etat.index < 0) localStorage.removeItem(stockage);
      else localStorage.setItem(stockage, JSON.stringify({ ...etat, maj: Date.now(), n }));
    } catch {
      // sans stockage, la séance marche quand même
    }
  }, [etat, stockage, n]);

  const enCours = etat.index >= 0 && etat.index < n;
  useEcranAllume(enCours);

  const etape: Etape | undefined = enCours ? etapes[etat.index] : undefined;
  const aller = useCallback(
    (index: number) => {
      const cible = etapes[index];
      setEtat((e) => ({
        ...e,
        index,
        debut: e.debut ?? Date.now(),
        ref: e.ref ?? nouvelleRef(),
        finRepos: cible?.type === "repos" ? Date.now() + cible.secondes * 1000 : null,
        chrono: CHRONO_VIDE,
      }));
      setReprise(false);
      setMaintenant(Date.now());
      window.scrollTo({ top: 0 });
    },
    [etapes],
  );
  const suivant = () => {
    son.debloquer();
    aller(etat.index + 1);
  };

  // Poids utilisés : saisie de l'écran en cours, proposée d'après la série d'avant ou la dernière fois.
  const [saisies, setSaisies] = useState<Record<number, string>>({});
  const kgEnCours = useMemo(() => Object.fromEntries(Object.entries(etat.charges).map(([k, c]) => [k, c.kg])), [etat.charges]);
  const poids = (e: EtapeSerie, index: number) => {
    const k = `${cleExercice(e.exercice.nom)}#${e.numero}`;
    const derniere = derniereFois(historique, cleExercice(e.exercice.nom), etat.ref);
    const propose = etat.charges[k]?.kg ?? chargeProposee(kgEnCours, cleExercice(e.exercice.nom), e.numero, derniere);
    return { k, derniere, texte: saisies[index] ?? (propose !== null ? formaterKg(propose) : "") };
  };
  const envoyer = (ref: string, aEnvoyer: [string, Charge][]) => {
    if (!noterCharges || !aEnvoyer.length) return Promise.resolve(true);
    const lignes = aEnvoyer.map(([, c]) => ({ exercice: c.nom, serie: c.serie, kg: c.kg }));
    const marquer = () =>
      setEtat((x) => ({ ...x, charges: Object.fromEntries(Object.entries(x.charges).map(([k, c]) => [k, aEnvoyer.some(([j]) => j === k) ? { ...c, envoye: true } : c])) }));
    // Sans réseau : les poids sont gardés sur le téléphone et repartiront tout seuls.
    const garder = () => {
      if (!horsConnexion) return false;
      ajouterAFile({ id: nouvelId(), type: "charges", programmeId: horsConnexion.programmeId, ref, lignes });
      marquer();
      return true;
    };
    if (horsConnexion && typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(garder());
    return noterCharges(ref, lignes)
      .then((ok) => {
        if (ok) marquer();
        return ok;
      })
      .catch((e) => (estCoupureReseau(e) ? garder() : false));
  };
  const serieFaite = (e: EtapeSerie) => {
    const { k, texte } = poids(e, etat.index);
    const kg = lireKg(texte);
    if (kg !== null && etat.ref) {
      const charge: Charge = { kg, nom: e.exercice.nom, serie: e.numero, envoye: false };
      setEtat((x) => ({ ...x, charges: { ...x.charges, [k]: charge } }));
      void envoyer(etat.ref, [[k, charge]]);
    }
    suivant();
  };
  /** Avant de valider la séance : les poids pas encore enregistrés (réseau coupé…) repartent. */
  const rattraper = () => (etat.ref ? envoyer(etat.ref, Object.entries(etat.charges).filter(([, c]) => !c.envoye)) : Promise.resolve(true));
  const precedent = () => {
    let i = etat.index - 1;
    while (i > 0 && etapes[i]?.type === "repos") i--; // on revient à la série, pas au repos
    aller(Math.max(i, 0));
  };

  // Horloge : seulement pendant un repos ou un minuteur.
  const tic = etape?.type === "repos" || (etape?.type === "chrono" && etat.chrono.debut !== null && etat.chrono.pause === null && etat.chrono.fini === null);
  const etatCourant = useRef(etat);
  useEffect(() => {
    etatCourant.current = etat;
  }, [etat]);
  const dernierBip = useRef<string>("");
  useEffect(() => {
    if (!tic) return;
    const t = setInterval(() => {
      const now = Date.now();
      setMaintenant(now);
      // Fin du repos : bips 3-2-1, puis bip long + vibration, et on passe à la suite.
      const e = etatCourant.current;
      if (etapes[e.index]?.type !== "repos" || !e.finRepos) return;
      const reste = Math.ceil((e.finRepos - now) / 1000);
      if (reste <= 0) {
        etatCourant.current = { ...e, finRepos: null };
        son.fin();
        aller(e.index + 1);
      } else if (reste <= 3 && dernierBip.current !== `${e.index}-${reste}`) {
        dernierBip.current = `${e.index}-${reste}`;
        son.bip();
      }
    }, 250);
    return () => clearInterval(t);
  }, [tic, etapes, aller, son]);

  const lienDe = (e: Exercice) => (lienVideo && videos[cleExercice(e.nom)] ? `${lienVideo}${videos[cleExercice(e.nom)]}` : null);
  const prochaine = (() => {
    for (let i = etat.index + 1; i < n; i++) if (etapes[i].type !== "repos") return etapes[i];
    return null;
  })();

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <Link href={retour} className="text-[14px] text-texte-2 underline underline-offset-4">
          {enCours ? "Quitter" : "Retour"}
        </Link>
        <span className="truncate text-[14px] font-medium">{seance.nom}</span>
        <span className="w-12 text-right text-[13px] tabular-nums text-texte-2">{enCours ? `${etat.index + 1}/${n}` : ""}</span>
      </header>
      {enCours && (
        <div className="h-1.5 overflow-hidden rounded-full bg-sable" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((etat.index + 1) / n) * 100}%` }} />
        </div>
      )}
      {reprise && enCours && (
        <p className="rounded-xl bg-sable/60 px-3 py-2 text-[13.5px]">
          Tu reprends là où tu t’étais arrêtée.{" "}
          <button type="button" className="underline underline-offset-4" onClick={() => setEtat(DEPART)}>
            Recommencer
          </button>
        </p>
      )}

      {etat.index < 0 && <Intro seance={seance} etapes={etapes} commencer={suivant} />}

      {etape?.type === "texte" && (
        <Ecran>
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-caramel-texte">{etape.titre}</p>
          <p className="whitespace-pre-line text-[19px] leading-relaxed">{etape.texte}</p>
          <Actions>
            <Bouton pleineLargeur onClick={suivant}>
              {etat.index === n - 1 ? "Terminer la séance" : etape.titre === "Échauffement" ? "C’est parti 💪" : "Suivant"}
            </Bouton>
          </Actions>
        </Ecran>
      )}

      {etape?.type === "serie" && (
        <Ecran>
          {etape.bloc && <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-caramel-texte">{etape.bloc}</p>}
          <h1 className="font-titre text-[30px] font-bold leading-tight">{etape.exercice.nom}</h1>
          <p className="w-fit rounded-full bg-chocolat px-3.5 py-1 text-[14px] font-medium text-creme">
            {etape.unite === "tour" ? "Tour" : "Série"} {etape.numero} / {etape.total}
          </p>
          {etape.exercice.repetitions && <p className="font-titre text-[40px] font-bold leading-none">{repetitions(etape.exercice.repetitions)}</p>}
          {(etape.exercice.charge || etape.exercice.tempo) && (
            <div className="flex flex-wrap gap-2 text-[14px]">
              {etape.exercice.charge && <span className="rounded-full bg-sable px-3 py-1">{etape.exercice.charge}</span>}
              {etape.exercice.tempo && <span className="rounded-full bg-sable px-3 py-1">Tempo {etape.exercice.tempo}</span>}
            </div>
          )}
          {etape.exercice.consignes && (
            <div className="rounded-xl bg-blanc-casse p-4 shadow-douce">
              <p className="text-[12.5px] font-medium uppercase tracking-[0.1em] text-caramel-texte">Consignes</p>
              <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed">{etape.exercice.consignes}</p>
            </div>
          )}
          {lienDe(etape.exercice) && (
            <Link href={lienDe(etape.exercice)!} className="inline-flex w-fit items-center gap-1.5 text-[14.5px] font-medium text-accent">
              <IconeVideo className="size-5" /> Revoir le mouvement en vidéo
            </Link>
          )}
          <ChampPoids
            key={etat.index}
            texte={poids(etape, etat.index).texte}
            changer={(t) => setSaisies((x) => ({ ...x, [etat.index]: t }))}
            derniere={poids(etape, etat.index).derniere}
            serie={etape.numero}
            ouvert={Boolean(etape.exercice.charge) || poids(etape, etat.index).texte !== ""}
          />
          <Actions precedent={etat.index > 0 ? precedent : undefined} ensuite={prochaine ? apercu(prochaine) : null}>
            <Bouton pleineLargeur className="min-h-14 text-[16.5px]" onClick={() => serieFaite(etape)}>
              {etat.index === n - 1
                ? "Terminer la séance"
                : etapes[etat.index + 1]?.type === "repos"
                  ? `Fait ✓ · Repos ${formaterDuree((etapes[etat.index + 1] as { secondes: number }).secondes)}`
                  : "Fait ✓ · Suivant"}
            </Bouton>
          </Actions>
        </Ecran>
      )}

      {etape?.type === "repos" && etat.finRepos && (
        <Ecran centre>
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-caramel-texte">Repos</p>
          <Cercle reste={Math.max(0, (etat.finRepos - maintenant) / 1000)} total={etape.secondes} />
          <div className="flex gap-3">
            <Bouton variante="contour" className="min-h-11" onClick={() => setEtat((e) => ({ ...e, finRepos: Math.max(Date.now() + 1000, (e.finRepos ?? 0) - 15000) }))}>
              −15 s
            </Bouton>
            <Bouton variante="contour" className="min-h-11" onClick={() => setEtat((e) => ({ ...e, finRepos: (e.finRepos ?? Date.now()) + 15000 }))}>
              +15 s
            </Bouton>
          </div>
          <p className="text-center text-[15px]">
            <span className="text-texte-2">Ensuite : </span>
            <strong className="font-medium">{etape.ensuite}</strong>
          </p>
          <Actions precedent={precedent}>
            <Bouton variante="sombre" pleineLargeur onClick={suivant}>
              Passer le repos
            </Bouton>
          </Actions>
        </Ecran>
      )}

      {etape?.type === "chrono" && (
        <EcranChrono
          etape={etape}
          chrono={etat.chrono}
          maintenant={maintenant}
          setChrono={(f) => setEtat((e) => ({ ...e, chrono: f(e.chrono) }))}
          demarre={() => setMaintenant(Date.now())}
          son={son}
          suivant={suivant}
          precedent={etat.index > 0 ? precedent : undefined}
          lienDe={lienDe}
          dernier={etat.index === n - 1}
        />
      )}

      {etat.index >= n && (
        <Fin
          debut={etat.debut}
          retour={retour}
          valider={
            valider &&
            (async (infos: Infos) => {
              const ref = etat.ref ?? nouvelleRef();
              // Séance gardée sur le téléphone s'il n'y a pas de réseau.
              const garder = (): Resultat | null => {
                if (!horsConnexion) return null;
                ajouterAFile({ id: nouvelId(), type: "seance", ...horsConnexion, infos, ref, faiteLe: new Date().toISOString() });
                return { succes: "Pas de réseau : ta séance est gardée sur ton téléphone. Elle me sera envoyée dès que le réseau revient 💪" };
              };
              if (horsConnexion && typeof navigator !== "undefined" && navigator.onLine === false) {
                await rattraper();
                return garder()!;
              }
              try {
                await rattraper();
                return await valider(infos, ref);
              } catch (e) {
                const garde = estCoupureReseau(e) ? garder() : null;
                return garde ?? { erreur: "La séance n’a pas pu être enregistrée. Réessaie dans un instant." };
              }
            })
          }
          charges={Object.values(etat.charges)}
          recommencer={() => setEtat(DEPART)}
          oublier={() => {
            try {
              localStorage.removeItem(stockage);
            } catch {}
          }}
        />
      )}
    </div>
  );
}

function repetitions(r: string) {
  if (/^\d+(\s*[-–à]\s*\d+)?$/.test(r.trim())) return `${r} répétitions`;
  if (/^max/i.test(r.trim())) return "Max de répétitions";
  return r;
}

function apercu(e: Etape): string {
  if (e.type === "serie") return `${e.exercice.nom} · ${e.unite === "tour" ? "tour" : "série"} ${e.numero}/${e.total}`;
  if (e.type === "chrono") return `${e.bloc ?? "Bloc"} · ${e.format}`;
  if (e.type === "texte") return e.titre;
  return "Repos";
}

function Ecran({ children, centre = false }: { children: ReactNode; centre?: boolean }) {
  return <section className={cx("flex flex-1 flex-col gap-4", centre && "items-center")}>{children}</section>;
}

/** Boutons collés en bas de l'écran (faciles à toucher pendant la séance). */
function Actions({ children, precedent, ensuite }: { children: ReactNode; precedent?: () => void; ensuite?: string | null }) {
  return (
    <div className="mt-auto flex w-full flex-col gap-3 pt-4">
      {ensuite && (
        <p className="text-center text-[13.5px] text-texte-2">
          Ensuite : <span className="font-medium text-chocolat">{ensuite}</span>
        </p>
      )}
      {children}
      {precedent && (
        <button type="button" onClick={precedent} className="min-h-10 text-[14px] text-texte-2 underline underline-offset-4">
          Étape précédente
        </button>
      )}
    </div>
  );
}

function Cercle({ reste, total, couleur = "var(--accent)" }: { reste: number; total: number; couleur?: string }) {
  const r = 88;
  const tour = 2 * Math.PI * r;
  const part = total > 0 ? Math.min(1, reste / total) : 0;
  return (
    <div className="relative grid size-56 place-items-center" role="timer" aria-label={`Reste ${formaterDuree(reste)}`}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--sable)" strokeWidth="12" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={couleur} strokeWidth="12" strokeLinecap="round" strokeDasharray={tour} strokeDashoffset={tour * (1 - part)} className="transition-[stroke-dashoffset] duration-300" />
      </svg>
      <span className="font-titre text-[54px] font-bold tabular-nums">{formaterDuree(reste)}</span>
    </div>
  );
}

function Intro({ seance, etapes, commencer }: { seance: Seance; etapes: Etape[]; commencer: () => void }) {
  const series = etapes.filter((e) => e.type === "serie").length;
  return (
    <Ecran>
      <h1 className="font-titre text-[30px] font-bold leading-tight">{seance.nom}</h1>
      <p className="text-[15px] text-texte-2">
        {[seance.duree, `${seance.blocs.length} bloc${seance.blocs.length > 1 ? "s" : ""}`, series ? `${series} séries` : null].filter(Boolean).join(" · ")}
      </p>
      <ol className="flex flex-col gap-2">
        {seance.echauffement && <li className="rounded-xl bg-sable/50 px-3 py-2 text-[14.5px]">Échauffement</li>}
        {seance.blocs.map((b, i) => (
          <li key={i} className="rounded-xl bg-blanc-casse px-3 py-2 text-[14.5px] shadow-douce">
            <span className="font-medium">{b.titre ?? `Bloc ${i + 1}`}</span>
            {b.format && <span className="text-texte-2"> · {b.format}</span>}
            <span className="block text-[13.5px] text-texte-2">{b.exercices.map((e) => e.nom).join(", ")}</span>
          </li>
        ))}
        {seance.retour_au_calme && <li className="rounded-xl bg-sable/50 px-3 py-2 text-[14.5px]">Retour au calme</li>}
      </ol>
      <div className="rounded-xl bg-accent-pale/60 p-3 text-[14px]">
        Fais ta série, touche <strong>Fait ✓</strong> : le repos démarre tout seul, puis la série suivante s’affiche. Monte le son pour entendre la fin du repos 🔔
      </div>
      <Actions>
        <Bouton pleineLargeur className="min-h-14 text-[16.5px]" onClick={commencer}>
          Commencer la séance
        </Bouton>
      </Actions>
    </Ecran>
  );
}

function EcranChrono({
  etape,
  chrono,
  maintenant,
  setChrono,
  son,
  suivant,
  precedent,
  lienDe,
  dernier,
  demarre,
}: {
  demarre: () => void;
  etape: EtapeChrono;
  chrono: Chrono;
  maintenant: number;
  setChrono: (f: (c: Chrono) => Chrono) => void;
  son: Son;
  suivant: () => void;
  precedent?: () => void;
  lienDe: (e: Exercice) => string | null;
  dernier: boolean;
}) {
  const ecoule = chrono.debut === null ? 0 : ((chrono.pause ?? maintenant) - chrono.debut - chrono.cumul) / 1000;
  const total = etape.secondes;
  const termine = chrono.fini !== null || (total !== null && ecoule >= total);
  const phase = (etape.mode === "emom" || etape.mode === "tabata") && etape.intervalle && ecoule >= 0 ? phaseIntervalle(etape.mode, etape.intervalle, ecoule) : null;
  const nbTours = etape.mode === "tabata" ? 8 : total && etape.intervalle ? Math.round(total / etape.intervalle) : null;
  const exerciceCourant = phase && etape.exercices.length ? (phase.tour - 1) % etape.exercices.length : null;

  // Bips : 3-2-1 au départ, à chaque changement de minute (EMOM) ou de phase (Tabata), et à la fin.
  const repere = useRef("");
  useEffect(() => {
    if (chrono.debut === null || chrono.pause !== null || chrono.fini !== null) return;
    let cle = "";
    if (ecoule < 0) cle = `d${Math.ceil(-ecoule)}`;
    else if (total !== null && ecoule >= total) cle = "fin";
    else if (phase) cle = `${phase.tour}-${phase.phase}`;
    if (!cle || cle === repere.current) return;
    const avant = repere.current;
    repere.current = cle;
    if (cle === "fin") {
      son.fin();
      setChrono((c) => ({ ...c, fini: total }));
    } else if (cle.startsWith("d")) son.bip();
    else if (avant !== "") son.bip(phase?.phase === "repos" ? 520 : 990, 260);
    else son.bip(990, 400); // départ
  }, [ecoule, chrono.debut, chrono.pause, chrono.fini, total, phase, son, setChrono]);

  const affichage = (() => {
    if (chrono.debut === null) return total ?? 0;
    if (ecoule < 0) return -ecoule;
    if (phase) return phase.reste;
    if (etape.mode === "fortime") return chrono.fini ?? ecoule;
    return total !== null ? Math.max(0, total - ecoule) : ecoule;
  })();

  return (
    <Ecran centre>
      {etape.bloc && <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-caramel-texte">{etape.bloc}</p>}
      <h1 className="text-center font-titre text-[28px] font-bold leading-tight">{etape.format}</h1>
      {phase && !termine && (
        <p className={cx("rounded-full px-3.5 py-1 text-[14px] font-medium", phase.phase === "repos" ? "bg-sable" : "bg-chocolat text-creme")}>
          {phase.phase === "repos" ? "Repos" : etape.mode === "emom" ? "Minute" : "Effort"} {phase.tour}
          {nbTours ? ` / ${nbTours}` : ""}
        </p>
      )}
      {chrono.debut !== null && ecoule < 0 ? (
        <p className="font-titre text-[96px] font-bold leading-none tabular-nums">{Math.ceil(-ecoule)}</p>
      ) : (
        <Cercle
          reste={affichage}
          total={phase ? (phase.phase === "repos" ? 10 : (etape.intervalle ?? 1)) : etape.mode === "fortime" ? Math.max(affichage, total ?? affichage) : (total ?? 1)}
          couleur={phase?.phase === "repos" ? "var(--caramel)" : "var(--accent)"}
        />
      )}
      {etape.mode === "fortime" && total && <p className="text-[14px] text-texte-2">Temps maximum : {formaterDuree(total)}</p>}
      {termine && (
        <p className="text-center text-[17px] font-medium">
          {etape.mode === "fortime" ? `Ton temps : ${formaterDuree(chrono.fini ?? ecoule)} 🔥` : "Temps écoulé, bravo ! 🔥"}
        </p>
      )}

      <ul className="flex w-full flex-col divide-y divide-ligne rounded-xl border border-ligne bg-white/70">
        {etape.exercices.map((e, i) => (
          <li key={i} className={cx("flex flex-col gap-0.5 px-3 py-2.5", exerciceCourant === i && !termine && "bg-accent-pale/60")}>
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[15.5px] font-medium">{e.nom}</span>
              {e.repetitions && <span className="shrink-0 text-[15px] font-semibold">{e.repetitions}</span>}
            </span>
            {(e.charge || e.consignes) && <span className="text-[13.5px] text-texte-2">{[e.charge, e.consignes].filter(Boolean).join(" · ")}</span>}
            {lienDe(e) && (
              <Link href={lienDe(e)!} className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-accent">
                <IconeVideo className="size-4" /> Vidéo
              </Link>
            )}
          </li>
        ))}
      </ul>

      <Actions precedent={precedent}>
        {termine ? (
          <Bouton pleineLargeur className="min-h-14 text-[16.5px]" onClick={suivant}>
            {dernier ? "Terminer la séance" : "Suivant"}
          </Bouton>
        ) : chrono.debut === null ? (
          <Bouton
            pleineLargeur
            className="min-h-14 text-[16.5px]"
            onClick={() => {
              son.debloquer();
              setChrono(() => ({ ...CHRONO_VIDE, debut: Date.now() + DECOMPTE }));
              demarre();
            }}
          >
            Démarrer le minuteur
          </Bouton>
        ) : (
          <div className="flex w-full gap-3">
            {chrono.pause === null ? (
              <Bouton variante="contour" className="flex-1" onClick={() => setChrono((c) => ({ ...c, pause: Date.now() }))}>
                Pause
              </Bouton>
            ) : (
              <Bouton variante="contour" className="flex-1" onClick={() => setChrono((c) => ({ ...c, cumul: c.cumul + (Date.now() - (c.pause ?? Date.now())), pause: null }))}>
                Reprendre
              </Bouton>
            )}
            {etape.mode === "fortime" ? (
              <Bouton className="flex-1" onClick={() => setChrono((c) => ({ ...c, fini: Math.max(0, ecoule) }))}>
                J’ai fini !
              </Bouton>
            ) : (
              <Bouton variante="sombre" className="flex-1" onClick={suivant}>
                Passer
              </Bouton>
            )}
          </div>
        )}
      </Actions>
    </Ecran>
  );
}

function Fin({
  debut,
  retour,
  valider,
  charges,
  recommencer,
  oublier,
}: {
  debut: number | null;
  retour: string;
  valider?: (infos: Infos) => Promise<Resultat>;
  charges: Charge[];
  recommencer: () => void;
  oublier: () => void;
}) {
  const [ressenti, setRessenti] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [resultat, setResultat] = useState<Resultat>({});
  const [enCours, demarrer] = useTransition();
  const [fin] = useState(() => Date.now());
  const minutes = debut ? Math.max(1, Math.round((fin - debut) / 60000)) : null;
  return (
    <Ecran>
      <div className="flex flex-col items-center gap-2 pt-4 text-center">
        <span className="text-[56px]" aria-hidden>
          🎉
        </span>
        <h1 className="font-titre text-[30px] font-bold leading-tight">Séance terminée !</h1>
        {minutes && <p className="text-[15px] text-texte-2">{minutes} min d’entraînement. Bravo, tu peux être fière de toi 💛</p>}
      </div>
      {charges.length > 0 && <RecapCharges charges={charges} />}
      {!valider ? (
        <Message ton="info">Aperçu coach : ta cliente valide ici sa séance avec son ressenti. Rien n’est enregistré pendant l’aperçu.</Message>
      ) : resultat.succes ? (
        <Message ton="succes">{resultat.succes}</Message>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-medium">Comment tu l’as trouvée ?</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {RESSENTIS.map((r) => (
                <button
                  key={r.valeur}
                  type="button"
                  aria-pressed={ressenti === r.valeur}
                  onClick={() => setRessenti(ressenti === r.valeur ? null : r.valeur)}
                  className={cx(
                    "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11.5px] leading-tight",
                    ressenti === r.valeur ? "border-accent bg-accent-pale" : "border-ligne bg-white",
                  )}
                >
                  <span className="text-[24px]" aria-hidden>
                    {r.emoji}
                  </span>
                  {r.libelle}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-medium">Un petit mot pour moi ? (facultatif)</span>
            <textarea
              value={commentaire}
              maxLength={500}
              rows={3}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Charges utilisées, douleur, ce qui était dur…"
              className="rounded-xl border border-ligne bg-white px-3 py-2 text-[15px]"
            />
          </label>
          {resultat.erreur && <Message ton="erreur">{resultat.erreur}</Message>}
          <Bouton
            pleineLargeur
            className="min-h-14 text-[16.5px]"
            disabled={enCours}
            onClick={() =>
              demarrer(async () => {
                const r = await valider({ dureeMinutes: minutes, ressenti, commentaire });
                setResultat(r);
                if (r.succes) oublier();
              })
            }
          >
            {enCours ? "Enregistrement…" : "Valider ma séance"}
          </Bouton>
        </>
      )}
      <div className="mt-auto flex flex-col items-center gap-2 pt-4">
        <Link href={retour} className="text-[15px] font-medium text-accent underline underline-offset-4">
          Retour à mon programme
        </Link>
        <button type="button" onClick={recommencer} className="text-[13.5px] text-texte-2 underline underline-offset-4">
          Recommencer la séance
        </button>
      </div>
    </Ecran>
  );
}

// ---------------------------------------------------------------- Son, vibration, écran allumé

type Son = { debloquer: () => void; bip: (frequence?: number, ms?: number) => void; fin: () => void };

function useSon(): Son {
  const contexte = useRef<AudioContext | null>(null);
  return useMemo(() => {
    const debloquer = () => {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        contexte.current ??= new AC();
        if (contexte.current.state === "suspended") void contexte.current.resume();
      } catch {
        // pas de son : la séance marche quand même
      }
    };
    const bip = (frequence = 880, ms = 140) => {
      const c = contexte.current;
      if (!c) return;
      try {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = frequence;
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
        o.connect(g).connect(c.destination);
        o.start();
        o.stop(c.currentTime + ms / 1000 + 0.02);
      } catch {}
    };
    const fin = () => {
      bip(990, 450);
      try {
        navigator.vibrate?.([250, 120, 250]);
      } catch {}
    };
    return { debloquer, bip, fin };
  }, []);
}

/** Garde l'écran allumé pendant la séance (quand le téléphone le permet). */
function useEcranAllume(actif: boolean) {
  useEffect(() => {
    if (!actif || !("wakeLock" in navigator)) return;
    let verrou: { release: () => Promise<void> } | null = null;
    let fini = false;
    const demander = async () => {
      try {
        const v = await (navigator as unknown as { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        if (fini) void v.release();
        else verrou = v;
      } catch {}
    };
    const auRetour = () => {
      if (document.visibilityState === "visible") void demander();
    };
    void demander();
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", auRetour);
      void verrou?.release().catch(() => {});
    };
  }, [actif]);
}

// ---------------------------------------------------------------- Poids utilisés

/** Champ « Poids utilisé » d'une série, avec le rappel de la dernière fois. */
function ChampPoids({
  texte,
  changer,
  derniere,
  serie,
  ouvert: ouvertAuDepart,
}: {
  texte: string;
  changer: (t: string) => void;
  derniere: SeanceCharges | null;
  serie: number;
  ouvert: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertAuDepart || derniere !== null);
  const pas = (delta: number) => {
    const kg = lireKg(texte) ?? 0;
    changer(formaterKg(Math.max(0, Math.min(500, kg + delta))));
  };
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="w-fit text-[14.5px] font-medium text-accent underline underline-offset-4">
        + Noter le poids utilisé
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ligne bg-white/70 p-3">
      <label htmlFor="poids-serie" className="text-[14px] font-medium">
        Poids utilisé
      </label>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Moins 1 kg" onClick={() => pas(-1)} className="size-12 shrink-0 rounded-full border-[1.5px] border-chocolat text-[22px] leading-none">
          −
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id="poids-serie"
            inputMode="decimal"
            autoComplete="off"
            value={texte}
            onChange={(e) => changer(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
            placeholder="—"
            className="h-12 w-full rounded-xl border border-ligne bg-white pr-10 text-center font-titre text-[26px] font-bold tabular-nums"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[15px] text-texte-2">kg</span>
        </div>
        <button type="button" aria-label="Plus 1 kg" onClick={() => pas(1)} className="size-12 shrink-0 rounded-full border-[1.5px] border-chocolat text-[22px] leading-none">
          +
        </button>
      </div>
      {derniere ? (
        <p className="text-[13.5px] text-texte-2">
          La dernière fois ({dateCourte.format(new Date(derniere.date))}) :{" "}
          {derniere.series.map((x, i) => (
            <span key={x.serie}>
              {i > 0 && " · "}
              <span className={x.serie === serie ? "font-semibold text-chocolat" : undefined}>{formaterKg(x.kg)}</span>
            </span>
          ))}{" "}
          kg
        </p>
      ) : (
        <p className="text-[13px] text-texte-2">Note ton poids : la prochaine fois, l’appli te le rappellera.</p>
      )}
    </div>
  );
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** Fin de séance : les poids du jour, par exercice. */
function RecapCharges({ charges }: { charges: Charge[] }) {
  const parExercice = new Map<string, Charge[]>();
  for (const c of charges) parExercice.set(c.nom, [...(parExercice.get(c.nom) ?? []), c]);
  return (
    <div className="rounded-xl bg-blanc-casse p-4 shadow-douce">
      <p className="text-[12.5px] font-medium uppercase tracking-[0.1em] text-caramel-texte">Tes poids du jour</p>
      <ul className="mt-2 flex flex-col gap-1 text-[14.5px]">
        {[...parExercice].map(([nom, liste]) => (
          <li key={nom} className="flex justify-between gap-3">
            <span>{nom}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {liste
                .sort((a, b) => a.serie - b.serie)
                .map((c) => formaterKg(c.kg))
                .join(" · ")}{" "}
              kg
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
