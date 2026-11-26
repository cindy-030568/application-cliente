// Supabase simulé, en mémoire, pour les tests de parcours (Playwright).
// Tests locaux uniquement : écoute sur 127.0.0.1, ne contacte jamais la vraie base.
// Données 100 % fictives (Sophie Martin, coach@exemple.fr…). Code de connexion de test : 123456.
import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
const COACH = "00000000-0000-0000-0000-00000000c0ac";
const ALICE = "00000000-0000-0000-0000-00000000000a";
const today = new Date(); const iso = (d) => d.toISOString().slice(0, 10);
const debut = new Date(today); debut.setUTCDate(debut.getUTCDate() - 26);
const profils = {
  [COACH]: { id: COACH, role: "coach", prenom: "Cindy", nom: "Witwicki", email: "coach@exemple.fr" },
  [ALICE]: { id: ALICE, role: "cliente", prenom: "Sophie", nom: "Martin", email: "sophie@exemple.fr" },
};
const fiche = (id, statut, prenom, nom, email, d, formation) => ({ id, statut, date_debut: d, date_fin: null,
  acces_formation: formation, masquer_graph_poids: false, frequence_bilan_jours: 14, ferme_le: statut === "fermee" ? iso(today) : null,
  created_at: "2026-09-01T08:00:00Z", profils: { prenom, nom, email }, rappels_email: true, recap_notif: true, recap_envoye: null, suivi_cycle: id.endsWith("b2") ? "perimenopause" : "aucun", cycle_duree: 28, rappel_complements_heure: null, code_parrainage: "CODE" + id.slice(-2).toUpperCase(), express_jusqu_au: null, defis_notif: true,
  mode_sans_chiffres: false, journal_actif: true, rappel_journal_heure: "20:30:00", suivi_sport: !(process.env.SANS_SPORT && id.endsWith("0a")), prochain_rdv: new Date(Date.now() + 3 * 86400000).toISOString(), lien_rdv: "https://meet.google.com/abc-defg-hij",
  derniere_visite: new Date(Date.now() - (id.endsWith("b3") ? 14 : 0) * 86400000).toISOString(), clientes: { statut } });
const clientes = [
  fiche(ALICE, "active", "Sophie", "Martin", "sophie@exemple.fr", iso(debut), false),
  fiche("00000000-0000-0000-0000-0000000000b2", "active", "Nathalie", "Durand", "nathalie@exemple.fr", "2026-10-05", true),
  fiche("00000000-0000-0000-0000-0000000000b3", "active", "Claire", "Petit", "claire@exemple.fr", "2026-09-21", true),
  fiche("00000000-0000-0000-0000-0000000000b4", "terminee", "Isabelle", "Moreau", "isabelle@exemple.fr", "2026-03-02", true),
];
// Sophie termine son suivi dans 5 jours : son bilan de fin de suivi est visible.
clientes[0].date_fin = iso(new Date(Date.now() + 5 * 86400000));
const reglages = { express_materiel: ["Aucun", "Tapis", "Élastique", "Haltères", "Kettlebell", "Chaise ou banc", "Corde à sauter"], express_types: ["Renfo", "Cardio", "Mobilité", "Étirements", "Marche à la maison", "Gainage"], lien_inscription: "https://tally.so/r/EkdN0A", fin_texte: "Ton accompagnement touche à sa fin, et tu peux être tellement fière du chemin parcouru 💛 Si tu as envie de continuer à avancer avec moi, voici ce que je te propose :", fin_offres: [{ titre: "Continuer mon accompagnement", description: "On continue ensemble, au même rythme ou plus en douceur : on en parle et on choisit ce qui te convient." }], notif_coach_email: true, notif_coach_bilans: true, notif_coach_signalements: true, notif_coach_messages: false, communaute_ouverte: true, communaute_charte: "Bienvenue dans la communauté fitw_cindy 💛\n• Bienveillance avant tout.\n• Pas de conseils médicaux.\n• Ce qui se dit ici reste ici.", version_consentement: "2026-11", lien_politique: "https://exemple.fr/confidentialite", lien_formation: "https://www.notion.so/exemple",
  message_formation: "Envie d'aller plus loin ? Découvre la Fitw_cindy Academy ✨", lien_contact: "https://wa.me/33600000000",
  tolerance_pct: 10, tolerance_g: 3, hors_tolerance: "masquer", rappels_actifs: true, relance_jours: 2, texte_rappel: "Coucou {prenom} ! Ton bilan est prêt : prends 5 minutes pour faire le point 💛", texte_relance: "{prenom}, ton bilan t'attend toujours. Quelques minutes suffisent, même imparfait 💛", fenetre_bilan_jours: 3, intro_bilan: "Voici les points pour faire le point sur ces {jours} derniers jours. Réponds en toute simplicité, avec tes mots à toi. Pas besoin d’être parfaite : ce bilan, c’est ton espace pour faire le point et avancer 💛" };
const jour = (n) => iso(new Date(Date.now() + n * 86400000));
const T = (cle, section, groupe, type, libelle, extra = {}) => ({ cle, section, groupe, type, libelle, unite: null, aide: null, options: null, avec_precision: false, actif: true, est_poids: false, ...extra });
const champs = [
  T("global","Ressentis & énergie","ressenti","texte","Comment te sens-tu globalement ces {jours} derniers jours ?"),
  T("energie","Ressentis & énergie","ressenti","echelle","Ton niveau d’énergie",{ aide: "1 = plutôt fatiguée · 5 = en forme · 10 = boostée" }),
  T("sommeil","Ressentis & énergie","ressenti","echelle","La qualité de ton sommeil",{ aide: "1 = pas reposée du tout · 10 = très bien reposée", avec_precision: true }),
  T("stress","Ressentis & énergie","ressenti","echelle","Ton niveau de stress",{ aide: "1 = faible · 5 = moyen · 10 = élevé" }),
  T("esprit","Ressentis & énergie","ressenti","texte","Ton état d’esprit du moment",{ aide: "Un mot, une phrase, une vibe ✨" }),
  T("plan","Nutrition & habitudes","ressenti","choix","Est-ce que ton plan te convient ?",{ aide: "Variété, quantités, organisation", options: ["Oui, complètement","Plutôt oui","Pas vraiment"], avec_precision: true }),
  T("repas","Nutrition & habitudes","ressenti","choix","Arrives-tu à finir tes repas ?",{ options: ["Oui, sans souci","Oui, mais j’ai encore faim","Non, c’est trop copieux","Ça dépend des jours"], avec_precision: true }),
  T("eau","Nutrition & habitudes","ressenti","choix","Hydratation : arrives-tu à boire suffisamment ?",{ aide: "Sens-tu une différence ?", options: ["Oui","Presque","Pas encore"], avec_precision: true }),
  T("plaisir","Nutrition & habitudes","ressenti","texte","Repas plaisir et imprévus : comment les as-tu vécus ?"),
  T("complements","Nutrition & habitudes","ressenti","choix","Compléments : arrives-tu à les prendre régulièrement ?",{ options: ["Oui","La plupart du temps","Pas vraiment","Je n’en prends pas"] }),
  T("victoires","Victoires & difficultés","ressenti","texte","2 ou 3 victoires que tu veux célébrer",{ aide: "Grandes ou petites !" }),
  T("difficultes","Victoires & difficultés","ressenti","texte","1 ou 2 difficultés rencontrées",{ aide: "Organisation, motivation, envies…" }),
  T("objectifs","Projection & engagement","ressenti","texte","Tes objectifs pour les {jours} prochains jours"),
  T("action","Projection & engagement","ressenti","texte","Une petite action concrète que tu t’engages à mettre en place"),
  T("question","Projection & engagement","ressenti","texte","Une question ou un besoin particulier ?"),
  T("poids","Mes mesures","mesure","nombre","Poids",{ unite: "kg", est_poids: true }),
  T("taille","Mes mesures","mesure","nombre","Tour de taille",{ unite: "cm", aide: "Au niveau du nombril, sans serrer." }),
  T("hanches","Mes mesures","mesure","nombre","Tour de hanches",{ unite: "cm" }),
  T("cuisse","Mes mesures","mesure","nombre","Tour de cuisse",{ unite: "cm" }),
  T("bras","Mes mesures","mesure","nombre","Tour de bras",{ unite: "cm" }),
  T("poitrine","Mes mesures","mesure","nombre","Tour de poitrine",{ unite: "cm" }),
].map((c, i) => ({ id: "c0000000-0000-0000-0000-0000000000" + String(i + 10), ordre: i + 1, ...c }));
const ch = Object.fromEntries(champs.map((c) => [c.cle, c.id]));
function bilan(id, cliente_id, date, echeance, vals, commentaire, retour, photos, saisi_par) {
  return { id, cliente_id, date_mesure: date, echeance, commentaire, saisi_par: saisi_par ?? cliente_id, envoye_le: date + "T07:30:00Z", modifie_le: null,
    bilan_valeurs: Object.entries(vals).map(([k, v]) => Array.isArray(v) ? { champ_id: ch[k], valeur_num: null, valeur_texte: v[0], precision: v[1] } : typeof v === "string" ? { champ_id: ch[k], valeur_num: null, valeur_texte: v, precision: null } : { champ_id: ch[k], valeur_num: v, valeur_texte: null, precision: null }),
    photos_bilan: (photos ?? []).map((a) => ({ id: id + a, angle: a, fichier_path: cliente_id + "/" + id + "/" + a + ".jpg" })),
    retours_bilan: retour, clientes: { statut: "active" } };
}
const bilans = [
  bilan("b0000000-0000-0000-0000-000000000004", ALICE, jour(-5), null, { poids: 67.8, taille: 80.5, sommeil: 8, energie: 8 }, "Petite mesure en plus, je me sens bien !", null, []),
  bilan("b0000000-0000-0000-0000-000000000003", ALICE, jour(-12), jour(-12), { poids: 67.6, taille: 81, hanches: 99, cuisse: 57, bras: 28.5, sommeil: 7, energie: 7, stress: 5,
      global: "Plutôt bien ! Plus d'énergie le matin, et je sens mes jeans moins serrés.", esprit: "Motivée 💪",
      plan: ["Plutôt oui", "Un peu juste le soir après le sport"], repas: "Oui, sans souci", eau: ["Presque", "Je bois plus mais j'oublie au bureau"],
      plaisir: "Un resto samedi avec des amies, j'ai savouré sans culpabiliser et j'ai repris normalement le lendemain.", complements: "La plupart du temps",
      victoires: "J'ai fait mes 3 séances\nJ'ai monté ma charge au hip thrust\nJ'ai dit non au grignotage du soir sans frustration",
      difficultes: "Organisation des repas du midi au travail", objectifs: "Préparer mes lunchs le dimanche", action: "Batch cooking le dimanche à 17h",
      question: "Est-ce que je peux remplacer le riz par des pâtes complètes ?" },
    "Semaine chargée au travail mais j'ai tenu mes repas. Le gâteau de dimanche était délicieux 😄", { contenu: "Bravo Sophie ! Ton tour de taille continue de descendre alors que le poids bouge peu : c'est exactement la recomposition qu'on cherche. On garde tout comme ça pour les 2 prochaines semaines.", created_at: jour(-11) + "T09:00:00Z", updated_at: jour(-11) + "T09:00:00Z", lu_le: null }, ["face","profil","dos"]),
  bilan("b0000000-0000-0000-0000-000000000002", ALICE, jour(-26), null, { poids: 67.9, taille: 82.5, hanches: 100, cuisse: 58, bras: 29, sommeil: 7, energie: 6, stress: 6 }, "Début du suivi, motivée !", null, ["face","profil","dos"]),
  bilan("b0000000-0000-0000-0000-000000000001", ALICE, jour(-40), null, { poids: 68.2, taille: 84, hanches: 101, cuisse: 59, bras: 29.5, sommeil: 6, energie: 5, stress: 7 }, null, null, []),
  bilan("b0000000-0000-0000-0000-000000000010", "00000000-0000-0000-0000-0000000000b2", jour(-1), jour(-1), { poids: 72.1, taille: 88, sommeil: 6, energie: 6, stress: 6 }, "Un peu fatiguée cette semaine.", null, []),
];
const noms = { groupe: ["Fessiers","Quadriceps","Ischio-jambiers","Adducteurs","Mollets","Abdominaux","Dos","Pectoraux","Épaules","Biceps","Triceps","Corps entier"],
  materiel: ["Poids du corps","Haltères","Barre","Kettlebell","Élastique","Machine","Poulie","Banc"], categorie: ["Renforcement","Haltérophilie","Cardio","Mobilité","Gainage","Échauffement"] };
let n = 0; const filtresVideo = Object.entries(noms).flatMap(([famille, l]) => l.map((nom, i) => ({ id: "fa000000-0000-0000-0000-0000000000" + String(++n).padStart(2, "0"), famille, nom, ordre: i + 1 })));
const fv = (nom) => filtresVideo.find((f) => f.nom === nom).id;
const video = (i, titre, filtres, publiee = true) => ({ id: "eeee0000-0000-0000-0000-00000000000" + i, titre, youtube_id: "abcdefghij" + i, description: i === 1 ? "L'exercice roi pour des fessiers forts. Commence léger, la technique d'abord." : null,
  points_cles: ["Haut du dos posé sur le banc, au niveau des omoplates", "Pieds à plat, à largeur de hanches", "Pousse dans les talons et serre les fessiers en haut", "Menton rentré, regard vers l'avant"],
  erreurs: ["Cambrer le bas du dos en haut du mouvement", "Pieds trop loin : ce sont les ischios qui travaillent", "Descendre trop vite"],
  publiee, created_at: "2026-11-01T08:00:00Z", videos_filtres: filtres.map((f) => ({ filtre_id: fv(f) })) });
const videos = [
  video(1, "Hip thrust à la barre", ["Fessiers","Ischio-jambiers","Barre","Banc","Renforcement"]),
  video(2, "Squat goblet", ["Quadriceps","Fessiers","Kettlebell","Haltères","Renforcement"]),
  video(3, "Soulevé de terre roumain", ["Ischio-jambiers","Fessiers","Dos","Haltères","Barre","Renforcement"]),
  video(4, "Fentes bulgares", ["Quadriceps","Fessiers","Haltères","Banc","Renforcement"]),
  video(5, "Rowing haltère un bras", ["Dos","Biceps","Haltères","Banc","Renforcement"]),
  video(6, "Planche sur les avant-bras", ["Abdominaux","Poids du corps","Gainage"]),
  video(7, "Mobilité des hanches 90/90", ["Fessiers","Adducteurs","Poids du corps","Mobilité"]),
  video(8, "Épaulé (clean) — brouillon", ["Corps entier","Barre","Haltérophilie"], false),
];
// ---- Phase 5 : aliments, recettes (données réelles du dépôt)
const DEPOT = new URL("../data/", import.meta.url).pathname;
const ciq = JSON.parse(fs.readFileSync(DEPOT + "ciqual.json", "utf8")).aliments;
const dep = JSON.parse(fs.readFileSync(DEPOT + "recettes-depart.json", "utf8"));
const catsAliment = ["Viande","Porc","Volaille","Poisson","Fruits de mer","Œuf","Produits laitiers","Gluten","Fruits à coque","Arachide","Soja","Sésame"].map((nom, i) => ({ id: "ca000000-0000-0000-0000-0000000000" + String(i + 10), nom, ordre: i + 1 }));
const catId = (nom) => catsAliment.find((c) => c.nom === nom)?.id;
const norm = (t) => t.replace(/œ/g, "oe").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const unitesDef = { "22000": ["œuf", 50], "13005": ["banane", 120], "13039": ["pomme", 150], "7111": ["tranche", 25], "7815": ["tortilla", 40], "7352": ["galette", 9], "31074": ["carré", 5], "7110": ["tranche", 40] };
const hex = (n) => n.toString(16).padStart(12, "0");
const aliments = ciq.map((a, i) => ({ id: "a1000000-0000-0000-0000-" + hex(i + 1), source: "ciqual", code_ciqual: a.c, nom: a.n, nom_recherche: norm(a.n), groupe: a.g, sous_groupe: a.sg,
  proteines_100: a.p, glucides_100: a.gl, lipides_100: a.l, kcal_100: a.k, incomplet: a.i, nom_unite: unitesDef[a.c]?.[0] ?? null, poids_unite_g: unitesDef[a.c]?.[1] ?? null,
  categories_verifiees: false, actif: true, aliments_categories: a.cat.map((c) => ({ categorie_id: catId(c), categories_aliment: { nom: c } })) }));
dep.aliments_perso.forEach((a, i) => aliments.push({ id: "a2000000-0000-0000-0000-" + hex(i + 1), source: "perso", code_ciqual: null, nom: a.nom, nom_recherche: norm(a.nom), groupe: null, sous_groupe: null,
  proteines_100: a.p, glucides_100: a.g, lipides_100: a.l, kcal_100: a.k, incomplet: false, nom_unite: null, poids_unite_g: null, categories_verifiees: true, actif: true, aliments_categories: a.categories.map((c) => ({ categorie_id: catId(c), categories_aliment: { nom: c } })) }));
const parRef = (ref) => ref.startsWith("ciqual:") ? aliments.find((a) => a.code_ciqual === ref.slice(7)) : aliments.find((a) => a.source === "perso" && a.nom === ref.slice(6));
const tagsListe = ["Rapide","Batch cooking","Végétarien","Sucré","Salé","Sans cuisson"].map((nom, i) => ({ id: "7a900000-0000-0000-0000-0000000000" + String(i + 10), nom, ordre: i + 1 }));
const recettes = (process.env.DEPART_PARTIEL ? dep.recettes.slice(0, 62) : dep.recettes).map((r, i) => ({ id: "ec000000-0000-0000-0000-" + hex(i + 1), titre: r.titre, description: r.description, photo_path: r.photo && !(process.env.DEPART_PARTIEL && i >= 58) ? "depart/" + r.photo : null, temps_prep_min: r.temps, etapes: r.etapes, astuce: r.astuce, publiee: i !== 3,
  recettes_repas: r.repas.map((t) => ({ type_repas: t })), recettes_tags: r.tags.map((t) => ({ tag_id: tagsListe.find((x) => x.nom === t)?.id })).filter((x) => x.tag_id),
  recette_ingredients: r.ingredients.map((g, ordre) => { const a = parRef(g.a); return { id: "19000000-0000-0000-0000-" + hex(i * 50 + ordre + 1), aliment_id: a.id, role: g.role, unite: g.unite, qte_base: g.base, qte_min: g.min, qte_max: g.max, pas: g.pas, note: g.note, ordre,
    aliments: { id: a.id, nom: a.nom, proteines_100: a.proteines_100, glucides_100: a.glucides_100, lipides_100: a.lipides_100, kcal_100: a.kcal_100, nom_unite: a.nom_unite, poids_unite_g: a.poids_unite_g, aliments_categories: a.aliments_categories } }; }) }));
const repasCibles = [
  { id: "4e000000-0000-4000-8000-000000000000", cliente_id: ALICE, type_repas: "petit_dejeuner", libelle: "Petit-déjeuner", ordre: 0, proteines_g: 25, glucides_g: 45, lipides_g: 12 },
  { id: "4e000000-0000-4000-8000-000000000001", cliente_id: ALICE, type_repas: "dejeuner", libelle: "Déjeuner", ordre: 1, proteines_g: 35, glucides_g: 55, lipides_g: 15 },
  { id: "4e000000-0000-4000-8000-000000000002", cliente_id: ALICE, type_repas: "collation", libelle: "Collation", ordre: 2, proteines_g: 15, glucides_g: 20, lipides_g: 6 },
  { id: "4e000000-0000-4000-8000-000000000003", cliente_id: ALICE, type_repas: "diner", libelle: "Dîner", ordre: 3, proteines_g: 35, glucides_g: 45, lipides_g: 15 },
];
const exclusionsListe = [{ cliente_id: ALICE, categorie_id: catId("Porc"), aliment_id: null, aliments: null }, { cliente_id: ALICE, categorie_id: null, aliment_id: aliments.find((a) => a.code_ciqual === "11094").id, aliments: { id: aliments.find((a) => a.code_ciqual === "11094").id, nom: "Coriandre, fraiche" } }];
const retours = bilans.filter((b) => b.retours_bilan).map((b) => ({ bilan_id: b.id, ...b.retours_bilan }));
const plans = [
  { id: "aaaaaaaa-0000-0000-0000-000000000002", cliente_id: ALICE, type: "nutrition", source: "pdf", titre: "Plan alimentaire n°1", fichier_path: ALICE + "/nutrition/v2.pdf", url: null, actif: true, vu_le: null, created_at: "2026-11-09T09:00:00Z" },
  { id: "aaaaaaaa-0000-0000-0000-000000000001", cliente_id: ALICE, type: "nutrition", source: "drive", titre: "Plan de démarrage", fichier_path: null, url: "https://drive.google.com/x", actif: false, vu_le: "2026-10-15T09:00:00Z", created_at: "2026-10-14T09:00:00Z" },
  { id: "aaaaaaaa-0000-0000-0000-000000000003", cliente_id: ALICE, type: "sport", source: "pdf", titre: "Programme semaines 7 à 12", fichier_path: ALICE + "/sport/v1.pdf", url: null, actif: true, vu_le: "2026-11-01T09:00:00Z", created_at: "2026-10-30T09:00:00Z" },
];
const categories = [
  { id: "cccccccc-0000-0000-0000-000000000001", nom: "Guides", ordre: 1 },
  { id: "cccccccc-0000-0000-0000-000000000002", nom: "Listes de courses", ordre: 2 },
  { id: "cccccccc-0000-0000-0000-000000000003", nom: "Compléments", ordre: 3 },
  { id: "cccccccc-0000-0000-0000-000000000004", nom: "Fiches pratiques", ordre: 4 },
];
const ressources = [
  { id: "eeeeeeee-0000-0000-0000-000000000001", titre: "Guide : bien démarrer", categorie_id: categories[0].id, description: "Les bases pour ton premier mois d'accompagnement.", url: "https://drive.google.com/drive/folders/1WsfO-4XL9-oFlJxrk1_tOXV3AsKJyanq", visibilite: "toutes", created_at: "2026-11-01T09:00:00Z" },
  { id: "eeeeeeee-0000-0000-0000-000000000002", titre: "Liste de courses de base", categorie_id: categories[1].id, description: null, url: "https://drive.google.com/b", visibilite: "toutes", created_at: "2026-11-02T09:00:00Z" },
  { id: "eeeeeeee-0000-0000-0000-000000000003", titre: "Ebook compléments", categorie_id: categories[2].id, description: "Magnésium, vitamine D, oméga-3 : ce qui est utile.", url: "https://drive.google.com/c", visibilite: "certaines", created_at: "2026-11-03T09:00:00Z" },
];
// Brouillon « Je mange dehors » : le même texte que la mise à jour 0037.
{
  const sql = fs.readFileSync(new URL("../supabase/migrations/0037_ressources_fiches.sql", import.meta.url), "utf8");
  const contenu = sql.split("$fiche$")[1];
  ressources.push({ id: "eeeeeeee-0000-0000-0000-000000000004", titre: "Je mange dehors", categorie_id: categories[3].id, description: "Restaurant, boulangerie, chez des amis : profiter, sans culpabiliser et sans tout remettre en question.", url: null, contenu, publiee: false, visibilite: "toutes", created_at: "2026-11-24T09:00:00Z" });
}
// Audios (0043) : un audio seul (relaxation) et la fiche « Je mange dehors » reste en brouillon.
ressources.push({ id: "eeeeeeee-0000-0000-0000-000000000005", titre: "Respirer avant de manger", categorie_id: categories[3].id, description: "3 minutes pour te poser avant le repas, et manger en pleine conscience.", url: null, contenu: null, publiee: true, visibilite: "toutes", created_at: "2026-11-05T09:00:00Z", audio_path: "aaaaaaaa-0000-4000-8000-000000000005.mp3", audio_duree: 20 });
for (const r of ressources) { r.audio_path ??= null; r.audio_duree ??= null; r.contenu ??= null; r.publiee ??= true; }
const ressourcesFavoris = [];
const ressourcesEcoutes = [];
const fichiersAudio = new Map();
// Une ressource réservée à Nathalie : Sophie ne doit jamais la trouver, même en cherchant.
ressources.push({ id: "eeeeeeee-0000-0000-0000-000000000006", titre: "Guide périménopause", categorie_id: categories[0].id, description: "Bouffées de chaleur, sommeil : mes repères.", url: "https://drive.google.com/p", contenu: null, publiee: true, visibilite: "certaines", created_at: "2026-11-06T09:00:00Z", audio_path: null, audio_duree: null });
const ressourcesClientes = [{ ressource_id: ressources[2].id, cliente_id: ALICE }, { ressource_id: "eeeeeeee-0000-0000-0000-000000000006", cliente_id: "00000000-0000-0000-0000-0000000000b2" }];
function filtrer(lignes, params) {
  let r = lignes;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset"].includes(k) || k.includes(".")) continue;
    if (v.startsWith("eq.")) r = r.filter((x) => String(x[k]) === v.slice(3));
    else if (v === "is.null") r = r.filter((x) => x[k] === null);
    else if (v.startsWith("neq.")) r = r.filter((x) => String(x[k]) !== v.slice(4));
    else if (v.startsWith("ilike.")) { const brut = v.slice(6); const m = brut.replace(/%/g, ""); r = r.filter((x) => brut.startsWith("%") ? String(x[k] ?? "").includes(m) : String(x[k] ?? "").startsWith(m)); }
    else if (v === "not.is.null") r = r.filter((x) => x[k] !== null);
    else if (v.startsWith("in.(")) { const l = v.slice(4, -1).split(",").map((x) => x.replace(/"/g, "")); r = r.filter((x) => l.includes(String(x[k]))); }
  }
  return r;
}
const notes = [{ id: "11111111-1111-1111-1111-111111111111", contenu: "Bilan visio : très motivée, petites difficultés le week-end.\nPenser à ajuster la collation.", created_at: new Date().toISOString() }];

// ---- Phase 7 : favoris et liste de courses (état en mémoire)
const favoris = [{ cliente_id: ALICE, recette_id: recettes[1].id }, { cliente_id: ALICE, recette_id: recettes[2].id }];
let nCourse = 0;
const nouvelId = () => "c0c00000-0000-0000-0000-" + hex(++nCourse);
const courses = [];
const lotDemo = "10700000-0000-0000-0000-000000000001";
for (const [nom, rayon, quantite, unite, nom_unite, coche] of [
  ["Poulet, filet", "Viandes & poissons", 240, "g", null, false], ["Riz blanc", "Féculents & pain", 120, "g", null, false],
  ["Brocoli", "Fruits & légumes", 200, "g", null, true], ["Œuf", "Crèmerie & œufs", 4, "unite", "œuf", false],
  ["Carotte", "Fruits & légumes", 100, "g", null, false], ["Sauce soja", "Épicerie salée", 20, "g", null, false]])
  courses.push({ id: nouvelId(), cliente_id: ALICE, lot: lotDemo, recette_id: recettes[10].id, recette_titre: recettes[10].titre, portions: 2, aliment_id: null, nom, rayon, quantite, unite, nom_unite, coche, created_at: new Date().toISOString() });
courses.push({ id: nouvelId(), cliente_id: ALICE, lot: null, recette_id: null, recette_titre: null, portions: null, aliment_id: null, nom: "Éponges", rayon: "Divers", quantite: null, unite: null, nom_unite: null, coche: false, created_at: new Date().toISOString() });
function corpsJson(req) {
  return new Promise((ok) => { let c = ""; req.on("data", (x) => (c += x)); req.on("end", () => { try { ok(JSON.parse(c || "null")); } catch { ok(null); } }); });
}
async function table(req, res, u, uid, lignes) {
  const miennes = lignes.filter((l) => l.cliente_id === uid);
  const cible = filtrer(miennes, u.searchParams);
  if (req.method === "GET" || req.method === "HEAD") {
    res.writeHead(200, { "content-type": "application/json", "content-range": `0-${Math.max(cible.length - 1, 0)}/${cible.length}` });
    const single = (req.headers.accept || "").includes("vnd.pgrst.object");
    return res.end(req.method === "HEAD" ? undefined : JSON.stringify(single ? cible[0] ?? null : cible));
  }
  if (req.method === "POST") {
    const b = await corpsJson(req);
    for (const l of Array.isArray(b) ? b : [b]) lignes.push({ id: nouvelId(), coche: false, created_at: new Date().toISOString(), lot: null, recette_id: null, recette_titre: null, portions: null, aliment_id: null, rayon: "Divers", quantite: null, unite: null, nom_unite: null, ...l, cliente_id: uid });
    res.writeHead(201); return res.end();
  }
  if (req.method === "PATCH") {
    const b = await corpsJson(req);
    for (const l of cible) Object.assign(l, b);
    res.writeHead(204); return res.end();
  }
  if (req.method === "DELETE") {
    for (const l of cible) lignes.splice(lignes.indexOf(l), 1);
    res.writeHead(204); return res.end();
  }
}

// ---- Phase 8 : rappels
const rappelsEnvoyes = [{ id: "4a990000-0000-0000-0000-000000000001", cliente_id: ALICE, echeance: iso(new Date(Date.now() - 12 * 86400000)), type: "ouverture", canaux: ["email", "push"], envoye_le: new Date(Date.now() - 12 * 86400000).toISOString() }];
const abonnementsPush = [];
const abonnementsCoach = [];
async function tableLibre(req, res, u, lignes, voitTout, uid) {
  const visibles = voitTout ? lignes : lignes.filter((l) => l.cliente_id === uid);
  const cible = filtrer(visibles, u.searchParams);
  if (req.method === "GET" || req.method === "HEAD") {
    res.writeHead(200, { "content-type": "application/json", "content-range": `0-${Math.max(cible.length - 1, 0)}/${cible.length}` });
    const single = (req.headers.accept || "").includes("vnd.pgrst.object");
    return res.end(req.method === "HEAD" ? undefined : JSON.stringify(single ? cible[0] ?? null : cible));
  }
  if (req.method === "POST") {
    const b = await corpsJson(req); const n = { id: nouvelId(), canaux: [], envoye_le: new Date().toISOString(), ...b };
    if (lignes.some((l) => l.cliente_id === n.cliente_id && l.echeance === n.echeance && l.type === n.type)) { res.writeHead(409, { "content-type": "application/json" }); return res.end(JSON.stringify({ code: "23505", message: "duplicate" })); }
    lignes.push(n); res.writeHead(201, { "content-type": "application/json" });
    const single = (req.headers.accept || "").includes("vnd.pgrst.object");
    return res.end(JSON.stringify(single ? n : [n]));
  }
  if (req.method === "PATCH") { const b = await corpsJson(req); for (const l of cible) Object.assign(l, b); res.writeHead(204); return res.end(); }
  if (req.method === "DELETE") { for (const l of cible) lignes.splice(lignes.indexOf(l), 1); res.writeHead(204); return res.end(); }
}


// ---- Phase 10 : communauté (état en mémoire)
const ilYa = (min) => new Date(Date.now() - min * 60000).toISOString();
const membres = [
  { cliente_id: "00000000-0000-0000-0000-0000000000b2", statut: "membre", notifications: true, dernier_vu: ilYa(600), derniere_notif: null, charte_acceptee_le: "2026-11-02T10:00:00Z" },
  { cliente_id: "00000000-0000-0000-0000-0000000000b3", statut: "exclue", notifications: false, dernier_vu: ilYa(9000), derniere_notif: null, charte_acceptee_le: "2026-11-03T10:00:00Z" },
];
if (!process.env.SANS_MEMBRE) membres.push({ cliente_id: ALICE, statut: "membre", notifications: false, dernier_vu: ilYa(300), derniere_notif: null, charte_acceptee_le: "2026-11-04T10:00:00Z" });
let nMsg = 0; const idMsg = () => "3e550000-0000-4000-8000-" + String(++nMsg).padStart(12, "0");
const messages = [
  { id: idMsg(), auteur_id: COACH, auteur_prenom: "Cindy", auteur_coach: true, texte: "Bienvenue dans la communauté les filles 💛 Présentez-vous en quelques mots : prénom, objectif, et votre petite victoire de la semaine !", photo_path: null, epingle: true, created_at: ilYa(4000) },
  { id: idMsg(), auteur_id: "00000000-0000-0000-0000-0000000000b2", auteur_prenom: "Nathalie", auteur_coach: false, texte: "Coucou ! Nathalie, 42 ans. Objectif : retrouver de l'énergie. Victoire : 3 séances cette semaine 💪", photo_path: null, epingle: false, created_at: ilYa(1500) },
  { id: idMsg(), auteur_id: "00000000-0000-0000-0000-0000000000b2", auteur_prenom: "Nathalie", auteur_coach: false, texte: "Testé le bowl poulet teriyaki ce midi, une tuerie 😍", photo_path: "00000000-0000-0000-0000-0000000000b2/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg", epingle: false, created_at: ilYa(240) },
  { id: idMsg(), auteur_id: ALICE, auteur_prenom: "Sophie", auteur_coach: false, texte: "Trop bien ! Je le note pour la semaine prochaine.", photo_path: null, epingle: false, created_at: ilYa(200) },
  { id: idMsg(), auteur_id: "00000000-0000-0000-0000-0000000000b2", auteur_prenom: "Nathalie", auteur_coach: false, texte: "Quelqu'un a une idée de collation salée pour le soir ?", photo_path: null, epingle: false, created_at: ilYa(30) },
];
const reactions = [
  { message_id: messages[0].id, auteur_id: ALICE, emoji: "coeur" }, { message_id: messages[0].id, auteur_id: "00000000-0000-0000-0000-0000000000b2", emoji: "coeur" },
  { message_id: messages[1].id, auteur_id: ALICE, emoji: "bravo" }, { message_id: messages[1].id, auteur_id: COACH, emoji: "force" },
  { message_id: messages[2].id, auteur_id: COACH, emoji: "coeur" },
];
const signalements = [{ id: "5a000000-0000-4000-8000-000000000001", message_id: messages[4].id, auteur_id: ALICE, motif: "Test de signalement", traite: false, created_at: ilYa(10) }];
const fichiersCommu = new Map();
function filtrerCommu(lignes, params) {
  let r = filtrer(lignes, params);
  for (const [k, v] of params) {
    if (v.startsWith("lt.")) r = r.filter((x) => String(x[k]) < decodeURIComponent(v.slice(3)));
    if (v.startsWith("gt.")) r = r.filter((x) => String(x[k]) > decodeURIComponent(v.slice(3)));
    if (v.startsWith("lte.")) r = r.filter((x) => String(x[k]) <= decodeURIComponent(v.slice(4)));
    if (v.startsWith("gte.")) r = r.filter((x) => x[k] != null && String(x[k]) >= decodeURIComponent(v.slice(4)));
  }
  if (params.get("order") && !params.get("order").includes("desc")) { const c = params.get("order").split(".")[0]; r = [...r].sort((a, b) => String(a[c]).localeCompare(String(b[c]))); }
  if ((params.get("order") || "").includes("desc")) { const c = params.get("order").split(".")[0]; r = [...r].sort((a, b) => String(b[c]).localeCompare(String(a[c]))); }
  const lim = Number(params.get("limit") || 0); if (lim) r = r.slice(0, lim);
  return r;
}
async function tableCommu(req, res, u, lignes, o) {
  const params = u.searchParams; const single = (req.headers.accept || "").includes("vnd.pgrst.object");
  const visibles = o.visibles ?? lignes;
  const cible = filtrerCommu(visibles, params);
  const repondre = (code, corps, extra = {}) => { res.writeHead(code, { "content-type": "application/json", ...extra }); res.end(corps === undefined ? undefined : JSON.stringify(corps)); };
  if (req.method === "GET" || req.method === "HEAD") {
    const lignesSortie = o.enrichir ? cible.map(o.enrichir) : cible;
    return repondre(200, req.method === "HEAD" ? undefined : single ? lignesSortie[0] ?? null : lignesSortie, { "content-range": `0-${Math.max(cible.length - 1, 0)}/${cible.length}` });
  }
  if (req.method === "POST") {
    const b = await corpsJson(req);
    const crees = [];
    for (const x of Array.isArray(b) ? b : [b]) {
      const n = o.creer(x);
      if (n?.erreur) return repondre(409, { code: "23505", message: n.erreur });
      if (!n?.remplace) { lignes.push(n); crees.push(n); }
    }
    return repondre(201, single ? crees[0] ?? null : crees);
  }
  if (req.method === "PATCH") { const b = await corpsJson(req); for (const l of cible) Object.assign(l, b); if ((req.headers.prefer || "").includes("return=representation")) return repondre(200, single ? cible[0] ?? null : cible); return repondre(204); }
  if (req.method === "DELETE") {
    for (const l of cible) lignes.splice(lignes.indexOf(l), 1);
    if ((req.headers.prefer || "").includes("return=representation")) return repondre(200, single ? cible[0] ?? null : cible);
    return repondre(204);
  }
}

// ---- Journal quotidien (données d'exemple pour la cliente test)
const journal = [];
if (process.env.ANALYSE_DEMO) {
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    journal.push({ cliente_id: "00000000-0000-0000-0000-00000000000a", jour: d, poids: null, tour_taille: null, sommeil: i < 7 ? 6.1 : 7.4, hydratation: 1.6, pas: i < 7 ? 5200 : 9100, trainings: null, stress: i < 7 ? 3 : 2, digestion: 4, regles: false, observations: null, updated_at: d + "T20:00:00Z" });
  }
}
{
  const debutJ = new Date(debut);
  for (let i = 0; i < 26; i++) {
    const d = new Date(debutJ); d.setUTCDate(d.getUTCDate() + i);
    if (d > today || i % 5 === 3) continue;
    journal.push({ cliente_id: ALICE, jour: iso(d), poids: i % 2 ? null : +(72.4 - i * 0.05).toFixed(1), tour_taille: i % 3 ? null : 88 - Math.floor(i / 7) * 0.5,
      sommeil: 6 + (i % 4) * 0.5, hydratation: 1.3 + (i % 3) * 0.3, pas: 6000 + (i % 5) * 1200, trainings: i % 2, stress: 1 + (i % 4), digestion: 3 + (i % 3),
      regles: i >= 8 && i <= 12, observations: i === 2 ? "Fatiguée, peu dormi" : null, updated_at: new Date().toISOString() });
  }
}

// Nathalie suit sa périménopause : 2 jours de symptômes notés.
for (const [i, symptomes] of [[1, ["bouffees", "sueurs"]], [2, ["bouffees"]]]) {
  journal.push({ cliente_id: "00000000-0000-0000-0000-0000000000b2", jour: iso(new Date(Date.now() - i * 864e5)), poids: null, tour_taille: null, sommeil: 6.5, hydratation: 1.5, pas: 7000, trainings: 0, stress: null, digestion: null, regles: false, observations: null, symptomes, updated_at: new Date().toISOString() });
}

// ---- Séances express (0040)
const seancesExpress = [
  { id: "e5000000-0000-4000-8000-000000000001", titre: "Cardio salon sans matériel", description: "Pour les jours où tu n’as que 10 minutes et ton salon.", duree_minutes: 10, materiel: [], type: "Cardio", niveau: "tous", publiee: true, visibilite: "toutes",
    contenu: { nom: "Cardio salon sans matériel", duree: "10 min", echauffement: null, blocs: [{ titre: "Circuit", format: "2 séries", exercices: [{ nom: "Squats", series: "2", repetitions: "15", repos: "10 s" }, { nom: "Jumping jacks", series: "2", repetitions: "30 s", repos: "10 s" }] }], retour_au_calme: null, notes: null } },
  { id: "e5000000-0000-4000-8000-000000000002", titre: "Mobilité du dos au tapis", description: null, duree_minutes: 15, materiel: ["Tapis"], type: "Mobilité", niveau: "debutante", publiee: true, visibilite: "toutes",
    contenu: { nom: "Mobilité du dos au tapis", blocs: [{ titre: "Mobilité", format: "1 série", exercices: [{ nom: "Chat-vache", series: "1", repetitions: "10" }] }] } },
  { id: "e5000000-0000-4000-8000-000000000003", titre: "Brouillon pas prêt", description: null, duree_minutes: 5, materiel: [], type: "Renfo", niveau: "tous", publiee: false, visibilite: "toutes",
    contenu: { nom: "Brouillon", blocs: [{ titre: "x", format: "1 série", exercices: [{ nom: "Pompes", series: "1", repetitions: "5" }] }] } },
];
// ---- Défis du mois (0042) : un défi pas en cours pour toutes, un brouillon.
const defis = [
  { id: "d3f10000-0000-4000-8000-000000000001", titre: "Bouger un peu plus chaque jour", description: "Une marche après le déjeuner, les escaliers plutôt que l’ascenseur : on bouge ensemble ce mois-ci !", type: "pas", seuil: 8000, objectif: 15, debut: jour(-10), fin: jour(20), audience: "toutes", publie: true, annonce_le: null },
  { id: "d3f10000-0000-4000-8000-000000000003", titre: "Mon journal, mon rituel", description: null, type: "journal", seuil: null, objectif: 3, debut: jour(-5), fin: jour(20), audience: "toutes", publie: true, annonce_le: null },
  { id: "d3f10000-0000-4000-8000-000000000002", titre: "Brouillon sommeil", description: null, type: "sommeil", seuil: 7, objectif: 10, debut: jour(0), fin: jour(20), audience: "toutes", publie: false, annonce_le: null },
];
const defisParticipations = [];
const reussitesDefi = (d, cid) => {
  const fin = d.fin < jour(0) ? d.fin : jour(0);
  if (d.type === "seances") return 0;
  return journal.filter((j) => j.cliente_id === cid && j.jour >= d.debut && j.jour <= fin && (d.type === "journal" || (j[d.type] ?? 0) >= d.seuil)).length;
};
const defiPourMoi = (d, uid) => { const c = clientes.find((x) => x.id === uid); return Boolean(c) && (d.audience === "toutes" ? c.statut === "active" || c.statut === "terminee" : membres.some((m) => m.cliente_id === uid && m.statut === "membre")); };
const celebrerDefi = (d, p) => {
  if (!p.afficher_prenom || !p.reussi_le || p.celebre_le || !reglages.communaute_ouverte) return;
  p.celebre_le = new Date().toISOString();
  messages.push({ id: idMsg(), auteur_id: COACH, auteur_prenom: "Cindy", auteur_coach: true, texte: `🎉 Bravo ${profils[p.cliente_id]?.prenom ?? clientes.find((c) => c.id === p.cliente_id)?.profils.prenom} : défi « ${d.titre} » relevé ! Je suis tellement fière de toi 💛`, photo_path: null, epingle: false, created_at: new Date().toISOString() });
};
const seancesExpressClientes = [];
const seancesExpressFavoris = [];
// Accès à vie après le suivi (0044).
const accesExpress = (uid) => { const c = clientes.find((x) => x.id === uid); return Boolean(c) && (c.statut === "active" || c.statut === "terminee"); };

// ---- Avis (0039)
const avisListe = [];

// ---- Fin de suivi (0038)
const demandesSuite = [];

// ---- Planning des repas (0036)
const planningRepas = [];

// ---- Compléments (0035)
const complementsListe = [{ id: "c0e00000-0000-4000-8000-000000000000", cliente_id: ALICE, nom: "Oméga 3", moment: "matin", quantite: "2 capsules", note: "pendant le petit-déjeuner", ordre: 0, actif: true, created_at: "2026-11-01T08:00:00Z" }];
const complementsPris = [];

// ---- Plan alimentaire (0015)
const besoinsClientes = [];
const messagesCliente = [];
if (process.env.ANALYSE_DEMO) {
  besoinsClientes.push({ cliente_id: ALICE, sexe: "femme", date_naissance: "1990-05-01", taille_cm: 165, poids_kg: 68, poids_objectif_kg: 63, masse_grasse_pct: null, formule: "mifflin", nap_actuel: 1.5, nap_objectif: 1.6, kcal_objectif: null, pct_lipides: 35, pct_glucides: 40, pct_proteines: 25, fibres_g: 30, kcal_actuelles: 1150, objectif: "perte", updated_at: new Date().toISOString() });
}
const plansAlim = [];
let nPlanAlim = 0;
function routePlanAlim(req, res, u, uid, coach) {
  if (u.pathname === "/rest/v1/besoins_clientes") return tableCommu(req, res, u, besoinsClientes, {
    visibles: coach ? besoinsClientes : [],
    creer: (b) => { const ex = besoinsClientes.find((x) => x.cliente_id === b.cliente_id); if (ex) { Object.assign(ex, b); return { remplace: true }; } return { ...b }; },
  });
  if (u.pathname === "/rest/v1/plans_alimentaires") return tableCommu(req, res, u, plansAlim, {
    visibles: coach ? plansAlim : plansAlim.filter((x) => x.cliente_id === uid && x.publie),
    enrichir: (x) => { const c = clientes.find((k) => k.id === x.cliente_id); return { ...x, clientes: c ? { profils: { prenom: c.profils.prenom, nom: c.profils.nom } } : null }; },
    creer: (b) => { const now = new Date().toISOString(); return { id: "9a000000-0000-4000-8000-" + String(++nPlanAlim).padStart(12, "0"), titre: "Plan alimentaire", contenu: { repas: [] }, recommandations: "", publie: false, publie_le: null, vu_le: null, created_at: now, updated_at: now, ...b }; },
  });
  if (u.pathname === "/rest/v1/programmes_sportifs") return tableCommu(req, res, u, programmesSportifs, {
    visibles: coach ? programmesSportifs : programmesSportifs.filter((x) => x.cliente_id === uid && x.publie),
    creer: (b) => { const now = new Date().toISOString(); return { id: "9b000000-0000-4000-8000-" + String(programmesSportifs.length + 1).padStart(12, "0"), titre: "Programme sportif", contenu: { seances: [] }, publie: false, publie_le: null, vu_le: null, renouveler_le: null, rappel_renouvellement_le: null, debut_le: null, annonce_le: null, created_at: now, updated_at: now, ...b }; },
  });
  return null;
}
const programmesSportifs = [];
// Programme en ligne pour Sophie (séance hors connexion) : une séance courte, 1 exercice, 2 séries.
programmesSportifs.push({ id: "9b000000-0000-4000-8000-0000000000f1", cliente_id: ALICE, titre: "Programme semaines 1 à 6", publie: true, publie_le: new Date(Date.now() - 7 * 864e5).toISOString(), vu_le: new Date().toISOString(),
  renouveler_le: new Date(Date.now() + 35 * 864e5).toISOString().slice(0, 10), rappel_renouvellement_le: null, debut_le: null, annonce_le: null, created_at: "2026-11-01T08:00:00Z", updated_at: "2026-11-01T08:00:00Z",
  contenu: { titre: "Programme semaines 1 à 6", duree: "6 semaines", frequence: "2 séances par semaine", conseils: null, seances: [
    { nom: "Bas du corps", jour: "Lundi", duree: "20 min", echauffement: null, retour_au_calme: null, notes: null, blocs: [{ titre: null, format: null, exercices: [
      { nom: "Squat goblet", series: "2", repetitions: "10", charge: null, repos: "30 s", tempo: null, consignes: "Dos droit" }] }] }] } });
const seancesFaites = [];
// Une séance précédente (il y a 3 jours) pour le rappel « la dernière fois ».
const chargesSeries = [
  // Il y a 12 jours : 10 kg ; il y a 3 jours : 14 kg → « Nouveau record » (victoire hors balance).
  ...[1, 2, 3].map((serie) => ({ cliente_id: "00000000-0000-0000-0000-00000000000a", seance_ref: "21000000-0000-4000-8000-000000000000", exercice_cle: "squat goblet", exercice_nom: "Squat goblet", serie, charge_kg: "10.0", faite_le: new Date(Date.now() - 12 * 864e5 + serie * 60000).toISOString() })),
  ...[1, 2, 3, 4].map((serie) => ({ cliente_id: "00000000-0000-0000-0000-00000000000a", seance_ref: "21000000-0000-4000-8000-000000000001", exercice_cle: "squat goblet", exercice_nom: "Squat goblet", serie, charge_kg: serie < 3 ? "12.0" : "14.0", faite_le: new Date(Date.now() - 3 * 864e5 + serie * 60000).toISOString() })),
];
const annonces = [];
const paiementsClientes = [];
const echeancesPaiement = [];
const revenusDivers = [];
if (process.env.REVENUS_DEMO) {
  const B2 = "00000000-0000-0000-0000-0000000000b2", B3 = "00000000-0000-0000-0000-0000000000b3";
  paiementsClientes.push({ cliente_id: ALICE, formule: "Accompagnement 3 mois", montant_total: 450, moyen: "virement", nb_fois: 3, note: null, premier_montant: 225, rappels: true });
  paiementsClientes.push({ cliente_id: B2, formule: "Accompagnement 2 mois", montant_total: 360, moyen: "virement", nb_fois: 2, note: null, premier_montant: 180, rappels: true });
  paiementsClientes.push({ cliente_id: B3, formule: "Bilan + plan", montant_total: 199, moyen: "carte", nb_fois: 1, note: null, premier_montant: null, rappels: true });
  const E = (n, cliente_id, date_echeance, montant, payee_le) => ({ id: "ec000000-0000-4000-8000-" + String(900 + n).padStart(12, "0"), cliente_id, date_echeance, montant, payee_le, note: null, created_at: "2026-09-01T00:00:00Z" });
  echeancesPaiement.push(E(1, ALICE, "2026-09-15", 225, "2026-09-15"), E(2, ALICE, "2026-10-15", 112.5, "2026-10-20"), E(3, ALICE, "2026-11-10", 112.5, null),
    E(4, B2, "2026-10-05", 180, "2026-10-05"), E(5, B2, "2026-12-05", 180, null), E(6, B3, "2026-09-21", 199, "2026-09-21"));
  revenusDivers.push({ id: "5e000000-0000-4000-8000-000000000001", date_revenu: "2026-11-02", libelle: "Atelier batch cooking", montant: 45, moyen: "carte", cliente_id: null, note: null, created_at: "2026-11-02T10:00:00Z" });
}
let nEch = 0;
function routePaiements(req, res, u, uid, coach) {
  if (u.pathname === "/rest/v1/paiements_clientes") return tableCommu(req, res, u, paiementsClientes, {
    visibles: coach ? paiementsClientes : [],
    creer: (b) => { const ex = paiementsClientes.find((x) => x.cliente_id === b.cliente_id); if (ex) { Object.assign(ex, b); return { remplace: true }; } return { ...b }; },
  });
  if (u.pathname === "/rest/v1/echeances_paiement") return tableCommu(req, res, u, echeancesPaiement, {
    visibles: coach ? echeancesPaiement : [],
    creerPlusieurs: true,
    creer: (b) => ({ id: "ec000000-0000-4000-8000-" + String(++nEch).padStart(12, "0"), payee_le: null, created_at: new Date().toISOString(), ...b }),
  });
  return null;
}
function routeCommunaute(req, res, u, uid, coach) {
  const membre = coach || membres.some((m) => m.cliente_id === uid && m.statut === "membre");
  if (u.pathname === "/rest/v1/membres_communaute") return tableCommu(req, res, u, membres, {
    visibles: coach ? membres : membres.filter((m) => m.cliente_id === uid),
    enrichir: (m) => { const c = clientes.find((x) => x.id === m.cliente_id); return { ...m, clientes: c ? { statut: c.statut, profils: { prenom: c.profils.prenom, nom: c.profils.nom } } : null }; },
    creer: () => ({ cliente_id: uid, statut: "membre", notifications: false, dernier_vu: new Date().toISOString(), derniere_notif: null, charte_acceptee_le: new Date().toISOString() }),
  });
  if (u.pathname === "/rest/v1/messages_communaute") return tableCommu(req, res, u, messages, {
    visibles: membre ? messages : [],
    creer: (b) => ({ id: idMsg(), auteur_id: uid, auteur_prenom: profils[uid]?.prenom || clientes.find((c) => c.id === uid)?.profils.prenom || "Membre", auteur_coach: coach, texte: b.texte ?? "", photo_path: b.photo_path ?? null, epingle: false, created_at: new Date().toISOString() }),
  });
  if (u.pathname === "/rest/v1/reactions_communaute") return tableCommu(req, res, u, reactions, {
    visibles: membre ? (req.method === "DELETE" ? reactions.filter((r) => r.auteur_id === uid) : reactions) : [],
    creer: (b) => reactions.some((r) => r.message_id === b.message_id && r.auteur_id === uid && r.emoji === b.emoji) ? { erreur: "duplicate" } : { message_id: b.message_id, auteur_id: uid, emoji: b.emoji },
  });
  if (u.pathname === "/rest/v1/signalements_communaute") return tableCommu(req, res, u, signalements, {
    visibles: coach ? signalements : signalements.filter((s) => s.auteur_id === uid),
    enrichir: (s) => { const m = messages.find((x) => x.id === s.message_id); return { ...s, profils: { prenom: profils[s.auteur_id]?.prenom || clientes.find((c) => c.id === s.auteur_id)?.profils.prenom }, messages_communaute: m ? { texte: m.texte, auteur_prenom: m.auteur_prenom, photo_path: m.photo_path, created_at: m.created_at } : null }; },
    creer: (b) => signalements.some((x) => x.message_id === b.message_id && x.auteur_id === uid) ? { erreur: "duplicate" } : { id: "5a000000-0000-4000-8000-" + String(signalements.length + 1).padStart(12, "0"), message_id: b.message_id, auteur_id: uid, motif: b.motif ?? null, traite: false, created_at: new Date().toISOString() },
  });
  return null;
}

// ---- Phase 2 : demandes Tally, contrat, brouillon Claude (état en mémoire)
const demandes = [];
const acceptations = [];
let derniereRequeteClaude = null;
Object.assign(reglages, { brouillon_claude: true, contrat_texte: null, contrat_version: null, contrat_case_renonciation: null, contrat_depuis: null });
const CONTRAT_TEST = { contrat_texte: "CONTRAT D'ACCOMPAGNEMENT (texte de test)\n\nCliente : {{prenom}} {{nom}} – {{email}}\nAdresse : {{adresse}}\nNée le : {{date_naissance}}\n\nArticle 1 - Objet\nFormule : {{formule}} – {{montant_total}} – paiement {{paiement}}.\n\nArticle 2 - Durée\n12 semaines à compter de la première connexion.", contrat_version: "1", contrat_case_renonciation: "Je demande que mon accompagnement commence immédiatement (phrase de test fournie par la coach).", contrat_depuis: new Date(Date.now() - 86400000).toISOString() };
async function routeTest(req, res, u) {
  const json = (corps) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(corps)); };
  if (u.pathname === "/__test/contrat") { const b = await corpsJson(req); Object.assign(reglages, b?.actif ? CONTRAT_TEST : { contrat_texte: null, contrat_version: null, contrat_case_renonciation: null }); if (!b?.actif) acceptations.length = 0; return json({ ok: true }); }
  if (u.pathname === "/__test/claude") return json(derniereRequeteClaude);
  if (u.pathname === "/__test/demandes") return json(demandes);
  if (u.pathname === "/__test/seances") return json(seancesFaites);
  if (u.pathname === "/__test/ressources") return json({ ressources, favoris: ressourcesFavoris, ecoutes: ressourcesEcoutes, audios: [...fichiersAudio.keys()] });
  if (u.pathname === "/__test/defis") {
    // { decaler: n } : décale les dates des défis publiés de n jours (pour tester un défi à venir), puis on revient avec -n.
    const b = req.method === "POST" ? await corpsJson(req) : null;
    if (b?.decaler) for (const d of defis) { const dec = (x) => iso(new Date(new Date(x + "T12:00:00Z").getTime() + b.decaler * 864e5)); d.debut = dec(d.debut); d.fin = dec(d.fin); }
    return json({ defis, participations: defisParticipations, messages: messages.filter((m) => m.texte.startsWith("🎉")) });
  }
  if (u.pathname === "/__test/questionnaire") { const b = await corpsJson(req); if (b) { questionnaireActif = Boolean(b.actif); if (!b.actif) reponsesArrivee.length = 0; } return json({ actif: questionnaireActif, reponses: reponsesArrivee, exclusions: exclusionsListe }); }
  res.writeHead(404); return res.end();
}
/** Même remplacement des variables que la fonction SQL rendre_contrat (version simplifiée pour les tests). */
function rendreContrat(id, adresse, naissance) {
  const p = profils[id] ?? clientes.find((c) => c.id === id)?.profils ?? {};
  const pai = paiementsClientes.find((x) => x.cliente_id === id);
  const fr = (d) => d.split("-").reverse().join("/");
  return String(reglages.contrat_texte ?? "")
    .replaceAll("{{prenom}}", p.prenom || "—").replaceAll("{{nom}}", p.nom || "—").replaceAll("{{email}}", p.email || "—")
    .replaceAll("{{adresse}}", adresse || "[ton adresse, à remplir ci-dessous]")
    .replaceAll("{{date_naissance}}", naissance ? fr(naissance) : "[ta date de naissance, à remplir ci-dessous]")
    .replaceAll("{{formule}}", pai?.formule || "—").replaceAll("{{montant_total}}", pai?.montant_total != null ? `${pai.montant_total} €` : "—")
    .replaceAll("{{paiement}}", !pai ? "—" : pai.nb_fois > 1 ? `Échelonné (en ${pai.nb_fois} fois)` : "Intégral");
}
/** API Claude simulée (ANTHROPIC_BASE_URL) : renvoie un brouillon figé et garde la requête pour les tests. */
async function routeClaude(req, res) {
  derniereRequeteClaude = await corpsJson(req);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: "msg_test", type: "message", role: "assistant", model: derniereRequeteClaude?.model ?? "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
    content: [{ type: "text", text: "Coucou [prénom] ! Bravo pour tes 3 séances 💪\n\nMa priorité pour toi ces 15 prochains jours : préparer tes lunchs le dimanche.\n\nOn laisse de côté le reste pour l'instant. Je suis fière de toi !" }],
    usage: { input_tokens: 900, output_tokens: 120 } }));
}

// ---- Phase 3 : questionnaire d'arrivée (désactivé tant qu'un test ne l'active pas)
let questionnaireActif = false;
const Q = (ordre, section, libelle, type, options = [], obligatoire = false, aide = null, extra = {}) => ({ id: crypto.randomUUID(), ordre, section, libelle, aide, type, options, obligatoire, actif: true, cible: null, condition: null, ...extra });
const questionsArrivee = [
  Q(10, "Ton objectif", "Quel est ton objectif principal ?", "objectif", ["Perdre du gras", "Me sentir mieux sans viser un poids (maintien)", "Prendre du muscle ou du poids", "Me tonifier : perdre du gras et gagner du muscle"], true),
  Q(20, "Ton objectif", "Dans 3 mois, qu'est-ce qui te ferait dire que l'accompagnement a réussi ?", "texte_long", [], true),
  Q(30, "Ton alimentation", "Allergies, intolérances ou aliments que tu ne manges pas", "exclusions", [], false, "Coche ce qui te concerne."),
  Q(40, "Ton alimentation", "Combien de repas prends-tu par jour, en général ?", "choix", ["2", "3", "4", "5 ou plus"], true),
  Q(130, "Ton cycle (facultatif)", "Ton cycle", "choix", ["Règles régulières", "Cycle irrégulier", "Je préfère ne pas répondre"], false, "Facultatif."),
  Q(5, "Ton profil", "Ta taille (en cm)", "nombre", [], true, null, { cible: "taille_cm" }),
  Q(140, "6. Ton activité physique", "T'entraînes-tu en salle ou chez toi ?", "choix", ["En salle", "Chez moi", "Les deux"], false, null, { condition: "sport" }),
  Q(150, "7. Ton plan alimentaire", "Féculents", "aliments", ["Riz", "Pâtes", "Quinoa"], false, "Décoche les aliments que tu ne veux pas."),
].sort((a, b) => a.ordre - b.ordre);
const reponsesArrivee = [];

// ---- Tâche du matin : passage du jour, à 7 h (horloge Supabase)
const septHeures = new Date(); septHeures.setUTCHours(6, 0, 12, 0);
const tachesDuMatin = [{ jour: iso(septHeures), source: "supabase", statut: "ok", debut_le: septHeures.toISOString(), fin_le: septHeures.toISOString(), compteurs: { rappels: 1 } }];

// ---- Connexion : code à 6 chiffres (toujours 123456 ici), jeton non signé lu par sub().
const CODE_TEST = "123456";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function session(id) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, exp, role: "authenticated", aud: "authenticated", email: profils[id].email })}.c2ln`;
  return { access_token, refresh_token: "r-" + id, token_type: "bearer", expires_in: 3600, expires_at: exp,
    user: { id, aud: "authenticated", role: "authenticated", email: profils[id].email, user_metadata: { mot_de_passe_defini: true }, app_metadata: {} } };
}
async function routeAuth(req, res, u) {
  const json = (code, corps) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(corps)); };
  const b = req.method === "POST" ? await corpsJson(req) : null;
  const parEmail = (email) => Object.values(profils).find((p) => p.email === String(email ?? "").toLowerCase());
  if (u.pathname === "/auth/v1/otp") return json(200, {});
  if (u.pathname === "/auth/v1/verify") {
    const p = parEmail(b?.email);
    if (!p || b?.token !== CODE_TEST) return json(403, { code: "otp_expired", error_code: "otp_expired", msg: "Token has expired or is invalid" });
    return json(200, session(p.id));
  }
  if (u.pathname === "/auth/v1/token") {
    const id = String(b?.refresh_token ?? "").replace(/^r-/, "");
    return profils[id] ? json(200, session(id)) : json(400, { error: "invalid_grant" });
  }
  if (u.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
  return json(404, {});
}

// ---- Réponses d'un bilan (rangées dans le bilan, comme les lit l'app)
async function routeValeurs(req, res, u, uid, coach) {
  const visibles = bilans.filter((b) => coach || b.cliente_id === uid).flatMap((b) => b.bilan_valeurs.map((v) => Object.assign(v, { bilan_id: b.id })));
  const cible = filtrer(visibles, u.searchParams);
  if (req.method === "DELETE") {
    for (const b of bilans) b.bilan_valeurs = b.bilan_valeurs.filter((v) => !cible.includes(v));
    res.writeHead(204); return res.end();
  }
  if (req.method === "POST") {
    const corps = await corpsJson(req);
    for (const v of Array.isArray(corps) ? corps : [corps]) {
      const b = bilans.find((x) => x.id === v.bilan_id && (coach || x.cliente_id === uid));
      if (!b) { res.writeHead(403, { "content-type": "application/json" }); return res.end(JSON.stringify({ code: "42501", message: "refusé" })); }
      b.bilan_valeurs = b.bilan_valeurs.filter((x) => x.champ_id !== v.champ_id);
      b.bilan_valeurs.push({ champ_id: v.champ_id, valeur_num: v.valeur_num ?? null, valeur_texte: v.valeur_texte ?? null, precision: v.precision ?? null });
    }
    res.writeHead(201); return res.end();
  }
  res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(cible));
}

function sub(req) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  try { return JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).sub; } catch { return null; }
}
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); const uid = sub(req);
  const single = (req.headers.accept || "").includes("vnd.pgrst.object");
  const send = (body) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(single && Array.isArray(body) ? body[0] ?? null : body)); };
  if (process.env.SIMULE_JOURNAL) console.log(req.method, u.pathname);
  if (u.pathname === "/storage/v1/object/sign/photos" && req.method === "POST") {
    let corps = ""; req.on("data", (c) => (corps += c)); req.on("end", () => {
      const { paths } = JSON.parse(corps || "{}");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify((paths ?? []).map((p) => ({ path: p, signedURL: "/object/sign/photos/" + p + "?token=faux", error: null }))));
    }); return;
  }
  // Téléchargement d'une photo de bilan (PDF du bilan de fin) : une petite image PNG.
  if (u.pathname.startsWith("/storage/v1/object/photos/") && req.method === "GET") {
    res.writeHead(200, { "content-type": "image/png" });
    return res.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP42rQTAAUpAk8zGDhpAAAAAElFTkSuQmCC", "base64"));
  }
  if (u.pathname.startsWith("/storage/v1/object/sign/photos/")) {
    const angle = u.pathname.includes("face") ? "face" : u.pathname.includes("profil") ? "profil" : "dos";
    const ton = u.pathname.includes("000000000003") ? "#d9b48f" : "#e6c9a8";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#efe4d0"/><ellipse cx="150" cy="80" rx="38" ry="44" fill="${ton}"/><path d="M95 400 C90 250 100 170 150 150 C200 170 210 250 205 400Z" fill="${ton}"/><text x="150" y="385" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#6e5440">${angle}</text></svg>`;
    res.writeHead(200, { "content-type": "image/svg+xml", "access-control-allow-origin": "*" }); return res.end(svg);
  }

  if (u.pathname === "/storage/v1/object/sign/communaute" && req.method === "POST") {
    let corps = ""; req.on("data", (c) => (corps += c)); req.on("end", () => {
      const { paths } = JSON.parse(corps || "{}");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify((paths ?? []).map((p) => ({ path: p, signedURL: "/object/sign/communaute/" + p + "?token=faux", error: null }))));
    }); return;
  }
  if (u.pathname.startsWith("/storage/v1/object/sign/communaute/")) {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/sign/communaute/", ""));
    const f = fichiersCommu.get(chemin);
    if (f) { res.writeHead(200, { "content-type": "image/jpeg", "access-control-allow-origin": "*" }); return res.end(f); }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e9d6bd"/><circle cx="200" cy="150" r="95" fill="#fff"/><circle cx="170" cy="130" r="30" fill="#c98a4b"/><circle cx="235" cy="140" r="26" fill="#7aa35a"/><circle cx="200" cy="190" r="30" fill="#f2e3b3"/></svg>`;
    res.writeHead(200, { "content-type": "image/svg+xml", "access-control-allow-origin": "*" }); return res.end(svg);
  }
  if (u.pathname.startsWith("/storage/v1/object/upload/sign/communaute/") && req.method === "POST" && !u.searchParams.get("token")) {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/upload/sign/communaute/", ""));
    return send({ url: "/object/upload/sign/communaute/" + chemin + "?token=jeton-faux" });
  }
  if (u.pathname.startsWith("/storage/v1/object/upload/sign/communaute/") && req.method === "PUT") {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/upload/sign/communaute/", ""));
    const morceaux = []; req.on("data", (c) => morceaux.push(c)); req.on("end", () => {
      fichiersCommu.set(chemin, Buffer.concat(morceaux)); console.log("PHOTO déposée", chemin, Buffer.concat(morceaux).length, "octets");
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify({ Key: "communaute/" + chemin }));
    }); return;
  }
  if (u.pathname === "/storage/v1/object/communaute" && req.method === "DELETE") {
    let corps = ""; req.on("data", (c) => (corps += c)); req.on("end", () => {
      const { prefixes } = JSON.parse(corps || "{}"); for (const p of prefixes ?? []) { fichiersCommu.delete(p); console.log("PHOTO supprimée", p); }
      res.writeHead(200, { "content-type": "application/json" }); res.end("[]");
    }); return;
  }
  // Audios des ressources (0043) : lien temporaire, lecture (le fichier déposé, sinon un son d'essai), dépôt et suppression.
  if (u.pathname.startsWith("/storage/v1/object/sign/audios/") && req.method === "POST") {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/sign/audios/", ""));
    return send({ signedURL: "/object/sign/audios/" + chemin + "?token=faux" });
  }
  if (u.pathname.startsWith("/storage/v1/object/sign/audios/") && req.method === "GET") {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/sign/audios/", ""));
    const corps = fichiersAudio.get(chemin) ?? fs.readFileSync(new URL("./audio/essai.mp3", import.meta.url));
    const plage = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    if (plage) {
      const debut = Number(plage[1]); const fin = plage[2] ? Number(plage[2]) : corps.length - 1;
      res.writeHead(206, { "content-type": "audio/mpeg", "accept-ranges": "bytes", "content-range": `bytes ${debut}-${fin}/${corps.length}`, "content-length": fin - debut + 1, "access-control-allow-origin": "*" });
      return res.end(corps.subarray(debut, fin + 1));
    }
    res.writeHead(200, { "content-type": "audio/mpeg", "accept-ranges": "bytes", "content-length": corps.length, "access-control-allow-origin": "*" });
    return res.end(corps);
  }
  if (u.pathname.startsWith("/storage/v1/object/upload/sign/audios/") && req.method === "POST" && !u.searchParams.get("token")) {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/upload/sign/audios/", ""));
    return send({ url: "/object/upload/sign/audios/" + chemin + "?token=jeton-faux" });
  }
  if (u.pathname.startsWith("/storage/v1/object/upload/sign/audios/") && req.method === "PUT") {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/upload/sign/audios/", ""));
    const morceaux = []; req.on("data", (c) => morceaux.push(c)); req.on("end", () => {
      fichiersAudio.set(chemin, Buffer.concat(morceaux)); console.log("AUDIO déposé", chemin, Buffer.concat(morceaux).length, "octets");
      res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify({ Key: "audios/" + chemin }));
    }); return;
  }
  if (u.pathname === "/storage/v1/object/audios" && req.method === "DELETE") {
    let corps = ""; req.on("data", (c) => (corps += c)); req.on("end", () => {
      const { prefixes } = JSON.parse(corps || "{}"); for (const p of prefixes ?? []) { fichiersAudio.delete(p); console.log("AUDIO supprimé", p); }
      res.writeHead(200, { "content-type": "application/json" }); res.end("[]");
    }); return;
  }
  if (u.pathname.startsWith("/storage/v1/object/sign/plans/") && req.method === "POST") {
    const chemin = decodeURIComponent(u.pathname.replace("/storage/v1/object/sign/plans/", ""));
    return send({ signedURL: "/object/sign/plans/" + chemin + "?token=faux" });
  }
  if (u.pathname.startsWith("/storage/v1/object/sign/plans/")) {
    const fichier = u.pathname.includes("/nutrition/") ? "nutrition.pdf" : "sport.pdf";
    res.writeHead(200, { "content-type": "application/pdf", "access-control-allow-origin": "*" });
    return res.end(fs.readFileSync(new URL("./pdf/" + fichier, import.meta.url)));
  }
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,PATCH" }); return res.end(); }
  if (u.pathname === "/rest/v1/rpc/reglages_membre") { corpsJson(req).then((b) => { const m = membres.find((x) => x.cliente_id === uid); if (m && b?.p_vu) m.dernier_vu = new Date().toISOString(); if (m && typeof b?.p_notifications === "boolean") m.notifications = b.p_notifications; res.writeHead(204); res.end(); }); return; }
  if (u.pathname === "/rest/v1/rpc/mon_paiement") {
    const p = paiementsClientes.find((x) => x.cliente_id === uid);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(p ? { formule: p.formule, montant_total: p.montant_total, moyen: p.moyen, nb_fois: p.nb_fois,
      echeances: echeancesPaiement.filter((e) => e.cliente_id === uid).sort((a, b) => a.date_echeance.localeCompare(b.date_echeance)).map((e) => ({ date_echeance: e.date_echeance, montant: e.montant, payee: !!e.payee_le })) } : null));
  }
  if (u.pathname === "/rest/v1/rpc/publier_plan_alimentaire") { corpsJson(req).then((b) => { const pl = plansAlim.find((x) => x.id === b?.p_plan); if (pl) { if (b.p_publie) { for (const x of plansAlim) if (x.cliente_id === pl.cliente_id) x.publie = false; Object.assign(pl, { publie: true, publie_le: new Date().toISOString(), vu_le: null }); } else pl.publie = false; } res.writeHead(204); res.end(); }); return; }
  if (u.pathname === "/rest/v1/rpc/publier_programme_sportif") { corpsJson(req).then((b) => { const pl = programmesSportifs.find((x) => x.id === b?.p_programme); if (pl) { if (b.p_publie) { for (const x of programmesSportifs) if (x.cliente_id === pl.cliente_id) x.publie = false; Object.assign(pl, { publie: true, publie_le: new Date().toISOString(), vu_le: null }); } else pl.publie = false; } res.writeHead(204); res.end(); }); return; }
  if (u.pathname === "/rest/v1/rpc/programme_sportif_vu") { corpsJson(req).then((b) => { const pl = programmesSportifs.find((x) => x.id === b?.p_programme && x.cliente_id === uid && x.publie); if (pl && !pl.vu_le) pl.vu_le = new Date().toISOString(); res.writeHead(204); res.end(); }); return; }
  if (u.pathname === "/rest/v1/rpc/plan_alimentaire_vu") { corpsJson(req).then((b) => { const pl = plansAlim.find((x) => x.id === b?.p_plan && x.cliente_id === uid && x.publie); if (pl && !pl.vu_le) pl.vu_le = new Date().toISOString(); res.writeHead(204); res.end(); }); return; }
  if (u.pathname === "/rest/v1/rpc/activer_programmes_planifies") { corpsJson(req).then((b) => {
    const jour = new Date().toISOString().slice(0, 10); const estCoach = profils[uid]?.role === "coach" || String(req.headers.apikey || "").startsWith("sb_secret");
    const scope = estCoach ? b?.p_cliente ?? null : uid; const sortie = [];
    const clientesP = [...new Set(programmesSportifs.filter((p) => !p.publie && !p.publie_le && p.debut_le && p.debut_le <= jour && (!scope || p.cliente_id === scope)).map((p) => p.cliente_id))];
    for (const c of clientesP) {
      const act = programmesSportifs.find((q) => q.cliente_id === c && q.publie); const debutAct = act ? act.debut_le ?? act.publie_le.slice(0, 10) : null;
      const cand = programmesSportifs.filter((p) => p.cliente_id === c && !p.publie && !p.publie_le && p.debut_le && p.debut_le <= jour && (!debutAct || p.debut_le > debutAct)).sort((a, z) => z.debut_le.localeCompare(a.debut_le))[0];
      if (!cand) continue;
      const suiv = programmesSportifs.filter((p) => p.cliente_id === c && !p.publie && !p.publie_le && p.debut_le > cand.debut_le).map((p) => p.debut_le).sort()[0];
      for (const x of programmesSportifs) if (x.cliente_id === c) x.publie = false;
      const fin = suiv ?? new Date(Date.parse(cand.debut_le) + 42 * 864e5).toISOString().slice(0, 10);
      Object.assign(cand, { publie: true, publie_le: new Date().toISOString(), vu_le: null, renouveler_le: fin, rappel_renouvellement_le: null });
      sortie.push(cand.id);
    }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(sortie)); }); return; }
  if (u.pathname === "/rest/v1/rpc/message_cliente_lu") { corpsJson(req).then((b) => { const m = messagesCliente.find((x) => x.id === b?.p_message && x.cliente_id === uid); if (m && !m.lu_le) m.lu_le = new Date().toISOString(); res.writeHead(204); res.end(); }); return; }
  if (u.pathname === "/rest/v1/rpc/ma_prochaine_bascule") { const jour = new Date().toISOString().slice(0, 10);
    const d = programmesSportifs.filter((p) => p.cliente_id === uid && !p.publie && !p.publie_le && p.debut_le && p.debut_le > jour).map((p) => p.debut_le).sort()[0] ?? null;
    res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(d)); }
  if (u.pathname === "/rest/v1/rpc/contrat_a_accepter") {
    const due = reglages.contrat_version && clientes.some((c) => c.id === uid) && !acceptations.some((a) => a.cliente_id === uid);
    res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(due ? reglages.contrat_version : null));
  }
  if (u.pathname === "/rest/v1/rpc/accepter_contrat") return corpsJson(req).then((b) => {
    const ok = b?.p_accepte && b?.p_renonciation && b?.p_version === reglages.contrat_version;
    if (ok && (!b.p_adresse || !b.p_date_naissance)) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ code: "23514", message: "adresse manquante" })); }
    if (ok) acceptations.push({ id: crypto.randomUUID(), cliente_id: uid, version: reglages.contrat_version, texte: rendreContrat(uid, b.p_adresse, b.p_date_naissance), accepte_le: new Date().toISOString(), renonciation_retractation: true, texte_renonciation: reglages.contrat_case_renonciation, adresse: b.p_adresse, date_naissance: b.p_date_naissance });
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(Boolean(ok)));
  });
  if (u.pathname === "/rest/v1/rpc/mon_contrat_apercu" || u.pathname === "/rest/v1/rpc/apercu_contrat") return corpsJson(req).then((b) => {
    const cible = b?.p_cliente ?? uid;
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(reglages.contrat_texte ? rendreContrat(cible, null, null) : null));
  });
  if (u.pathname === "/rest/v1/rpc/questionnaire_a_remplir") {
    const du = questionnaireActif && clientes.some((c) => c.id === uid) && !reponsesArrivee.some((r) => r.cliente_id === uid);
    res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(du));
  }
  if (u.pathname === "/rest/v1/rpc/envoyer_questionnaire") return corpsJson(req).then((b) => {
    const nouveau = !reponsesArrivee.some((r) => r.cliente_id === uid);
    if (nouveau) {
      reponsesArrivee.push({ cliente_id: uid, reponses: b?.p_reponses ?? [], envoye_le: new Date().toISOString(), objectif: b?.p_objectif ?? null, besoins: b?.p_besoins ?? null });
      for (const id of b?.p_categories ?? []) if (!exclusionsListe.some((e) => e.cliente_id === uid && e.categorie_id === id)) exclusionsListe.push({ cliente_id: uid, categorie_id: id, aliment_id: null, aliments: null });
    }
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(nouveau));
  });
  if (u.pathname === "/rest/v1/rpc/definir_suivi_cycle") return corpsJson(req).then((b) => { const c = clientes.find((x) => x.id === uid); if (c) Object.assign(c, { suivi_cycle: b?.p_mode, cycle_duree: b?.p_duree }); res.writeHead(204); res.end(); });
  if (u.pathname === "/rest/v1/rpc/definir_rappel_complements") return corpsJson(req).then((b) => { const c = clientes.find((x) => x.id === uid); if (c) c.rappel_complements_heure = b?.p_heure ?? null; res.writeHead(204); res.end(); });
  if (u.pathname === "/rest/v1/rpc/definir_recap_notif") return corpsJson(req).then((b) => { const c = clientes.find((x) => x.id === uid); if (c) c.recap_notif = Boolean(b?.p_actif); res.writeHead(204); res.end(); });
  if (u.pathname === "/rest/v1/rpc/mon_contrat_infos") {
    const t = String(reglages.contrat_texte ?? "");
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ demande_adresse: t.includes("{{adresse}}"), demande_date_naissance: t.includes("{{date_naissance}}"), date_naissance: null }));
  }
  if (u.pathname === "/rest/v1/rpc/ma_progression_defi") return corpsJson(req).then((b) => {
    const d = defis.find((x) => x.id === b?.p_defi && x.publie && defiPourMoi(x, uid));
    if (!d) return send([]);
    const parts = defisParticipations.filter((p) => p.defi_id === d.id);
    const moi = parts.find((p) => p.cliente_id === uid);
    const n = moi ? Math.min(reussitesDefi(d, uid), d.objectif) : null;
    if (moi && !moi.reussi_le && n >= d.objectif) { moi.reussi_le = new Date().toISOString(); moi.notifie_le = moi.reussi_le; celebrerDefi(d, moi); }
    const groupe = parts.length >= 3 ? Math.round((100 * parts.reduce((s, p) => s + Math.min(reussitesDefi(d, p.cliente_id) / d.objectif, 1), 0)) / parts.length) : null;
    return send([{ reussites: n, objectif: d.objectif, reussi: Boolean(moi?.reussi_le), groupe, participantes: parts.length }]);
  });
  if (u.pathname === "/rest/v1/rpc/progressions_defi") return corpsJson(req).then((b) => {
    const d = defis.find((x) => x.id === b?.p_defi);
    if (profils[uid]?.role !== "coach" || !d) return send([]);
    return send(defisParticipations.filter((p) => p.defi_id === d.id).map((p) => ({ cliente_id: p.cliente_id, reussites: reussitesDefi(d, p.cliente_id), reussi_le: p.reussi_le, afficher_prenom: p.afficher_prenom })));
  });
  if (u.pathname === "/rest/v1/rpc/afficher_prenom_defi") return corpsJson(req).then((b) => {
    const p = defisParticipations.find((x) => x.defi_id === b?.p_defi && x.cliente_id === uid);
    if (p) { p.afficher_prenom = Boolean(b.p_afficher); if (p.afficher_prenom) celebrerDefi(defis.find((x) => x.id === p.defi_id), p); }
    res.writeHead(204); res.end();
  });
  if (u.pathname === "/rest/v1/rpc/definir_defis_notif") return corpsJson(req).then((b) => { const c = clientes.find((x) => x.id === uid); if (c) c.defis_notif = Boolean(b?.p_actif); res.writeHead(204); res.end(); });
  if (u.pathname.startsWith("/rest/v1/rpc/")) { res.writeHead(204); return res.end(); }
  if (u.pathname === "/auth/v1/user") return send({ id: uid, aud: "authenticated", role: "authenticated", email: profils[uid]?.email, user_metadata: { mot_de_passe_defini: true } });
  if (u.pathname.startsWith("/auth/v1/")) return routeAuth(req, res, u);
  if (u.pathname.startsWith("/__test/")) return routeTest(req, res, u);
  if (u.pathname === "/anthropic/v1/messages") return routeClaude(req, res);
  const eqId = (u.searchParams.get("id") || u.searchParams.get("cliente_id") || "").replace("eq.", "");
  const admin = String(req.headers.apikey || "").startsWith("sb_secret");
  const coach = profils[uid]?.role === "coach" || admin;
  if (u.pathname === "/rest/v1/besoins_clientes" || u.pathname === "/rest/v1/plans_alimentaires" || u.pathname === "/rest/v1/programmes_sportifs") return routePlanAlim(req, res, u, uid, coach);
  if (u.pathname === "/rest/v1/bilans") return tableCommu(req, res, u, bilans, {
    visibles: coach ? bilans : bilans.filter((b) => b.cliente_id === uid),
    creer: (b) => ({ id: crypto.randomUUID(), cliente_id: b.cliente_id ?? uid, date_mesure: b.date_mesure, echeance: b.echeance ?? null, commentaire: b.commentaire ?? null,
      saisi_par: uid, envoye_le: new Date().toISOString(), modifie_le: null, bilan_valeurs: [], photos_bilan: [], retours_bilan: null, clientes: { statut: "active" } }),
  });
  if (u.pathname === "/rest/v1/bilan_valeurs") return routeValeurs(req, res, u, uid, coach);
  if (u.pathname === "/rest/v1/questions_arrivee") return tableCommu(req, res, u, questionsArrivee, {
    visibles: coach ? questionsArrivee : questionsArrivee.filter((q) => q.actif),
    creer: (b) => (coach ? { id: crypto.randomUUID(), aide: null, options: [], obligatoire: false, actif: true, ordre: 0, section: "", ...b } : { erreur: "refusé" }),
  });
  if (u.pathname === "/rest/v1/reponses_arrivee") return tableCommu(req, res, u, reponsesArrivee, { visibles: coach ? reponsesArrivee : reponsesArrivee.filter((r) => r.cliente_id === uid), creer: () => ({ erreur: "refusé" }) });
  if (u.pathname === "/rest/v1/demandes_inscription") return tableCommu(req, res, u, demandes, {
    visibles: coach ? demandes : [],
    creer: (b) => (admin ? { id: crypto.randomUUID(), recue_le: new Date().toISOString(), statut: "a_valider", nom: "", reponses: [], categories_exclues: [], doublon_de: null, cliente_id: null, ...b } : { erreur: "refusé" }),
  });
  if (u.pathname === "/rest/v1/acceptations_contrat") return tableCommu(req, res, u, acceptations, { visibles: coach ? acceptations : acceptations.filter((a) => a.cliente_id === uid), creer: () => ({ erreur: "refusé" }) });
  if (u.pathname === "/rest/v1/taches_du_matin") return tableCommu(req, res, u, tachesDuMatin, { visibles: coach ? tachesDuMatin : [], creer: () => ({ erreur: "refusé" }) });
  if (u.pathname === "/rest/v1/charges_series") {
    if (req.method === "POST") { corpsJson(req).then((b) => { for (const l of Array.isArray(b) ? b : [b]) { const ex = chargesSeries.find((x) => x.cliente_id === l.cliente_id && x.seance_ref === l.seance_ref && x.exercice_cle === l.exercice_cle && x.serie === l.serie); if (ex) Object.assign(ex, l); else chargesSeries.push({ faite_le: new Date().toISOString(), ...l }); } res.writeHead(201, { "content-type": "application/json" }); res.end("[]"); }); return; }
    return tableCommu(req, res, u, chargesSeries, { visibles: coach ? chargesSeries : chargesSeries.filter((x) => x.cliente_id === uid), creer: (b) => b });
  }
  if (u.pathname === "/rest/v1/messages_cliente") return tableCommu(req, res, u, messagesCliente, {
    visibles: coach ? messagesCliente : messagesCliente.filter((m) => m.cliente_id === uid && m.statut === "envoye"),
    creer: (b) => ({ id: "3e000000-0000-4000-8000-" + String(messagesCliente.length + 1).padStart(12, "0"), cree_le: new Date().toISOString(), lu_le: null, ...b }),
  });
  if (u.pathname === "/rest/v1/seances_faites") return tableCommu(req, res, u, seancesFaites, {
    visibles: coach ? seancesFaites : seancesFaites.filter((x) => x.cliente_id === uid),
    // Même identifiant de séance (ref_locale) : déjà enregistrée, rien en plus (comme la contrainte unique de la base).
    creer: (b) => (b.ref_locale && seancesFaites.some((x) => x.cliente_id === uid && x.ref_locale === b.ref_locale)
      ? { remplace: true }
      : { id: "5f000000-0000-4000-8000-" + String(seancesFaites.length + 1).padStart(12, "0"), cliente_id: uid, faite_le: new Date().toISOString(), duree_minutes: null, ressenti: null, commentaire: null, ...b }),
  });
  if (u.pathname === "/rest/v1/annonces") return tableCommu(req, res, u, annonces, {
    visibles: coach ? annonces : annonces.filter((a) => a.expire_le > new Date().toISOString()),
    creer: (b) => ({ id: "a0000000-0000-4000-8000-" + String(annonces.length + 1).padStart(12, "0"), lien: null, cree_le: new Date().toISOString(), expire_le: new Date(Date.now() + 86400000).toISOString(), ...b }),
  });
  if (u.pathname === "/rest/v1/ressources_clientes") return tableCommu(req, res, u, ressourcesClientes, { visibles: coach ? ressourcesClientes : ressourcesClientes.filter((r) => r.cliente_id === uid), creer: (b) => (coach ? b : { erreur: "interdit" }) });
  if (u.pathname === "/rest/v1/ressources") {
    if (!coach && req.method !== "GET") { res.writeHead(403); return res.end(); }
    return tableCommu(req, res, u, ressources, {
      visibles: coach ? ressources : ressources.filter((r) => r.publiee !== false && (r.visibilite === "toutes" || ressourcesClientes.some((l) => l.ressource_id === r.id && l.cliente_id === uid))),
      creer: (b) => ({ id: "eeeeeeee-0000-0000-0000-0000000000" + String(ressources.length + 10), created_at: new Date().toISOString(), contenu: null, publiee: true, url: null, ...b }),
    });
  }
  if (u.pathname === "/rest/v1/ressources_favoris") return tableCommu(req, res, u, ressourcesFavoris, {
    visibles: coach ? ressourcesFavoris : ressourcesFavoris.filter((x) => x.cliente_id === uid),
    creer: (b) => (coach || !ressources.some((r) => r.id === b.ressource_id && r.publiee !== false) ? { erreur: "interdit" } : ressourcesFavoris.some((x) => x.cliente_id === uid && x.ressource_id === b.ressource_id) ? { remplace: true } : { created_at: new Date().toISOString(), ...b, cliente_id: uid }),
  });
  if (u.pathname === "/rest/v1/ressources_ecoutes") return tableCommu(req, res, u, ressourcesEcoutes, {
    visibles: coach ? ressourcesEcoutes : ressourcesEcoutes.filter((x) => x.cliente_id === uid),
    enrichir: (e) => ({ ...e, ressources: (({ titre, audio_duree }) => ({ titre, audio_duree }))(ressources.find((r) => r.id === e.ressource_id) ?? { titre: "?", audio_duree: null }) }),
    creer: (b) => {
      if (coach) return { erreur: "interdit" };
      const ex = ressourcesEcoutes.find((x) => x.cliente_id === uid && x.ressource_id === b.ressource_id);
      if (ex) { Object.assign(ex, b, { cliente_id: uid }); return { remplace: true }; }
      return { terminee: false, ...b, cliente_id: uid };
    },
  });
  if (u.pathname === "/rest/v1/seances_express") {
    if (!coach && req.method !== "GET" && req.method !== "HEAD") { res.writeHead(403); return res.end(); }
    return tableCommu(req, res, u, seancesExpress, {
      visibles: coach ? seancesExpress : seancesExpress.filter((x) => x.publiee && accesExpress(uid) && (x.visibilite === "toutes" || seancesExpressClientes.some((l) => l.seance_id === x.id && l.cliente_id === uid))),
      creer: (b) => ({ id: "e5000000-0000-4000-8000-" + String(seancesExpress.length + 10).padStart(12, "0"), description: null, materiel: [], niveau: "tous", publiee: false, visibilite: "toutes", ...b }),
    });
  }
  if (u.pathname === "/rest/v1/seances_express_clientes") return tableCommu(req, res, u, seancesExpressClientes, { visibles: coach ? seancesExpressClientes : seancesExpressClientes.filter((x) => x.cliente_id === uid), creer: (b) => (coach ? b : { erreur: "interdit" }) });
  if (u.pathname === "/rest/v1/seances_express_favoris") return tableCommu(req, res, u, seancesExpressFavoris, {
    visibles: coach ? seancesExpressFavoris : seancesExpressFavoris.filter((x) => x.cliente_id === uid),
    creer: (b) => (coach ? { erreur: "interdit" } : seancesExpressFavoris.some((x) => x.cliente_id === uid && x.seance_id === b.seance_id) ? { remplace: true } : { created_at: new Date().toISOString(), ...b, cliente_id: uid }),
  });
  if (u.pathname === "/rest/v1/defis") {
    if (!coach && req.method !== "GET" && req.method !== "HEAD") { res.writeHead(403); return res.end(); }
    return tableCommu(req, res, u, defis, {
      visibles: coach ? defis : defis.filter((d) => d.publie && defiPourMoi(d, uid)),
      creer: (b) => ({ id: "d3f10000-0000-4000-8000-" + String(defis.length + 10).padStart(12, "0"), description: null, audience: "toutes", publie: false, annonce_le: null, ...b }),
    });
  }
  if (u.pathname === "/rest/v1/defis_participations") return tableCommu(req, res, u, defisParticipations, {
    enrichir: (p) => ({ ...p, defis: { titre: defis.find((d) => d.id === p.defi_id)?.titre ?? "" } }),
    visibles: coach ? defisParticipations : defisParticipations.filter((x) => x.cliente_id === uid && (req.method !== "DELETE" || !x.reussi_le)),
    creer: (b) => {
      const d = defis.find((x) => x.id === b.defi_id);
      if (coach || !d || !d.publie || !defiPourMoi(d, uid) || d.debut > jour(0) || d.fin < jour(0)) return { erreur: "interdit" };
      if (defisParticipations.some((x) => x.defi_id === b.defi_id && x.cliente_id === uid)) return { erreur: "doublon" };
      return { afficher_prenom: false, ...b, cliente_id: uid, inscrite_le: new Date().toISOString(), reussi_le: null, notifie_le: null, celebre_le: null };
    },
  });
  if (u.pathname === "/rest/v1/avis") return tableCommu(req, res, u, avisListe, {
    visibles: coach ? avisListe : avisListe.filter((x) => x.cliente_id === uid),
    enrichir: (x) => { const c = clientes.find((y) => y.id === x.cliente_id); return { ...x, clientes: c ? { profils: { prenom: c.profils.prenom, nom: c.profils.nom } } : null }; },
    creer: (b) => (coach ? { erreur: "interdit" } : { id: "a7000000-0000-4000-8000-" + String(avisListe.length + 1).padStart(12, "0"), cree_le: new Date().toISOString(), modifie_le: new Date().toISOString(), contexte: "libre", nom_affiche: null, ...b, cliente_id: uid }),
  });
  if (u.pathname === "/rest/v1/demandes_suite") return tableCommu(req, res, u, demandesSuite, {
    visibles: coach ? demandesSuite : demandesSuite.filter((x) => x.cliente_id === uid),
    creer: (b) => (coach ? { erreur: "interdit" } : { id: "d5000000-0000-4000-8000-" + String(demandesSuite.length + 1).padStart(12, "0"), cree_le: new Date().toISOString(), traitee: false, ...b, cliente_id: uid }),
  });
  if (u.pathname === "/rest/v1/planning_repas") return tableCommu(req, res, u, planningRepas, {
    visibles: coach ? planningRepas : planningRepas.filter((x) => x.cliente_id === uid),
    enrichir: (x) => ({ ...x, recettes: { titre: recettes.find((r) => r.id === x.recette_id)?.titre ?? "?" } }),
    creer: (b) => { const ex = planningRepas.find((x) => x.cliente_id === uid && x.jour === b.jour && x.repas_cible_id === b.repas_cible_id); if (ex) { Object.assign(ex, b); return { remplace: true }; } return { portions: 1, ...b, cliente_id: uid }; },
  });
  if (u.pathname === "/rest/v1/complements") return tableCommu(req, res, u, complementsListe, {
    visibles: coach ? complementsListe : complementsListe.filter((x) => x.cliente_id === uid),
    creer: (b) => (coach ? { id: "c0e00000-0000-4000-8000-" + String(complementsListe.length + 10).padStart(12, "0"), note: null, ordre: 0, actif: true, created_at: new Date().toISOString(), ...b } : { erreur: "interdit" }),
  });
  if (u.pathname === "/rest/v1/complements_pris") return tableCommu(req, res, u, complementsPris, {
    visibles: coach ? complementsPris : complementsPris.filter((x) => x.cliente_id === uid),
    creer: (b) => (complementsPris.some((x) => x.complement_id === b.complement_id && x.jour === b.jour) ? { remplace: true } : { pris_le: new Date().toISOString(), ...b, cliente_id: uid }),
  });
  if (u.pathname === "/rest/v1/journal_quotidien") return tableCommu(req, res, u, journal, {
    visibles: coach ? journal : journal.filter((j) => j.cliente_id === uid),
    creer: (b) => { const ex = journal.find((x) => x.cliente_id === b.cliente_id && x.jour === b.jour); if (ex) { Object.assign(ex, b); return { remplace: true }; } return { regles: false, ...b }; },
  });
  if (u.pathname === "/rest/v1/revenus_divers") return tableCommu(req, res, u, revenusDivers, {
    visibles: coach ? revenusDivers : [],
    creer: (b) => ({ id: "5e000000-0000-4000-8000-" + String(revenusDivers.length + 10).padStart(12, "0"), created_at: new Date().toISOString(), note: null, cliente_id: null, moyen: null, ...b }),
  });
  if (u.pathname === "/rest/v1/paiements_clientes" || u.pathname === "/rest/v1/echeances_paiement") return routePaiements(req, res, u, uid, coach);
  if (u.pathname.includes("_communaute")) { const r = routeCommunaute(req, res, u, uid, coach); if (r !== null) return r; }
  if (u.pathname === "/rest/v1/rappels_envoyes") return tableLibre(req, res, u, rappelsEnvoyes, coach, uid);
  if (u.pathname === "/rest/v1/abonnements_coach") return tableCommu(req, res, u, abonnementsCoach, { visibles: coach ? abonnementsCoach : [], creer: (b) => ({ id: "ac0000" + Date.now(), profil_id: uid, ...b }) });
  if (u.pathname === "/rest/v1/reglages" && req.method === "PATCH") { corpsJson(req).then((b) => { Object.assign(reglages, b); res.writeHead(204); res.end(); }); return; }
  if (u.pathname === "/rest/v1/abonnements_push") return tableLibre(req, res, u, abonnementsPush, coach, uid);
  if (u.pathname === "/rest/v1/favoris") return table(req, res, u, uid, favoris);
  if (u.pathname === "/rest/v1/courses") return table(req, res, u, uid, courses);
  switch (u.pathname) {
    case "/rest/v1/profils": return send([profils[uid]]);
    case "/rest/v1/reglages": return send([reglages]);
    case "/rest/v1/consentements": return send([{ id: "c1" }]);
    case "/rest/v1/notes_coach": return send(coach ? notes : []);
    case "/rest/v1/plans": return send(filtrer(coach ? plans : plans.filter((p) => p.cliente_id === uid), u.searchParams));
    case "/rest/v1/categories_ressource": return send(categories);
    case "/rest/v1/aliments": { const l = filtrer(aliments, u.searchParams); const lim = Number(u.searchParams.get("limit") || 1000); res.setHeader("content-range", `0-${Math.max(l.length - 1, 0)}/${l.length}`); return send(l.slice(0, lim)); }
    case "/rest/v1/categories_aliment": return send(catsAliment);
    case "/rest/v1/tags": return send(tagsListe);
    case "/rest/v1/recettes": return send(filtrer(coach ? recettes : recettes.filter((r) => r.publiee), u.searchParams));
    case "/rest/v1/repas_cibles": return send(filtrer(coach ? repasCibles : repasCibles.filter((r) => r.cliente_id === uid), u.searchParams));
    case "/rest/v1/exclusions": return send(filtrer(coach ? exclusionsListe : exclusionsListe.filter((r) => r.cliente_id === uid), u.searchParams));
    case "/rest/v1/filtres_video": return send(filtresVideo);
    case "/rest/v1/videos": { const l = filtrer(coach ? videos : videos.filter((v) => v.publiee), u.searchParams); res.setHeader("content-range", `0-${Math.max(l.length - 1, 0)}/${l.length}`); return send(l); }
    case "/rest/v1/champs_mesure": return send(filtrer(champs, u.searchParams));
    case "/rest/v1/retours_bilan": return send(filtrer(coach ? retours : retours.filter((r) => bilans.find((b) => b.id === r.bilan_id)?.cliente_id === uid), u.searchParams));
    case "/rest/v1/clientes": {
      const visibles = coach ? clientes : clientes.filter((c) => c.id === uid);
      return send(filtrer(eqId ? visibles.filter((c) => c.id === eqId) : visibles, [...u.searchParams].filter(([k]) => k !== "id")));
    }
  }
  res.writeHead(404); res.end("{}");
}).listen(54321, "127.0.0.1", () => console.log("Supabase simulé prêt sur http://127.0.0.1:54321"));
