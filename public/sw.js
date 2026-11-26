/*
 * Service worker fitw_cindy : notifications, et séance sans réseau.
 * Seuls sont gardés sur le téléphone : l'onglet Sport (programme en cours), les pages de séance guidée,
 * les séances express déjà ouvertes
 * et les fichiers techniques de l'app (/_next/static). Jamais les bilans, photos, mesures ni autres pages.
 * Tout est effacé à la déconnexion (/auth/deconnexion) et par l'app (src/lib/hors-connexion.ts).
 */
const CACHE_SPORT = "fitw-sport-v1";
const CACHE_STATIQUE = "fitw-statique-v1";
const MAX_STATIQUE = 200;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Pages gardées pour la séance sans réseau. */
const pageSport = (chemin) =>
  chemin === "/sport" ||
  /^\/seance\/\d{1,2}$/.test(chemin) ||
  // Séances express : la liste et chaque séance ouverte une fois avec du réseau.
  chemin === "/seances-express" ||
  // Espace abonnées : la page « Bouger » (séances express et défis).
  chemin === "/espace/bouger" ||
  /^\/seance\/express\/[0-9a-f-]{36}$/.test(chemin);

const effacer = () => Promise.all([caches.delete(CACHE_SPORT), caches.delete(CACHE_STATIQUE)]);

async function limiter(cache) {
  const cles = await cache.keys();
  for (const cle of cles.slice(0, Math.max(0, cles.length - MAX_STATIQUE))) await cache.delete(cle);
}

/** Fichiers techniques de l'app (noms uniques à chaque version) : d'abord le téléphone, sinon le réseau. */
async function statique(requete) {
  const garde = await caches.match(requete, { cacheName: CACHE_STATIQUE });
  if (garde) return garde;
  const reponse = await fetch(requete);
  // Gardés seulement quand la séance sans réseau est préparée (cliente connectée, onglet Sport ouvert) :
  // après la déconnexion, plus rien n'est gardé.
  if (reponse.ok && (await caches.has(CACHE_SPORT))) {
    const cache = await caches.open(CACHE_STATIQUE);
    await cache.put(requete, reponse.clone());
    limiter(cache);
  }
  return reponse;
}

/** Programme et séances : d'abord le réseau (toujours à jour), sinon la copie gardée sur le téléphone. */
async function sport(requete, chemin, navigation) {
  const cache = await caches.open(CACHE_SPORT);
  try {
    const reponse = await fetch(requete);
    // Jamais une page de connexion ou d'erreur : seulement la vraie page, pour la cliente connectée.
    if (reponse.ok && !reponse.redirected && new URL(reponse.url).pathname === chemin) await cache.put(chemin, reponse.clone());
    return reponse;
  } catch (erreur) {
    const garde = await cache.match(chemin);
    if (garde) return garde;
    if (!navigation) throw erreur;
    return new Response(
      '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors connexion</title><body style="font-family:system-ui;background:#f5ecdc;color:#3b2314;padding:32px;text-align:center"><h1>Pas de réseau</h1><p>Cette page n’est pas disponible hors connexion. Ton programme sportif, tes séances et les séances express déjà ouvertes le sont, si tu les as ouverts avec du réseau auparavant.</p><p><a href="/sport" style="color:#d6336c">Mon programme sportif</a></p></body></html>',
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  // Déconnexion : tout ce qui est gardé sur le téléphone est effacé.
  if (url.pathname === "/auth/deconnexion" || url.pathname === "/connexion") {
    event.waitUntil(effacer());
    return;
  }
  if (requete.method !== "GET") return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(statique(requete));
    return;
  }
  const navigation = requete.mode === "navigate";
  const preparation = requete.headers.get("x-fitw-hors-connexion") === "1";
  if (pageSport(url.pathname) && (navigation || preparation) && !url.search) {
    event.respondWith(sport(requete, url.pathname, navigation));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "effacer-hors-connexion") event.waitUntil(effacer());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "fitw_cindy", {
      body: data.body || "",
      icon: "/icons/icone-v2-192.png",
      badge: "/icons/badge-v2-96.png",
      lang: "fr",
      tag: data.tag || "rappel-bilan",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (f.url.startsWith(self.location.origin) && "focus" in f) {
          f.navigate(cible);
          return f.focus();
        }
      }
      return self.clients.openWindow(cible);
    }),
  );
});
