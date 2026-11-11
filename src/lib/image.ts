"use client";

/**
 * Redimensionne une photo (1600 px max) et la réencode en JPEG dans le navigateur.
 * Effet secondaire voulu : les métadonnées (dont la position GPS) sont retirées.
 */
export async function compresserPhoto(fichier: File, cote = 1600, qualite = 0.85): Promise<Blob> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Cette photo ne peut pas être lue ici. Sur iPhone, choisis-la depuis « Photothèque » ; sinon, envoie une photo JPEG.",
    );
  }
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle);
  const hauteur = Math.round(image.height * echelle);
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Ton navigateur ne permet pas de préparer la photo.");
  ctx.drawImage(image, 0, 0, largeur, hauteur);
  image.close();
  return new Promise((resoudre, rejeter) =>
    canvas.toBlob(
      (blob) => (blob ? resoudre(blob) : rejeter(new Error("La photo n’a pas pu être préparée."))),
      "image/jpeg",
      qualite,
    ),
  );
}
