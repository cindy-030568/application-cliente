/**
 * Tâche planifiée Netlify : chaque matin, déclenche l'envoi des rappels de bilan
 * (même rôle que la tâche « crons » de vercel.json). L'adresse /api/rappels refuse
 * toute demande qui n'a pas le secret CRON_SECRET.
 */
export default async function rappelsDuMatin(): Promise<Response> {
  const site = (process.env.SITE_URL || process.env.URL || "").replace(/\/+$/, "");
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) {
    console.warn("Rappels du matin : SITE_URL ou CRON_SECRET manquant");
    return new Response("configuration incomplète", { status: 500 });
  }
  const r = await fetch(`${site}/api/rappels`, { headers: { authorization: `Bearer ${secret}` } });
  console.log("Rappels du matin :", r.status, await r.text());
  return new Response(null, { status: r.ok ? 200 : 500 });
}

// Tous les jours à 7 h UTC (8 h ou 9 h à Paris selon la saison).
export const config = { schedule: "0 7 * * *" };
