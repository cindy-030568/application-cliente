// Copie les fichiers de pdf.js nécessaires au lecteur PDF dans public/pdfjs
// (worker, polices standard, cmaps, wasm). Lancé automatiquement après npm install.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(racine, "node_modules", "pdfjs-dist");
const cible = join(racine, "public", "pdfjs");
if (!existsSync(source)) process.exit(0);
mkdirSync(cible, { recursive: true });
cpSync(join(source, "build", "pdf.worker.min.mjs"), join(cible, "pdf.worker.min.mjs"));
for (const dossier of ["cmaps", "standard_fonts", "wasm"]) {
  if (existsSync(join(source, dossier))) cpSync(join(source, dossier), join(cible, dossier), { recursive: true });
}
console.log("pdf.js copié dans public/pdfjs");
