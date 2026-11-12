const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extrait l'identifiant d'une vidéo YouTube depuis un lien collé par la coach
 * (youtu.be, watch?v=, shorts, embed, live) ou depuis l'identifiant seul.
 */
export function idYoutube(saisie: string): string | null {
  const texte = saisie.trim();
  if (ID.test(texte)) return texte;
  let url: URL;
  try {
    url = new URL(texte.startsWith("http") ? texte : `https://${texte}`);
  } catch {
    return null;
  }
  const hote = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let candidat: string | null = null;
  if (hote === "youtu.be") {
    candidat = url.pathname.split("/")[1] ?? null;
  } else if (hote === "youtube.com" || hote === "youtube-nocookie.com") {
    if (url.pathname === "/watch") candidat = url.searchParams.get("v");
    else {
      const [, type, id] = url.pathname.split("/");
      if (["shorts", "embed", "live", "v"].includes(type)) candidat = id ?? null;
    }
  }
  return candidat && ID.test(candidat) ? candidat : null;
}

/** Lecteur « confidentialité renforcée » : pas de cookie avant la lecture. */
export function urlLecteur(id: string): string {
  const p = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1", modestbranding: "1" });
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
}

export function urlMiniature(id: string, qualite: "hq" | "mq" = "hq"): string {
  return `https://i.ytimg.com/vi/${id}/${qualite}default.jpg`;
}
