"use client";

import { useActionState, useState, useTransition } from "react";
import { BoutonEnvoi } from "@/components/bouton-envoi";
import { Bouton, CaseACocher, Champ, Message, ZoneTexte, cx } from "@/components/ui";
import type { ReglagesRappels } from "@/lib/envoi-rappels";
import { emailDeTest, enregistrerRappels, lancerRappelsMaintenant, type EtatRappelsCoach } from "./rappels-actions";

type Config = { email: boolean; push: boolean; tache: boolean };

export function FormulaireRappels({ reglages, config }: { reglages: ReglagesRappels; config: Config }) {
  const [etat, envoyer] = useActionState(enregistrerRappels, {});
  const [texteRappel, setTexteRappel] = useState(reglages.texte_rappel);
  const [etatTest, setEtatTest] = useState<EtatRappelsCoach>({});
  const [enCours, demarrer] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-2 sm:grid-cols-3">
        <Statut ok={config.email} titre="Emails (Brevo)" aide="BREVO_API_KEY" />
        <Statut ok={config.push} titre="Notifications" aide="clés de notification" />
        <Statut ok={config.tache} titre="Envoi automatique" aide="CRON_SECRET" />
      </ul>

      <form action={envoyer} className="flex flex-col gap-5">
        <CaseACocher name="rappels_actifs" defaultChecked={reglages.rappels_actifs} label="Envoyer les rappels de bilan à mes clientes" />
        <ZoneTexte
          label="Message quand le bilan s’ouvre"
          name="texte_rappel"
          maxLength={300}
          rows={2}
          required
          value={texteRappel}
          onChange={(e) => setTexteRappel(e.target.value)}
        />
        <p className="-mt-3 text-[13px] text-texte-2">{"{prenom}"} est remplacé par le prénom de ta cliente.</p>
        <Champ
          label="Relancer si le bilan n’est pas envoyé, au bout de… (jours)"
          name="relance_jours"
          type="number"
          inputMode="numeric"
          min={0}
          max={7}
          required
          defaultValue={reglages.relance_jours}
          aide="0 = pas de relance. Une seule relance par bilan."
        />
        <ZoneTexte label="Message de relance" name="texte_relance" maxLength={300} rows={2} required defaultValue={reglages.texte_relance} />
        {etat.erreur && <Message ton="erreur">{etat.erreur}</Message>}
        {etat.succes && <Message ton="succes">{etat.succes}</Message>}
        <div>
          <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
        </div>
      </form>

      <div className="flex flex-col gap-3 border-t border-ligne pt-5">
        <p className="text-[14px] text-texte-2">
          Les rappels partent chaque matin. Le premier quand le bilan s’ouvre, la relance ensuite si besoin. Jamais deux fois le même.
        </p>
        <div className="flex flex-wrap gap-3">
          <Bouton variante="contour" disabled={enCours || !config.email} onClick={() => demarrer(async () => setEtatTest(await emailDeTest(texteRappel)))}>
            M’envoyer un email de test
          </Bouton>
          <Bouton
            variante="contour"
            disabled={enCours}
            onClick={() => {
              if (window.confirm("Envoyer maintenant les rappels du jour aux clientes concernées ?"))
                demarrer(async () => setEtatTest(await lancerRappelsMaintenant()));
            }}
          >
            Envoyer les rappels du jour maintenant
          </Bouton>
        </div>
        {etatTest.succes && <Message ton="succes">{etatTest.succes}</Message>}
        {etatTest.erreur && <Message ton="erreur">{etatTest.erreur}</Message>}
      </div>

      {(!config.push || !config.tache) && <GenerateurCles push={!config.push} tache={!config.tache} />}
    </div>
  );
}

function Statut({ ok, titre, aide }: { ok: boolean; titre: string; aide: string }) {
  return (
    <li className={cx("flex flex-col rounded-xl px-3 py-2.5", ok ? "bg-succes-pale" : "bg-sable/60")}>
      <span className="text-[14px] font-medium">
        {ok ? "✓" : "○"} {titre}
      </span>
      <span className="text-[12.5px] text-texte-2">{ok ? "Prêt" : `À configurer : ${aide}`}</span>
    </li>
  );
}

const base64url = (octets: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(octets))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Crée les clés DANS le navigateur : les valeurs secrètes ne passent par aucun serveur. */
function GenerateurCles({ push, tache }: { push: boolean; tache: boolean }) {
  const [cles, setCles] = useState<{ nom: string; valeur: string; aide: string }[] | null>(null);
  const [copie, setCopie] = useState<string>();
  const generer = async () => {
    const liste: { nom: string; valeur: string; aide: string }[] = [];
    if (push) {
      const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const publique = base64url(await crypto.subtle.exportKey("raw", paire.publicKey));
      const { d } = await crypto.subtle.exportKey("jwk", paire.privateKey);
      liste.push(
        { nom: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", valeur: publique, aide: "Clé publique des notifications (pas secrète)" },
        { nom: "VAPID_PRIVATE_KEY", valeur: d ?? "", aide: "Clé privée des notifications : coche « Sensitive » dans Vercel" },
      );
    }
    if (tache) {
      liste.push({
        nom: "CRON_SECRET",
        valeur: base64url(crypto.getRandomValues(new Uint8Array(32)).buffer),
        aide: "Secret de l’envoi automatique du matin : coche « Sensitive » dans Vercel",
      });
    }
    setCles(liste);
  };
  const copier = async (nom: string, valeur: string) => {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(nom);
    } catch {
      setCopie(undefined);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-carte border border-dashed border-caramel-clair p-4">
      <h3 className="font-medium">Créer les clés des rappels (une seule fois)</h3>
      {!cles ? (
        <>
          <p className="text-[14px] text-texte-2">
            Elles sont créées ici, dans ton navigateur. Tu les colles ensuite dans Vercel : personne d’autre ne les voit.
          </p>
          <div>
            <Bouton variante="sombre" onClick={generer}>
              Créer mes clés
            </Bouton>
          </div>
        </>
      ) : (
        <>
          <p className="text-[14px]">
            Dans <strong>Vercel → ton projet → Settings → Environment Variables</strong>, ajoute ces variables, puis
            redéploie (Deployments → ⋯ → Redeploy). Ne ferme pas cette page avant.
          </p>
          {cles.map((c) => (
            <div key={c.nom} className="flex flex-col gap-1">
              <span className="text-[13px] font-medium">{c.nom}</span>
              <span className="text-[12.5px] text-texte-2">{c.aide}</span>
              <div className="flex gap-2">
                <input readOnly value={c.valeur} className="min-h-11 min-w-0 flex-1 rounded-xl border border-ligne bg-white px-3 font-mono text-[12.5px]" />
                <Bouton variante="contour" onClick={() => copier(c.nom, c.valeur)}>
                  {copie === c.nom ? "Copié ✓" : "Copier"}
                </Bouton>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
