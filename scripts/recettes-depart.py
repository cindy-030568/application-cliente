"""
Génère data/recettes-depart.json : les 50 recettes de départ de Cindy, importables
depuis le dashboard coach (Recettes → « Importer les recettes de départ »).

Chaque ingrédient référence un aliment Ciqual (« ciqual:<code> ») ou un aliment perso
(« perso:<nom> »). Les quantités sont pour UNE portion, poids CRU (sauf mention).
Rôles : proteine / glucide / lipide (ajustés par le moteur), fruit (ajusté dans sa
fourchette), fixe (ne bouge pas).

Usage : python3 scripts/recettes-depart.py   (affiche les macros de chaque recette de base)
"""
import json
import math

ALIMENTS_PERSO = [
    {"nom": "Skyr nature 0 %", "p": 10.0, "g": 4.0, "l": 0.2, "k": 58, "categories": ["Produits laitiers"]},
    {"nom": "Protéine en poudre (whey isolat), nature", "p": 85.0, "g": 4.0, "l": 1.5, "k": 370,
     "categories": ["Produits laitiers"]},
]


def _arrondi(x, pas):
    return max(pas, round(x / pas) * pas)


def ing(ref, role, base, unite="g", pas=None, note=None, mini=None, maxi=None):
    if pas is None:
        pas = 1 if unite == "unite" else (5 if base >= 20 else 1)
    facteurs = {"proteine": (0.5, 2.0), "glucide": (0.4, 2.2), "lipide": (0.3, 2.5), "fruit": (0.5, 1.6)}
    if role == "fixe":
        lo = hi = base
    else:
        f_lo, f_hi = facteurs[role]
        lo = mini if mini is not None else (_arrondi(base * f_lo, pas) if unite == "g" else max(1, math.floor(base * f_lo)))
        hi = maxi if maxi is not None else (_arrondi(base * f_hi, pas) if unite == "g" else max(base, math.ceil(base * f_hi)))
        lo, hi = min(lo, base), max(hi, base)
    return {"a": ref, "role": role, "unite": unite, "base": base, "min": lo, "max": hi, "pas": pas, "note": note}


def P(ref, base, **k): return ing(ref, "proteine", base, **k)
def G(ref, base, **k): return ing(ref, "glucide", base, **k)
def L(ref, base, **k): return ing(ref, "lipide", base, **k)
def F(ref, base, **k): return ing(ref, "fruit", base, **k)
def X(ref, base, **k): return ing(ref, "fixe", base, **k)


# Aliments
POULET, DINDE, BOEUF5, SAUMON, SAUMON_FUME, CABILLAUD, THON, CREVETTE = (
    "ciqual:36017", "ciqual:36304", "ciqual:6250", "ciqual:26036", "ciqual:26037", "ciqual:26043", "ciqual:26039", "ciqual:10006")
OEUF, BLANC_OEUF, JAMBON, TOFU, TEMPEH = "ciqual:22000", "ciqual:22001", "ciqual:28913", "ciqual:20904", "ciqual:20917"
PST = "ciqual:20591"  # protéines de soja texturées, réhydratées
SKYR, WHEY = "perso:Skyr nature 0 %", "perso:Protéine en poudre (whey isolat), nature"
FROMAGE_BLANC, YAOURT_GREC, RICOTTA, MOZZA, FETA, PARMESAN, EMMENTAL, CHEVRE_FRAIS = (
    "ciqual:19644", "ciqual:19860", "ciqual:19585", "ciqual:19590", "ciqual:12066", "ciqual:12120", "ciqual:12118", "ciqual:12805")
LAIT, LAIT_AMANDE, CREME_LEGERE, LAIT_COCO, BEURRE = "ciqual:19041", "ciqual:18107", "ciqual:19436", "ciqual:18041", "ciqual:16400"
RIZ, RIZ_COMPLET, PATES, PATES_COMPLETES, QUINOA, SEMOULE, BOULGOUR, FLOCONS = (
    "ciqual:9100", "ciqual:9102", "ciqual:9810", "ciqual:9870", "ciqual:9340", "ciqual:9610", "ciqual:9690", "ciqual:9311")
PDT, PATATE_DOUCE, PAIN_COMPLET, PAIN_MIE_COMPLET, TORTILLA, GALETTE_RIZ, PAIN_PITA = (
    "ciqual:4008", "ciqual:4101", "ciqual:7110", "ciqual:7111", "ciqual:7815", "ciqual:7352", "ciqual:7180")
GALETTE_SARRASIN, GNOCCHI, VERMICELLE_RIZ = "ciqual:23801", "ciqual:26264", "ciqual:9901"
LENTILLE_CORAIL, LENTILLE_VERTE, POIS_CHICHE, HARICOT_ROUGE, MAIS = (
    "ciqual:20535", "ciqual:20585", "ciqual:20532", "ciqual:20524", "ciqual:20066")
HUILE_OLIVE, HUILE_COLZA, AVOCAT, AMANDE, NOIX, NOISETTE, CAJOU, CACAHUETE_BEURRE = (
    "ciqual:17270", "ciqual:17130", "ciqual:13004", "ciqual:15000", "ciqual:15005", "ciqual:15004", "ciqual:15054", "ciqual:15202")
CHOCOLAT_NOIR, CHIA, SESAME, OLIVE = "ciqual:31074", "ciqual:15047", "ciqual:15010", "ciqual:13186"
BANANE, POMME, FRAISE, FRUITS_ROUGES, MYRTILLE, MANGUE, DATTE, CITRON, CITRON_VERT = (
    "ciqual:13005", "ciqual:13039", "ciqual:13014", "ciqual:13997", "ciqual:13028", "ciqual:13025", "ciqual:13011",
    "ciqual:13009", "ciqual:2030")
COURGETTE, TOMATE, TOMATE_CERISE, TOMATE_PULPE, POIVRON, OIGNON, AIL, EPINARD, BROCOLI, CHAMPIGNON = (
    "ciqual:20020", "ciqual:20047", "ciqual:20172", "ciqual:20169", "ciqual:20087", "ciqual:20034", "ciqual:11000",
    "ciqual:20059", "ciqual:20057", "ciqual:20056")
CAROTTE, HARICOT_VERT, CONCOMBRE, LAITUE, ROQUETTE, AUBERGINE, BETTERAVE = (
    "ciqual:20009", "ciqual:20061", "ciqual:20019", "ciqual:20031", "ciqual:20217", "ciqual:20053", "ciqual:20003")
SAUCE_SOJA, MOUTARDE, VINAIGRE_BALSAMIQUE, MIEL, SIROP_ERABLE, CANNELLE, CURRY, CUMIN, PAPRIKA, GINGEMBRE = (
    "ciqual:11104", "ciqual:11013", "ciqual:11091", "ciqual:31008", "ciqual:31034", "ciqual:11025", "ciqual:11005",
    "ciqual:11042", "ciqual:11049", "ciqual:11006")
CACAO, LEVURE, PERSIL, BASILIC, CORIANDRE, MENTHE, THYM, HERBES, ORIGAN, BOUILLON_LEGUMES = (
    "ciqual:18100", "ciqual:11046", "ciqual:11014", "ciqual:11033", "ciqual:11094", "ciqual:11027", "ciqual:11070",
    "ciqual:11060", "ciqual:11035", "ciqual:25948")

R = []


def recette(titre, repas, temps, tags, ingredients, etapes, description=None, astuce=None):
    R.append({"titre": titre, "description": description, "repas": repas, "temps": temps, "tags": tags,
              "ingredients": ingredients, "etapes": etapes, "astuce": astuce})


# ===================== Petits-déjeuners (10) =====================
recette("Pancakes moelleux à la banane", ["petit_dejeuner", "collation"], 15, ["Sucré", "Végétarien"], [
    G(FLOCONS, 40, note="mixés en farine"), P(OEUF, 1, unite="unite"), P(WHEY, 20), F(BANANE, 60, pas=10),
    X(LAIT, 60), X(LEVURE, 3), X(CANNELLE, 1), L(HUILE_COLZA, 3, mini=0)],
    ["Mixe les flocons d’avoine en farine fine.", "Ajoute l’œuf, la protéine, la banane écrasée, le lait, la levure et la cannelle : mélange jusqu’à obtenir une pâte lisse.",
     "Huile légèrement une poêle chaude et verse de petites louches de pâte.", "Cuis 1 à 2 minutes par face, jusqu’à ce que des bulles se forment."],
    description="Des pancakes bien épais, à garnir de fruits frais.", astuce="La pâte se garde 24 h au frais : parfait pour le lendemain.")
recette("Overnight oats chocolat & fruits rouges", ["petit_dejeuner"], 5, ["Sucré", "Végétarien", "Sans cuisson", "Batch cooking"], [
    G(FLOCONS, 50), P(SKYR, 150), X(LAIT, 100), X(CACAO, 5), F(FRUITS_ROUGES, 100, pas=10), L(CHIA, 10), X(SIROP_ERABLE, 5)],
    ["Dans un bocal, mélange les flocons, le skyr, le lait, le cacao, les graines de chia et le sirop d’érable.", "Couvre et laisse une nuit au réfrigérateur.",
     "Le matin, ajoute les fruits rouges sur le dessus."],
    description="Préparé la veille, prêt au réveil : on n’a plus qu’à savourer.")
recette("Bowl skyr, myrtilles & amandes", ["petit_dejeuner", "collation"], 5, ["Sucré", "Végétarien", "Sans cuisson", "Rapide"], [
    P(SKYR, 170), G(FLOCONS, 30), L(AMANDE, 15), F(MYRTILLE, 80, pas=10), X(MIEL, 5), X(CANNELLE, 1)],
    ["Verse le skyr dans un bol.", "Ajoute les flocons d’avoine, les myrtilles et les amandes concassées.", "Termine par le miel et une pincée de cannelle."])
recette("Omelette épinards & feta, pain complet", ["petit_dejeuner", "dejeuner"], 10, ["Salé", "Végétarien", "Rapide"], [
    P(OEUF, 2, unite="unite"), P(BLANC_OEUF, 60), L(FETA, 20), X(EPINARD, 60), G(PAIN_COMPLET, 50, pas=10), L(HUILE_OLIVE, 3, mini=0)],
    ["Fais tomber les épinards 1 minute dans une poêle avec l’huile.", "Bats les œufs et les blancs, verse sur les épinards.",
     "Émiette la feta, laisse cuire à feu doux jusqu’à ce que l’omelette prenne.", "Sers avec le pain complet grillé."])
recette("Tartine avocat & œufs brouillés", ["petit_dejeuner", "collation"], 10, ["Salé", "Végétarien", "Rapide"], [
    G(PAIN_COMPLET, 60, pas=10), L(AVOCAT, 30, mini=0), P(OEUF, 1, unite="unite"), P(BLANC_OEUF, 60), X(TOMATE, 50), X(CITRON, 5)],
    ["Écrase l’avocat avec le jus de citron, sel et poivre.", "Brouille l’œuf et les blancs à feu doux, en remuant sans cesse.",
     "Tartine le pain grillé d’avocat, ajoute les rondelles de tomate et les œufs brouillés."])
recette("Porridge pomme-cannelle & noix", ["petit_dejeuner"], 10, ["Sucré", "Végétarien"], [
    G(FLOCONS, 45), X(LAIT, 150), P(WHEY, 20), F(POMME, 100, pas=10), L(NOIX, 10), X(CANNELLE, 2)],
    ["Fais chauffer les flocons et le lait 4 à 5 minutes en remuant.", "Hors du feu, incorpore la protéine et la cannelle.",
     "Ajoute la pomme en petits dés et les noix concassées."],
    astuce="Pour une version plus fondante, fais revenir la pomme 3 minutes à la poêle avec la cannelle.")
recette("Galette complète jambon, œuf & champignons", ["petit_dejeuner", "dejeuner", "diner"], 15, ["Salé"], [
    G(GALETTE_SARRASIN, 60, pas=10), P(JAMBON, 40), P(OEUF, 1, unite="unite"), L(EMMENTAL, 15), X(CHAMPIGNON, 60)],
    ["Fais revenir les champignons émincés 3 minutes dans une poêle.", "Pose la galette dans la poêle chaude, casse l’œuf au centre.",
     "Ajoute le jambon, les champignons et l’emmental autour.", "Replie les bords quand le blanc est pris."])
recette("Smoothie bowl mangue-banane", ["petit_dejeuner", "collation"], 5, ["Sucré", "Végétarien", "Sans cuisson", "Rapide"], [
    P(SKYR, 150), F(BANANE, 80, pas=10), F(MANGUE, 80, pas=10), G(FLOCONS, 25), L(CHIA, 8), X(LAIT_AMANDE, 80)],
    ["Mixe le skyr, la banane, la mangue et la boisson à l’amande jusqu’à obtenir une texture épaisse.", "Verse dans un bol.",
     "Parsème de flocons d’avoine et de graines de chia."])
recette("Tartines ricotta, fraises & miel", ["petit_dejeuner", "collation"], 5, ["Sucré", "Végétarien", "Rapide"], [
    G(PAIN_COMPLET, 60, pas=10), L(RICOTTA, 40), P(FROMAGE_BLANC, 60), F(FRAISE, 100, pas=10), X(MIEL, 5)],
    ["Mélange la ricotta et le fromage blanc.", "Tartine le pain grillé de ce mélange.", "Ajoute les fraises en lamelles et un filet de miel."])
recette("Muffins salés aux légumes", ["petit_dejeuner", "collation"], 30, ["Salé", "Végétarien", "Batch cooking"], [
    P(OEUF, 2, unite="unite"), P(BLANC_OEUF, 60), G(FLOCONS, 30, note="mixés"), X(POIVRON, 50), X(COURGETTE, 50), L(EMMENTAL, 15), X(LEVURE, 2)],
    ["Préchauffe le four à 180 °C.", "Coupe le poivron et la courgette en tout petits dés.", "Mélange les œufs, les blancs, les flocons mixés, la levure et l’emmental, puis ajoute les légumes.",
     "Répartis dans des moules à muffins et enfourne 20 minutes."],
    astuce="Ils se gardent 3 jours au frais : réchauffe-les 30 secondes au micro-ondes.")

# ===================== Déjeuners (15) =====================
recette("Bowl poulet teriyaki & riz", ["dejeuner", "diner"], 20, ["Salé"], [
    P(POULET, 120), G(RIZ, 60), X(BROCOLI, 100), X(CAROTTE, 50), X(SAUCE_SOJA, 10), X(MIEL, 5), L(HUILE_COLZA, 5, mini=0), L(SESAME, 5, mini=0)],
    ["Fais cuire le riz.", "Fais dorer le poulet en dés dans l’huile.", "Ajoute la sauce soja et le miel, laisse caraméliser 2 minutes.",
     "Cuis le brocoli et la carotte à la vapeur.", "Dresse le bol et parsème de sésame."],
    description="Le grand classique sucré-salé, version maison.")
recette("Wrap poulet croquant", ["dejeuner"], 10, ["Salé", "Rapide"], [
    G(TORTILLA, 1, unite="unite"), P(POULET, 100, note="cuit à la poêle"), X(LAITUE, 30), X(TOMATE, 50), X(FROMAGE_BLANC, 30), X(MOUTARDE, 5), L(AVOCAT, 30)],
    ["Fais cuire le poulet en lanières à la poêle.", "Mélange le fromage blanc et la moutarde pour la sauce.",
     "Garnis la tortilla : sauce, salade, tomate, avocat et poulet.", "Roule bien serré et coupe en deux."])
recette("Salade de quinoa, pois chiches, œufs & feta", ["dejeuner"], 20, ["Salé", "Végétarien", "Batch cooking"], [
    G(QUINOA, 40), G(POIS_CHICHE, 80), P(OEUF, 2, unite="unite", note="durs"), L(FETA, 20), X(CONCOMBRE, 80), X(TOMATE, 80), L(HUILE_OLIVE, 8, mini=0), X(CITRON, 10), X(MENTHE, 2)],
    ["Fais cuire le quinoa et laisse-le refroidir. Fais cuire les œufs 9 minutes.", "Coupe le concombre, les tomates et les œufs.", "Mélange avec les pois chiches rincés et la feta émiettée.",
     "Assaisonne avec l’huile, le citron et la menthe ciselée."])
recette("Pâtes au thon & à la tomate", ["dejeuner", "diner"], 15, ["Salé", "Rapide"], [
    G(PATES, 70), P(THON, 80), X(TOMATE_PULPE, 150), X(OIGNON, 30), L(HUILE_OLIVE, 5, mini=0), X(BASILIC, 2), X(PARMESAN, 5)],
    ["Fais cuire les pâtes.", "Fais revenir l’oignon émincé dans l’huile, ajoute la pulpe de tomate et laisse mijoter 8 minutes.",
     "Ajoute le thon émietté et le basilic.", "Mélange aux pâtes et parsème de parmesan."])
recette("Buddha bowl patate douce & tofu", ["dejeuner", "diner"], 30, ["Salé", "Végétarien"], [
    P(TOFU, 100), P(SKYR, 60, note="sauce citronnée"), G(PATATE_DOUCE, 150), X(EPINARD, 50), L(AVOCAT, 30, mini=0), X(SAUCE_SOJA, 10), X(CITRON, 5), L(SESAME, 5, mini=0)],
    ["Préchauffe le four à 200 °C. Coupe la patate douce en cubes et rôtis-la 25 minutes.", "Coupe le tofu en dés et fais-le dorer à la poêle avec la sauce soja.",
     "Mélange le skyr avec le jus de citron, sel et poivre : c’est la sauce.", "Dresse le bol : jeunes pousses d’épinards, patate douce, tofu, avocat et sauce. Parsème de sésame."])
recette("Poké bowl saumon & mangue", ["dejeuner"], 20, ["Salé"], [
    P(SAUMON, 100, note="très frais"), G(RIZ, 60), L(AVOCAT, 30, mini=0), X(CONCOMBRE, 60), F(MANGUE, 50, pas=10), X(SAUCE_SOJA, 10), X(SESAME, 3)],
    ["Fais cuire le riz et laisse-le tiédir.", "Coupe le saumon, l’avocat, le concombre et la mangue en dés.",
     "Dispose tous les ingrédients sur le riz.", "Arrose de sauce soja et parsème de sésame."])
recette("Curry de lentilles corail & raïta", ["dejeuner", "diner"], 30, ["Salé", "Végétarien", "Batch cooking"], [
    G(LENTILLE_CORAIL, 60), G(RIZ, 40), L(LAIT_COCO, 40), X(TOMATE_PULPE, 100), X(OIGNON, 40), X(CURRY, 3), X(GINGEMBRE, 2), X(EPINARD, 50), P(SKYR, 100, note="en raïta")],
    ["Fais revenir l’oignon avec le curry et le gingembre.", "Ajoute les lentilles rincées, la pulpe de tomate, le lait de coco et 200 ml d’eau. Laisse mijoter 15 minutes.",
     "Ajoute les épinards en fin de cuisson.", "Sers avec le riz et le skyr mélangé à un peu de menthe (raïta)."],
    astuce="Le curry est encore meilleur le lendemain : double les quantités.")
recette("Croque protéiné jambon-fromage", ["dejeuner", "diner"], 10, ["Salé", "Rapide"], [
    G(PAIN_MIE_COMPLET, 2, unite="unite"), P(JAMBON, 60), L(EMMENTAL, 20), X(FROMAGE_BLANC, 30), X(LAITUE, 50)],
    ["Tartine les tranches de pain de fromage blanc.", "Garnis de jambon et d’emmental, referme.", "Fais dorer 4 minutes au four ou à la poêle.", "Sers avec la salade."])
recette("Chili con carne", ["dejeuner", "diner"], 35, ["Salé", "Batch cooking"], [
    P(BOEUF5, 100), G(HARICOT_ROUGE, 80), G(RIZ, 40), X(TOMATE_PULPE, 150), X(POIVRON, 60), X(OIGNON, 40), X(CUMIN, 2), X(PAPRIKA, 2), L(HUILE_OLIVE, 3, mini=0)],
    ["Fais revenir l’oignon et le poivron dans l’huile.", "Ajoute la viande hachée et fais-la dorer.", "Ajoute les épices, la pulpe de tomate et les haricots rouges : laisse mijoter 20 minutes.",
     "Sers avec le riz."])
recette("Salade niçoise revisitée", ["dejeuner"], 20, ["Salé"], [
    P(THON, 80), P(OEUF, 1, unite="unite"), G(PDT, 150), X(HARICOT_VERT, 80), X(TOMATE, 80), L(OLIVE, 15), L(HUILE_OLIVE, 5, mini=0), X(VINAIGRE_BALSAMIQUE, 5)],
    ["Fais cuire les pommes de terre et les haricots verts à l’eau, l’œuf 9 minutes.", "Laisse refroidir puis coupe en morceaux.",
     "Assemble avec les tomates, le thon et les olives.", "Assaisonne avec l’huile et le vinaigre."])
recette("Bowl mexicain poulet, maïs & haricots", ["dejeuner", "diner"], 20, ["Salé"], [
    P(POULET, 100), G(RIZ, 50), G(HARICOT_ROUGE, 50), X(MAIS, 40), X(POIVRON, 50), L(AVOCAT, 40), X(CITRON_VERT, 10), X(PAPRIKA, 2)],
    ["Fais cuire le riz.", "Fais dorer le poulet en dés avec le paprika.", "Réchauffe les haricots et le maïs.",
     "Dresse le bol avec le poivron cru, l’avocat et un filet de citron vert."])
recette("Taboulé libanais au poulet", ["dejeuner"], 20, ["Salé", "Batch cooking"], [
    G(BOULGOUR, 50), P(POULET, 100), X(TOMATE, 80), X(CONCOMBRE, 60), X(PERSIL, 15), X(MENTHE, 3), X(CITRON, 15), L(HUILE_OLIVE, 8, mini=0)],
    ["Fais cuire le boulgour et laisse-le refroidir.", "Fais griller le poulet et coupe-le en lamelles.",
     "Hache finement le persil et la menthe, coupe tomates et concombre en petits dés.", "Mélange le tout avec le citron et l’huile."])
recette("Gnocchis poêlés au poulet, tomates & mozzarella", ["dejeuner", "diner"], 20, ["Salé", "Rapide"], [
    G(GNOCCHI, 150), P(POULET, 90), L(MOZZA, 30), X(EPINARD, 80), X(TOMATE_CERISE, 80), L(HUILE_OLIVE, 4, mini=0), X(BASILIC, 2)],
    ["Fais dorer le poulet en dés, réserve. Fais dorer les gnocchis 5 minutes dans l’huile.", "Ajoute les tomates cerises coupées en deux, les épinards et le poulet, laisse fondre 2 minutes.",
     "Ajoute la mozzarella en morceaux et le basilic juste avant de servir."])
recette("Shakshuka", ["dejeuner", "diner"], 25, ["Salé", "Végétarien"], [
    P(OEUF, 2, unite="unite"), P(BLANC_OEUF, 60), G(PAIN_COMPLET, 50, pas=10), X(TOMATE_PULPE, 200), X(POIVRON, 80), X(OIGNON, 40), X(CUMIN, 1), X(PAPRIKA, 1), L(HUILE_OLIVE, 5, mini=0), L(FETA, 15)],
    ["Fais revenir l’oignon et le poivron dans l’huile.", "Ajoute la pulpe de tomate et les épices, laisse mijoter 10 minutes.",
     "Verse les blancs d’œufs en filet, puis creuse deux puits et casse les œufs entiers dedans. Couvre et cuis 6 à 8 minutes.", "Émiette la feta et sers avec le pain."])
recette("Salade de pâtes poulet, mozzarella & basilic", ["dejeuner"], 15, ["Salé", "Batch cooking"], [
    G(PATES, 60), P(POULET, 90), L(MOZZA, 30), X(TOMATE_CERISE, 100), X(ROQUETTE, 30), L(HUILE_OLIVE, 5, mini=0), X(BASILIC, 2), X(VINAIGRE_BALSAMIQUE, 5)],
    ["Fais cuire les pâtes et laisse-les refroidir.", "Fais griller le poulet, coupe-le en dés.", "Mélange avec les tomates, la mozzarella, la roquette et le basilic.",
     "Assaisonne avec l’huile et le vinaigre balsamique."])

# ===================== Dîners (15) =====================
recette("Saumon au four, patate douce & haricots verts", ["diner", "dejeuner"], 30, ["Salé"], [
    P(SAUMON, 110), G(PATATE_DOUCE, 200), X(HARICOT_VERT, 120), L(BEURRE, 5, mini=0), X(CITRON, 10), X(THYM, 1)],
    ["Préchauffe le four à 200 °C.", "Rôtis la patate douce en quartiers 25 minutes.", "Ajoute le saumon les 12 dernières minutes, avec citron et thym.",
     "Cuis les haricots verts à la vapeur et ajoute une noisette de beurre."])
recette("Cabillaud en papillote, riz & courgettes", ["diner", "dejeuner"], 25, ["Salé"], [
    P(CABILLAUD, 140), G(RIZ, 50), X(COURGETTE, 150), X(TOMATE, 60), X(CITRON, 15), L(HUILE_OLIVE, 6, mini=0), X(THYM, 1)],
    ["Préchauffe le four à 200 °C. Fais cuire le riz.", "Sur une feuille de papier cuisson, dépose courgette en rondelles, tomate, cabillaud, citron, thym et huile.",
     "Ferme la papillote et enfourne 15 minutes."])
recette("Boulettes de bœuf à la tomate & semoule", ["diner", "dejeuner"], 30, ["Salé", "Batch cooking"], [
    P(BOEUF5, 110), G(SEMOULE, 60), X(TOMATE_PULPE, 150), X(OIGNON, 30), X(CUMIN, 1), X(PERSIL, 5), L(HUILE_OLIVE, 4, mini=0)],
    ["Mélange la viande hachée avec le persil, le cumin, sel et poivre, puis forme des boulettes.", "Fais-les dorer dans l’huile.",
     "Ajoute l’oignon et la pulpe de tomate, laisse mijoter 15 minutes.", "Sers avec la semoule."])
recette("Escalope de dinde, crème de champignons & pâtes", ["diner", "dejeuner"], 20, ["Salé", "Rapide"], [
    P(DINDE, 120), G(PATES, 60), X(CHAMPIGNON, 120), L(CREME_LEGERE, 30), X(OIGNON, 30), X(PERSIL, 3)],
    ["Fais cuire les pâtes.", "Fais dorer l’escalope, réserve.", "Dans la même poêle, fais revenir l’oignon et les champignons, puis ajoute la crème.",
     "Remets la dinde 2 minutes dans la sauce, parsème de persil."])
recette("Curry de poulet au lait de coco", ["diner", "dejeuner"], 25, ["Salé", "Batch cooking"], [
    P(POULET, 120), G(RIZ, 50), L(LAIT_COCO, 50), X(POIVRON, 80), X(OIGNON, 40), X(CURRY, 3), X(EPINARD, 50)],
    ["Fais cuire le riz.", "Fais revenir l’oignon et le poivron, ajoute le poulet en dés et le curry.", "Verse le lait de coco, laisse mijoter 10 minutes.",
     "Ajoute les épinards en fin de cuisson."])
recette("Frittata courgette, chèvre & menthe", ["diner", "dejeuner"], 25, ["Salé", "Végétarien"], [
    P(OEUF, 2, unite="unite"), P(BLANC_OEUF, 90), G(PDT, 150), X(COURGETTE, 120), L(CHEVRE_FRAIS, 30), X(MENTHE, 2), L(HUILE_OLIVE, 3, mini=0)],
    ["Fais cuire les pommes de terre en rondelles 10 minutes à l’eau.", "Fais revenir la courgette dans l’huile, ajoute les pommes de terre.",
     "Verse les œufs et les blancs battus ensemble, parsème de chèvre et de menthe.", "Cuis à couvert 8 minutes à feu doux."])
recette("Pizza tortilla jambon & champignons", ["diner", "dejeuner"], 15, ["Salé", "Rapide"], [
    G(TORTILLA, 1, unite="unite"), P(JAMBON, 50), L(MOZZA, 30), X(TOMATE_PULPE, 60), X(CHAMPIGNON, 50), X(POIVRON, 40), L(OLIVE, 10, mini=0), X(ORIGAN, 1)],
    ["Préchauffe le four à 220 °C.", "Étale la pulpe de tomate sur la tortilla.", "Ajoute le jambon, les légumes émincés, la mozzarella, les olives et l’origan.",
     "Enfourne 8 à 10 minutes."])
recette("Soupe thaï aux crevettes & nouilles de riz", ["diner"], 20, ["Salé"], [
    P(CREVETTE, 120), G(VERMICELLE_RIZ, 150, note="poids cuit"), L(LAIT_COCO, 40), X(CHAMPIGNON, 60), X(CAROTTE, 40), X(GINGEMBRE, 2),
    X(CITRON_VERT, 10), X(CORIANDRE, 3), X(BOUILLON_LEGUMES, 250)],
    ["Porte le bouillon à frémissement avec le gingembre et le lait de coco.", "Ajoute la carotte en julienne et les champignons, laisse cuire 5 minutes.",
     "Ajoute les crevettes et les nouilles, réchauffe 2 minutes.", "Termine avec le citron vert et la coriandre."])
recette("Wok de tofu, brocoli & noix de cajou", ["diner", "dejeuner"], 20, ["Salé", "Végétarien"], [
    P(TOFU, 130), G(RIZ, 50), X(BROCOLI, 120), X(POIVRON, 60), X(SAUCE_SOJA, 15), X(GINGEMBRE, 2), L(CAJOU, 15), L(HUILE_COLZA, 3, mini=0)],
    ["Fais cuire le riz.", "Fais dorer le tofu en dés dans l’huile, réserve.", "Saute le brocoli et le poivron 5 minutes à feu vif.",
     "Remets le tofu, ajoute la sauce soja, le gingembre et les noix de cajou."])
recette("Hachis parmentier de patate douce", ["diner", "dejeuner"], 45, ["Salé", "Batch cooking"], [
    P(BOEUF5, 110), G(PATATE_DOUCE, 220), X(CAROTTE, 60), X(OIGNON, 40), X(LAIT, 40), L(EMMENTAL, 10), X(TOMATE_PULPE, 60)],
    ["Fais cuire la patate douce à l’eau puis écrase-la avec le lait.", "Fais revenir l’oignon, la carotte râpée et la viande, ajoute la pulpe de tomate.",
     "Dans un plat, mets la viande puis la purée, parsème d’emmental.", "Gratine 15 minutes à 200 °C."])
recette("Chili sin carne au tempeh", ["diner", "dejeuner"], 30, ["Salé", "Végétarien", "Batch cooking"], [
    P(TEMPEH, 90), G(HARICOT_ROUGE, 90), G(RIZ, 40), X(TOMATE_PULPE, 150), X(POIVRON, 60), X(OIGNON, 40), X(CUMIN, 2), X(PAPRIKA, 2), L(AVOCAT, 30)],
    ["Émiette le tempeh et fais-le dorer avec l’oignon et le poivron.", "Ajoute les épices, la pulpe de tomate et les haricots : laisse mijoter 15 minutes.",
     "Sers avec le riz et l’avocat en dés."])
recette("Omelette roulée saumon fumé & épinards", ["diner"], 20, ["Salé"], [
    P(OEUF, 2, unite="unite"), P(SAUMON_FUME, 40), G(PDT, 180), X(EPINARD, 80), L(CREME_LEGERE, 15)],
    ["Fais cuire les pommes de terre à la vapeur.", "Fais une omelette fine, garnis-la d’épinards tombés et de saumon fumé.",
     "Roule-la et coupe en tronçons.", "Sers avec les pommes de terre et la crème."])
recette("Poulet, ratatouille & quinoa", ["diner", "dejeuner"], 40, ["Salé", "Batch cooking"], [
    P(POULET, 120), G(QUINOA, 50), X(AUBERGINE, 80), X(COURGETTE, 80), X(POIVRON, 60), X(TOMATE, 80), X(OIGNON, 30), L(HUILE_OLIVE, 8, mini=0), X(HERBES, 1)],
    ["Coupe tous les légumes en dés et fais-les mijoter 25 minutes avec l’huile et les herbes.", "Fais cuire le quinoa.",
     "Fais griller le poulet.", "Sers le poulet sur la ratatouille et le quinoa."])
recette("Pâtes complètes à la bolognaise végétale", ["diner", "dejeuner"], 30, ["Salé", "Végétarien", "Batch cooking"], [
    P(PST, 80, note="réhydratées"), G(LENTILLE_CORAIL, 25), G(PATES_COMPLETES, 50), X(TOMATE_PULPE, 200), X(CAROTTE, 50), X(OIGNON, 40), L(PARMESAN, 10), L(HUILE_OLIVE, 4, mini=0)],
    ["Réhydrate les protéines de soja 10 minutes dans de l’eau chaude, puis égoutte-les.", "Fais revenir l’oignon et la carotte râpée dans l’huile, ajoute les protéines de soja.",
     "Ajoute les lentilles, la pulpe de tomate et 150 ml d’eau : laisse mijoter 15 minutes.",
     "Fais cuire les pâtes.", "Sers avec le parmesan."])
recette("Salade tiède de lentilles, betterave & chèvre", ["diner", "dejeuner"], 25, ["Salé", "Végétarien"], [
    G(LENTILLE_VERTE, 50), P(OEUF, 2, unite="unite"), L(CHEVRE_FRAIS, 30), X(BETTERAVE, 100), X(ROQUETTE, 30), L(NOIX, 10), X(VINAIGRE_BALSAMIQUE, 5), L(HUILE_OLIVE, 4, mini=0)],
    ["Fais cuire les lentilles 20 minutes, les œufs 9 minutes.", "Coupe la betterave en dés.",
     "Mélange les lentilles tièdes avec la roquette, la betterave, les œufs et le chèvre.", "Ajoute les noix, l’huile et le vinaigre."])

# ===================== Goûters & collations (10) =====================
recette("Mug cake chocolat", ["collation"], 5, ["Sucré", "Végétarien", "Rapide"], [
    P(WHEY, 20), G(FLOCONS, 25, note="mixés"), P(BLANC_OEUF, 30), X(CACAO, 5), X(LAIT, 30), X(LEVURE, 2), L(CHOCOLAT_NOIR, 10)],
    ["Mélange tous les ingrédients dans un grand mug, sauf le chocolat.", "Enfonce les carrés de chocolat au centre.", "Cuis 70 à 90 secondes au micro-ondes."],
    astuce="Le cœur doit rester légèrement fondant : arrête la cuisson dès que le dessus est pris.")
recette("Energy balls dattes & cacao", ["collation"], 15, ["Sucré", "Végétarien", "Sans cuisson", "Batch cooking"], [
    F(DATTE, 30), G(FLOCONS, 15), L(AMANDE, 15), X(CACAO, 4), P(WHEY, 10)],
    ["Mixe les dattes dénoyautées avec les amandes.", "Ajoute les flocons, le cacao et la protéine, mixe encore.", "Forme 3 ou 4 boules et garde-les au frais."],
    astuce="Prépare-en pour la semaine : elles se gardent 5 jours au réfrigérateur.")
recette("Skyr, fruits rouges & amandes", ["collation", "petit_dejeuner"], 3, ["Sucré", "Végétarien", "Sans cuisson", "Rapide"], [
    P(SKYR, 150), F(FRUITS_ROUGES, 100, pas=10), G(FLOCONS, 20), L(AMANDE, 10), X(MIEL, 5)],
    ["Verse le skyr dans un bol.", "Ajoute les fruits rouges, les flocons d’avoine et les amandes effilées.", "Termine par un filet de miel."])
recette("Fromage blanc, banane & beurre de cacahuète", ["collation"], 3, ["Sucré", "Végétarien", "Sans cuisson", "Rapide"], [
    P(FROMAGE_BLANC, 150), F(BANANE, 80, pas=10), L(CACAHUETE_BEURRE, 10), X(CANNELLE, 1)],
    ["Verse le fromage blanc dans un bol.", "Ajoute la banane en rondelles.", "Termine par le beurre de cacahuète et la cannelle."])
recette("Galettes de riz, saumon fumé & chèvre frais", ["collation"], 5, ["Salé", "Rapide", "Sans cuisson"], [
    G(GALETTE_RIZ, 2, unite="unite", maxi=5), P(SAUMON_FUME, 40), L(CHEVRE_FRAIS, 15), X(CONCOMBRE, 40), X(CITRON, 5)],
    ["Tartine les galettes de chèvre frais.", "Ajoute le saumon fumé et les rondelles de concombre.", "Un trait de citron, du poivre, c’est prêt."])
recette("Smoothie banane-cacao protéiné", ["collation", "petit_dejeuner"], 5, ["Sucré", "Végétarien", "Sans cuisson", "Rapide"], [
    X(LAIT, 200), P(WHEY, 20), F(BANANE, 100, pas=10), G(FLOCONS, 15), L(CACAHUETE_BEURRE, 8), X(CACAO, 3)],
    ["Mets tous les ingrédients dans le blender.", "Mixe 1 minute jusqu’à ce que ce soit bien lisse.", "Ajoute quelques glaçons si tu l’aimes bien frais."])
recette("Pomme au four, skyr & noix", ["collation"], 25, ["Sucré", "Végétarien"], [
    F(POMME, 150, pas=10), P(SKYR, 120), L(NOIX, 10), X(CANNELLE, 1), X(SIROP_ERABLE, 5)],
    ["Préchauffe le four à 180 °C.", "Coupe la pomme en quartiers, saupoudre de cannelle et enfourne 20 minutes.",
     "Sers chaude sur le skyr, avec les noix et le sirop d’érable."])
recette("Cookies avoine, banane & chocolat", ["collation"], 20, ["Sucré", "Végétarien", "Batch cooking"], [
    G(FLOCONS, 30), P(WHEY, 15), F(BANANE, 40, pas=10), L(CHOCOLAT_NOIR, 8), L(CACAHUETE_BEURRE, 5), X(LEVURE, 1)],
    ["Préchauffe le four à 180 °C.", "Écrase la banane et mélange-la avec les flocons, la protéine, la levure et le beurre de cacahuète.",
     "Ajoute le chocolat en pépites.", "Forme 3 cookies et enfourne 12 minutes."])
recette("Houmous maison, pain pita & œuf dur", ["collation"], 15, ["Salé", "Végétarien"], [
    P(OEUF, 1, unite="unite"), G(POIS_CHICHE, 80), G(PAIN_PITA, 25), L(SESAME, 10), L(HUILE_OLIVE, 5, mini=0), X(CITRON, 10), X(AIL, 3), X(CAROTTE, 80), X(CONCOMBRE, 80)],
    ["Mixe les pois chiches, le sésame, l’huile, le citron et l’ail avec 2 à 3 cuillères d’eau.", "Coupe la carotte et le concombre en bâtonnets.",
     "Sers avec le pain pita grillé et l’œuf dur (9 minutes de cuisson)."])
recette("Chia pudding coco-mangue", ["collation", "petit_dejeuner"], 5, ["Sucré", "Végétarien", "Sans cuisson", "Batch cooking"], [
    L(CHIA, 15), X(LAIT_AMANDE, 150), P(SKYR, 100), F(MANGUE, 80, pas=10), G(FLOCONS, 10), X(SIROP_ERABLE, 5)],
    ["Mélange les graines de chia avec la boisson à l’amande et le sirop d’érable.", "Laisse prendre au moins 2 heures au frais (ou une nuit).",
     "Ajoute le skyr, les flocons et la mangue en dés au moment de servir."])


def macros(recettes):
    ciqual = {a["c"]: a for a in json.load(open("data/ciqual.json", encoding="utf-8"))["aliments"]}
    perso = {a["nom"]: a for a in ALIMENTS_PERSO}
    unites = {"22000": 50, "13005": 120, "13039": 150, "13021": 75, "7111": 25, "7200": 25, "7110": 40, "7815": 40, "7352": 9, "31074": 5}
    erreurs = []
    for r in recettes:
        tot = [0.0, 0.0, 0.0, 0.0]
        for i in r["ingredients"]:
            src, cle = i["a"].split(":", 1)
            if src == "ciqual":
                a = ciqual.get(cle)
                if not a:
                    erreurs.append(f"{r['titre']} : code Ciqual inconnu {cle}")
                    continue
                if a["i"]:
                    erreurs.append(f"{r['titre']} : aliment incomplet {a['n']}")
                vals = (a["p"], a["gl"], a["l"], a["k"])
                poids = i["base"] * unites[cle] if i["unite"] == "unite" else i["base"]
                if i["unite"] == "unite" and cle not in unites:
                    erreurs.append(f"{r['titre']} : unité sans poids pour {a['n']}")
            else:
                a = perso[cle]
                vals = (a["p"], a["g"], a["l"], a["k"])
                poids = i["base"]
            for j in range(4):
                tot[j] += vals[j] * poids / 100
        r["_macros"] = [round(x) for x in tot]
    return erreurs


if __name__ == "__main__":
    erreurs = macros(R)
    noms = {"petit_dejeuner": "PDJ", "dejeuner": "DEJ", "diner": "DIN", "collation": "COL"}
    for r in R:
        p, g, l, k = r["_macros"]
        print(f"{noms[r['repas'][0]]:4} {k:4} kcal  P{p:3} G{g:3} L{l:3}  {r['titre']}")
    print(len(R), "recettes ;", sum("Végétarien" in r["tags"] for r in R), "végétariennes")
    print({n: sum(r["repas"][0] == c for r in R) for c, n in noms.items()})
    for e in erreurs:
        print("ERREUR :", e)
    titres = [r["titre"] for r in R]
    assert len(set(titres)) == len(titres), "titres en double"
    # Recettes renommées depuis une version précédente : la mise à jour les retrouve sous leur ancien titre.
    ANCIENS_TITRES = {
        "Gnocchis poêlés au poulet, tomates & mozzarella": ["Gnocchis poêlés, tomates & mozzarella"],
        "Houmous maison, pain pita & œuf dur": ["Houmous maison & pain pita"],
        "Pizza tortilla jambon & champignons": ["Pizza tortilla express aux légumes"],
        "Pâtes complètes à la bolognaise végétale": ["Pâtes complètes à la bolognaise de lentilles"],
        "Salade de quinoa, pois chiches, œufs & feta": ["Salade de quinoa, pois chiches & feta"],
        "Tartine avocat & œufs brouillés": ["Tartine avocat & œufs"],
    }
    assert set(ANCIENS_TITRES) <= set(titres), "ancien titre pour une recette inconnue"
    # Photos fournies avec l'app : public/recettes-depart/<titre-simplifie>.webp
    import os, unicodedata, re as _re
    def slug(t):
        t = unicodedata.normalize("NFKD", t.replace("œ", "oe")).encode("ascii", "ignore").decode().lower()
        return _re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    def photo(t):
        f = slug(t) + ".webp"
        return f if os.path.exists(os.path.join("public", "recettes-depart", f)) else None
    sortie = [{**{k: v for k, v in r.items() if k != "_macros"}, "anciens_titres": ANCIENS_TITRES.get(r["titre"], []), "photo": photo(r["titre"])} for r in R]
    print(sum(1 for r in sortie if r["photo"]), "photos")
    with open("data/recettes-depart.json", "w", encoding="utf-8") as f:
        json.dump({"aliments_perso": ALIMENTS_PERSO, "recettes": sortie}, f, ensure_ascii=False, indent=1)
    if erreurs:
        raise SystemExit(1)
