"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

/**
 * Affiche un PDF page par page (rendu pdf.js), fiable sur iPhone et Android.
 * Les pages sont dessinées à l'approche de l'écran pour rester légères.
 */
export function LecteurPdf({ url, titre }: { url: string; titre: string }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [nbPages, setNbPages] = useState(0);

  useEffect(() => {
    let annule = false;
    let doc: PDFDocumentProxy | null = null;
    let tache: PDFDocumentLoadingTask | null = null;
    let observateur: IntersectionObserver | null = null;
    const conteneur = pagesRef.current;
    if (!conteneur) return;
    conteneur.replaceChildren();

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        tache = pdfjs.getDocument({
          url,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
        });
        doc = await tache.promise;
        if (annule) return;
        setNbPages(doc.numPages);

        const largeur = conteneur.clientWidth || 360;
        const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
        const rendues = new Set<number>();

        const dessiner = async (numero: number, cadre: HTMLElement) => {
          if (!doc || rendues.has(numero)) return;
          rendues.add(numero);
          const page = await doc.getPage(numero);
          const echelle = largeur / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: echelle * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${titre}, page ${numero}`);
          await page.render({ canvas, viewport }).promise;
          if (annule) return;
          cadre.replaceChildren(canvas);
          cadre.dataset.rendue = "oui";
        };

        observateur = new IntersectionObserver(
          (entrees) => {
            for (const entree of entrees) {
              if (entree.isIntersecting) {
                const cadre = entree.target as HTMLElement;
                void dessiner(Number(cadre.dataset.page), cadre);
              }
            }
          },
          { rootMargin: "1200px 0px" },
        );

        for (let numero = 1; numero <= doc.numPages; numero++) {
          const page = await doc.getPage(numero);
          if (annule) return;
          const vue = page.getViewport({ scale: 1 });
          const cadre = document.createElement("div");
          cadre.dataset.page = String(numero);
          cadre.className = "w-full overflow-hidden rounded-xl bg-white shadow-douce";
          cadre.style.aspectRatio = `${vue.width} / ${vue.height}`;
          conteneur.appendChild(cadre);
          observateur.observe(cadre);
          if (numero === 1) {
            await dessiner(1, cadre);
            if (!annule) setEtat("pret");
          }
        }
      } catch {
        if (!annule) setEtat("erreur");
      }
    })();

    return () => {
      annule = true;
      observateur?.disconnect();
      void tache?.destroy();
    };
  }, [url, titre]);

  return (
    <div className="flex flex-col gap-3">
      {etat === "chargement" && (
        <div className="flex aspect-[1/1.414] w-full animate-pulse items-center justify-center rounded-xl bg-blanc-casse text-[14px] text-texte-2">
          Ouverture de ton plan…
        </div>
      )}
      {etat === "erreur" && (
        <p className="rounded-xl bg-accent-pale px-4 py-3 text-[14px] text-erreur">
          Le PDF ne s’affiche pas ici. Utilise le bouton « Télécharger » pour l’ouvrir.
        </p>
      )}
      <div ref={pagesRef} className="flex flex-col gap-3" aria-label={titre} />
      {etat === "pret" && nbPages > 1 && (
        <p className="text-center text-[13px] text-texte-2">{nbPages} pages</p>
      )}
    </div>
  );
}
