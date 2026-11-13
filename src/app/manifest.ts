import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "fitw_cindy",
    short_name: "fitw_cindy",
    description: "Ton espace de coaching nutrition et sport avec Cindy.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5ecd7",
    theme_color: "#f5ecd7",
    icons: [
      { src: "/icons/icone-v2-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icone-v2-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
