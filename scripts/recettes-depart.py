"""
Génère data/recettes-depart.json : les 100 recettes de départ de Cindy (2 lots de 50), importables
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


# ===================== 50 nouvelles recettes (lot 2) =====================
POIREAU, CHOU_FLEUR, BUTTERNUT, PETITS_POIS, HARICOT_BLANC, MAQUEREAU, PORC_FILET = (
    "ciqual:20039", "ciqual:20016", "ciqual:20138", "ciqual:20036", "ciqual:20511", "ciqual:26123", "ciqual:28201")
KIWI, POIRE, ORANGE, FRAMBOISE, FIGUE_SECHE, PRUNEAU, COMPOTE, GRENADE = (
    "ciqual:13021", "ciqual:13188", "ciqual:13034", "ciqual:13015", "ciqual:13013", "ciqual:13042", "ciqual:13151", "ciqual:13018")
EPEAUTRE, CHOU_ROUGE, ENDIVE, FENOUIL, PANAIS, MACHE, RADIS = (
    "ciqual:9001", "ciqual:20014", "ciqual:20026", "ciqual:20028", "ciqual:20181", "ciqual:20099", "ciqual:20045")
TRUITE, COLIN, CREVETTE_CRUE, GRUYERE, BRESAOLA, TAHIN, PESTO, PISTACHE, LIN = (
    "ciqual:27009", "ciqual:26129", "ciqual:10021", "ciqual:12114", "ciqual:28503", "ciqual:15203", "ciqual:11179",
    "ciqual:15044", "ciqual:15034")
TOMATE_SECHEE, OIGNON_ROUGE, GINGEMBRE_FRAIS, CIBOULETTE, ANETH, CURCUMA, MUSCADE, ROMARIN = (
    "ciqual:20189", "ciqual:20238", "ciqual:11074", "ciqual:11003", "ciqual:11093", "ciqual:11089", "ciqual:11048", "ciqual:11068")
HUILE_SESAME, POIS_GOURMAND, POUSSES_SOJA, PAK_CHOI, FECULE, BOUILLON_VOLAILLE, PAIN_SEIGLE, CORNICHON = (
    "ciqual:17400", "ciqual:20173", "ciqual:20183", "ciqual:20167", "ciqual:9510", "ciqual:25947", "ciqual:7125", "ciqual:11004")
NOIX_PECAN = "ciqual:15026"

# ----- Petits-déjeuners (10) -----
recette("Crêpes à l’avoine & compote de pomme", ["petit_dejeuner"], 15, ["Sucré", "Végétarien"], [
    G(FLOCONS, 40, note="mixés en farine"), P(OEUF, 1, unite="unite"), P(WHEY, 15), X(LAIT, 120), F(COMPOTE, 80, pas=10),
    X(CANNELLE, 1), L(HUILE_COLZA, 3, mini=0)],
    ["Mixe les flocons en farine fine, puis ajoute l’œuf, la protéine et le lait : la pâte doit être fluide.", "Laisse reposer 5 minutes.",
     "Huile légèrement une poêle chaude, verse une petite louche et étale.", "Cuis 1 minute par face et garnis de compote saupoudrée de cannelle."],
    description="Des crêpes fines et rassasiantes, sans farine blanche.")
recette("Granola maison, skyr & framboises", ["petit_dejeuner", "collation"], 20, ["Sucré", "Végétarien", "Batch cooking"], [
    G(FLOCONS, 35), L(AMANDE, 8), L(NOIX_PECAN, 5, mini=0), X(MIEL, 5), X(CANNELLE, 1), P(SKYR, 170), F(FRAMBOISE, 80, pas=10)],
    ["Mélange les flocons, les amandes et les noix de pécan concassées avec le miel et la cannelle.", "Étale sur une plaque et fais dorer 12 à 15 minutes à 170 °C en remuant à mi-cuisson.",
     "Laisse refroidir : le granola devient croustillant.", "Sers sur le skyr avec les framboises."],
    astuce="Prépare 5 portions d’un coup : il se garde 2 semaines dans un bocal fermé.")
recette("Tartine ricotta, poire & noix", ["petit_dejeuner", "collation"], 5, ["Sucré", "Végétarien", "Rapide", "Sans cuisson"], [
    G(PAIN_COMPLET, 50, pas=10), X(RICOTTA, 30), P(SKYR, 100), F(POIRE, 80, pas=10), L(NOIX, 8, mini=0), X(MIEL, 5), X(CANNELLE, 1)],
    ["Fais griller le pain.", "Mélange la ricotta et le skyr : tartine généreusement, ajoute la poire en fines lamelles.", "Parsème de noix concassées, d’un filet de miel et d’une pincée de cannelle."])
recette("Œufs cocotte jambon-épinards & mouillettes de seigle", ["petit_dejeuner"], 15, ["Salé"], [
    X(OEUF, 2, unite="unite"), P(JAMBON, 30), X(EPINARD, 60), L(CREME_LEGERE, 15, mini=0), X(MUSCADE, 0.5), G(PAIN_SEIGLE, 50, pas=10)],
    ["Préchauffe le four à 180 °C. Fais tomber les épinards 1 minute à la poêle.", "Répartis-les dans 2 ramequins avec le jambon en dés, la crème et une pointe de muscade.",
     "Casse un œuf dans chaque ramequin, sale, poivre.", "Enfourne 10 à 12 minutes : le blanc doit être pris, le jaune coulant. Sers avec le pain grillé en mouillettes."])
recette("Porridge chocolat-banane & cacahuète", ["petit_dejeuner"], 10, ["Sucré", "Végétarien"], [
    G(FLOCONS, 45), X(LAIT, 150), P(WHEY, 20), X(CACAO, 5), F(BANANE, 60, pas=10), L(CACAHUETE_BEURRE, 8, mini=0)],
    ["Fais chauffer les flocons et le lait 4 à 5 minutes en remuant.", "Hors du feu, incorpore la protéine et le cacao.",
     "Ajoute la banane en rondelles et le beurre de cacahuète par-dessus."],
    description="Le goût d’un dessert, l’énergie d’un vrai petit-déjeuner.")
recette("Tartine saumon fumé, chèvre frais & concombre", ["petit_dejeuner", "collation"], 5, ["Salé", "Rapide", "Sans cuisson"], [
    G(PAIN_SEIGLE, 50, pas=10), P(SAUMON_FUME, 40), L(CHEVRE_FRAIS, 20), X(CONCOMBRE, 40), X(ANETH, 1), X(CITRON, 5)],
    ["Tartine le pain de chèvre frais.", "Ajoute le concombre en fines rondelles et le saumon fumé.", "Termine par l’aneth, quelques gouttes de citron et du poivre."])
recette("Bowl fromage blanc, kiwi & graines de lin", ["petit_dejeuner", "collation"], 5, ["Sucré", "Végétarien", "Rapide", "Sans cuisson"], [
    P(FROMAGE_BLANC, 180), F(KIWI, 100, pas=10), G(FLOCONS, 30), L(LIN, 10), X(MIEL, 5)],
    ["Verse le fromage blanc dans un bol.", "Ajoute les flocons, le kiwi en dés et les graines de lin.", "Termine par un filet de miel."])
recette("Muffins œuf-jambon express", ["petit_dejeuner", "collation"], 25, ["Salé", "Batch cooking"], [
    P(OEUF, 2, unite="unite"), P(JAMBON, 30), X(POIVRON, 40), L(EMMENTAL, 15), X(CIBOULETTE, 2), G(PAIN_COMPLET, 40, pas=10)],
    ["Préchauffe le four à 180 °C.", "Bats les œufs, ajoute le jambon et le poivron en petits dés, l’emmental et la ciboulette.",
     "Répartis dans 3 moules à muffins en silicone.", "Enfourne 18 à 20 minutes. Sers avec le pain complet."],
    astuce="Ils se gardent 3 jours au frais : 30 secondes au micro-ondes le matin.")
recette("Pain perdu protéiné aux fruits rouges", ["petit_dejeuner"], 15, ["Sucré", "Végétarien"], [
    G(PAIN_COMPLET, 60, pas=10), P(OEUF, 1, unite="unite"), P(BLANC_OEUF, 60), X(LAIT, 50), X(CANNELLE, 1),
    F(FRUITS_ROUGES, 80, pas=10), L(BEURRE, 4, mini=0), X(SIROP_ERABLE, 5)],
    ["Bats l’œuf, les blancs, le lait et la cannelle dans une assiette creuse.", "Trempe les tranches de pain des deux côtés.",
     "Fais-les dorer 2 minutes par face dans la poêle beurrée.", "Sers avec les fruits rouges et le sirop d’érable."])
recette("Smoothie vert kiwi, banane & épinards", ["petit_dejeuner", "collation"], 5, ["Sucré", "Végétarien", "Rapide", "Sans cuisson"], [
    P(WHEY, 25), F(KIWI, 80, pas=10), F(BANANE, 60, pas=10), X(EPINARD, 30), X(LAIT_AMANDE, 200), G(FLOCONS, 20), L(LIN, 8)],
    ["Mets tous les ingrédients dans le blender.", "Mixe 1 minute jusqu’à ce que ce soit bien lisse.", "Ajoute un peu d’eau ou de glaçons selon la texture voulue."],
    description="On ne sent pas les épinards, promis : juste un smoothie bien frais.")

# ----- Déjeuners (15) -----
recette("Salade d’épeautre, butternut rôtie, poulet & feta", ["dejeuner"], 35, ["Salé", "Batch cooking"], [
    G(EPEAUTRE, 60), X(BUTTERNUT, 150), P(POULET, 110), L(FETA, 20), L(HUILE_OLIVE, 5, mini=0), X(ROQUETTE, 30), X(THYM, 1)],
    ["Fais cuire l’épeautre 25 minutes dans l’eau bouillante salée.", "Coupe la butternut en cubes, arrose d’un peu d’huile, ajoute le thym et rôtis 25 minutes à 200 °C.",
     "Fais dorer le poulet en lanières 6 minutes à la poêle.", "Mélange l’épeautre, la butternut, la roquette, le poulet et la feta émiettée."])
recette("Bowl truite, quinoa, avocat & radis", ["dejeuner", "diner"], 25, ["Salé"], [
    P(TRUITE, 120), G(QUINOA, 50), L(AVOCAT, 40, mini=0), X(RADIS, 50), X(MACHE, 30), X(CITRON, 10), X(ANETH, 1)],
    ["Rince le quinoa et cuis-le 12 minutes dans 2 fois son volume d’eau.", "Fais cuire la truite 4 minutes côté peau à la poêle, puis 1 minute de l’autre côté.",
     "Dispose dans un bol le quinoa, la mâche, les radis en rondelles et l’avocat.", "Ajoute la truite, le citron et l’aneth."])
recette("Wrap dinde, houmous express & crudités", ["dejeuner"], 15, ["Salé", "Rapide"], [
    G(TORTILLA, 1, unite="unite"), P(DINDE, 100), X(POIS_CHICHE, 40), L(TAHIN, 10), X(CITRON, 5), X(CAROTTE, 40), X(LAITUE, 20), X(PAPRIKA, 1)],
    ["Écrase les pois chiches avec le tahin, le citron et 1 cuillère d’eau : voilà ton houmous express.", "Cuis la dinde en lanières 5 minutes à la poêle avec le paprika.",
     "Tartine la tortilla de houmous, ajoute la salade, la carotte râpée et la dinde.", "Roule bien serré et coupe en deux."])
recette("Salade de haricots blancs, thon & tomates séchées", ["dejeuner"], 10, ["Salé", "Rapide", "Sans cuisson"], [
    P(THON, 100), G(HARICOT_BLANC, 120), G(PAIN_COMPLET, 40, pas=10), X(TOMATE_SECHEE, 15), X(OIGNON_ROUGE, 20), L(HUILE_OLIVE, 8, mini=0), X(ROQUETTE, 30), X(PERSIL, 3),
    X(VINAIGRE_BALSAMIQUE, 5)],
    ["Rince et égoutte les haricots blancs.", "Mélange-les avec le thon émietté, les tomates séchées et l’oignon rouge émincés.",
     "Assaisonne d’huile, de vinaigre balsamique, de persil, sel et poivre.", "Sers sur la roquette, avec le pain complet."])
recette("Riz sauté aux crevettes, petits pois & œuf", ["dejeuner", "diner"], 20, ["Salé"], [
    P(CREVETTE_CRUE, 100), P(OEUF, 1, unite="unite"), G(RIZ, 60), X(PETITS_POIS, 60), X(CAROTTE, 40), L(HUILE_SESAME, 5, mini=0),
    X(SAUCE_SOJA, 10), X(CIBOULETTE, 2)],
    ["Cuis le riz, puis laisse-le refroidir (idéalement la veille).", "Dans un wok chaud, fais sauter les crevettes 2 minutes avec l’huile, puis réserve.",
     "Saute la carotte en dés et les petits pois 3 minutes, ajoute le riz et la sauce soja.", "Pousse le riz sur le côté, brouille l’œuf, mélange tout et remets les crevettes. Parsème de ciboulette."],
    astuce="Le riz de la veille donne un riz sauté bien grainé.")
recette("Quiche sans pâte poireaux & saumon fumé", ["dejeuner", "diner"], 40, ["Salé", "Batch cooking"], [
    P(OEUF, 2, unite="unite"), P(SAUMON_FUME, 40), X(POIREAU, 120), X(LAIT, 60), L(CREME_LEGERE, 20, mini=0), L(EMMENTAL, 10, mini=0),
    G(PAIN_COMPLET, 50, pas=10), X(MUSCADE, 0.5)],
    ["Émince les poireaux et fais-les fondre 10 minutes à la poêle avec un peu d’eau.", "Bats les œufs avec le lait, la crème, la muscade, sel et poivre.",
     "Ajoute les poireaux et le saumon en lanières, verse dans un petit plat et parsème d’emmental.", "Enfourne 25 minutes à 180 °C. Sers avec le pain complet et une salade."])
recette("Falafels au four, boulgour & sauce yaourt-menthe", ["dejeuner", "diner"], 35, ["Salé", "Végétarien", "Batch cooking"], [
    G(POIS_CHICHE, 100), G(BOULGOUR, 40), P(SKYR, 100), L(HUILE_OLIVE, 5, mini=0), X(OIGNON, 20), X(PERSIL, 5), X(CUMIN, 1), X(MENTHE, 2),
    X(CONCOMBRE, 60), X(TOMATE, 60)],
    ["Mixe les pois chiches avec l’oignon, le persil, le cumin, sel et poivre : la pâte doit se tenir.", "Forme des petites boules, aplatis-les, badigeonne d’huile et enfourne 20 minutes à 200 °C en les retournant à mi-cuisson.",
     "Cuis le boulgour 10 minutes dans l’eau bouillante.", "Mélange le skyr avec la menthe ciselée et sers avec les falafels, le boulgour, la tomate et le concombre."])
recette("Minestrone au jambon & parmesan", ["dejeuner", "diner"], 35, ["Salé", "Batch cooking"], [
    P(JAMBON, 50), G(PATES, 40), X(HARICOT_BLANC, 60), X(COURGETTE, 80), X(CAROTTE, 60), X(POIREAU, 50), X(TOMATE_PULPE, 100),
    X(BOUILLON_LEGUMES, 250), L(PARMESAN, 10), L(HUILE_OLIVE, 3, mini=0), X(BASILIC, 2)],
    ["Fais revenir le poireau émincé dans l’huile, ajoute la carotte et la courgette en dés.", "Verse la pulpe de tomate et le bouillon, laisse mijoter 15 minutes.",
     "Ajoute les pâtes et les haricots blancs, cuis encore 10 minutes.", "Sers avec les dés de jambon, le parmesan et le basilic."],
    astuce="Encore meilleur réchauffé le lendemain.")
recette("Salade de pommes de terre, maquereau & mâche", ["dejeuner"], 25, ["Salé"], [
    P(MAQUEREAU, 100), G(PDT, 200), X(OIGNON_ROUGE, 20), X(CORNICHON, 15), L(HUILE_COLZA, 6, mini=0), X(MOUTARDE, 5), X(MACHE, 30), X(ANETH, 1)],
    ["Cuis les pommes de terre 20 minutes dans l’eau, puis coupe-les en rondelles tièdes.", "Fouette l’huile avec la moutarde, sel et poivre.",
     "Mélange les pommes de terre avec l’oignon rouge, les cornichons et la vinaigrette.", "Ajoute le maquereau en morceaux, la mâche et l’aneth."])
recette("Salade thaï au poulet, vermicelles & cacahuète", ["dejeuner", "diner"], 20, ["Salé"], [
    P(POULET, 120), G(VERMICELLE_RIZ, 150), L(CACAHUETE_BEURRE, 10, mini=0), X(SAUCE_SOJA, 10), X(CITRON_VERT, 10), X(CAROTTE, 50),
    X(CONCOMBRE, 50), X(MENTHE, 2), X(CORIANDRE, 2)],
    ["Fais tremper les vermicelles selon le paquet, puis rince-les à l’eau froide.", "Cuis le poulet en lanières 6 minutes à la poêle.",
     "Mélange le beurre de cacahuète, la sauce soja, le jus de citron vert et 2 cuillères d’eau chaude.", "Assemble vermicelles, carotte râpée, concombre, poulet et sauce ; parsème de menthe et coriandre."])
recette("Pita poulet tandoori & sauce concombre", ["dejeuner"], 20, ["Salé"], [
    P(POULET, 120), G(PAIN_PITA, 60, pas=10), P(SKYR, 60), X(CONCOMBRE, 50), X(TOMATE, 50), X(OIGNON_ROUGE, 15), X(PAPRIKA, 1),
    X(CURCUMA, 1), X(CUMIN, 1), L(HUILE_OLIVE, 5, mini=0)],
    ["Mélange le poulet en lanières avec l’huile, le paprika, le curcuma et le cumin.", "Fais-le dorer 6 à 8 minutes à la poêle.",
     "Râpe le concombre, presse-le et mélange-le au skyr avec sel et poivre.", "Garnis la pita de poulet, tomate, oignon rouge et sauce."])
recette("Taboulé de chou-fleur, poulet & grenade", ["dejeuner"], 20, ["Salé", "Batch cooking"], [
    X(CHOU_FLEUR, 150), P(POULET, 120), G(BOULGOUR, 40), F(GRENADE, 40, pas=5), L(HUILE_OLIVE, 8, mini=0), X(MENTHE, 3), X(PERSIL, 5), X(CITRON, 15)],
    ["Mixe le chou-fleur cru en petits grains, comme une semoule.", "Cuis le boulgour 10 minutes et le poulet 8 minutes à la poêle.",
     "Mélange chou-fleur, boulgour, herbes ciselées, citron et huile.", "Ajoute le poulet en dés et les grains de grenade."])
recette("Tortilla espagnole légère & salade", ["dejeuner", "diner"], 30, ["Salé", "Végétarien"], [
    P(OEUF, 2, unite="unite"), P(BLANC_OEUF, 60), G(PDT, 200), X(OIGNON, 50), L(HUILE_OLIVE, 6, mini=0), X(LAITUE, 40)],
    ["Coupe les pommes de terre en fines rondelles et l’oignon en lamelles.", "Fais-les cuire 15 minutes à feu doux avec l’huile et un couvercle.",
     "Verse les œufs et les blancs battus, cuis 5 minutes, puis retourne la tortilla à l’aide d’une assiette.", "Cuis encore 3 minutes et sers avec la salade."])
recette("Pâtes au pesto, poulet & tomates cerises", ["dejeuner", "diner"], 20, ["Salé", "Rapide"], [
    G(PATES, 70), P(POULET, 110), L(PESTO, 15), X(TOMATE_CERISE, 100), X(ROQUETTE, 20)],
    ["Cuis les pâtes al dente.", "Pendant ce temps, fais dorer le poulet en dés 6 minutes à la poêle.",
     "Égoutte les pâtes en gardant un peu d’eau de cuisson.", "Mélange pâtes, pesto, poulet et tomates cerises coupées en deux, ajoute la roquette."])
recette("Bowl tofu croustillant, riz & chou rouge", ["dejeuner", "diner"], 25, ["Salé", "Végétarien"], [
    X(TOFU, 100), P(PST, 60, note="réhydratées"), G(RIZ, 60), X(CHOU_ROUGE, 80), X(CAROTTE, 50), X(FECULE, 5), L(HUILE_SESAME, 3, mini=0), X(SAUCE_SOJA, 10),
    X(GINGEMBRE_FRAIS, 3), X(SESAME, 2)],
    ["Cuis le riz.", "Coupe le tofu en cubes, enrobe-les de fécule et fais-les dorer 8 minutes à la poêle avec l’huile.",
     "Ajoute les protéines de soja réhydratées, la sauce soja et le gingembre râpé, fais sauter 3 minutes.", "Sers sur le riz avec le chou rouge émincé, la carotte râpée et le sésame."])

# ----- Dîners (15) -----
recette("Velouté de butternut, tartines chèvre & bresaola", ["diner"], 30, ["Salé", "Batch cooking"], [
    X(BUTTERNUT, 250), X(OIGNON, 30), X(BOUILLON_LEGUMES, 200), X(MUSCADE, 0.5), G(PAIN_COMPLET, 50, pas=10), L(CHEVRE_FRAIS, 30),
    P(BRESAOLA, 40)],
    ["Fais revenir l’oignon, ajoute la butternut en cubes et le bouillon.", "Laisse cuire 20 minutes, puis mixe avec la muscade, sel et poivre.",
     "Tartine le pain grillé de chèvre frais et ajoute la bresaola.", "Sers le velouté bien chaud avec les tartines."])
recette("Filet mignon, purée de panais & haricots verts", ["diner", "dejeuner"], 35, ["Salé"], [
    P(PORC_FILET, 130), G(PDT, 150), X(PANAIS, 100), X(LAIT, 40), L(BEURRE, 5, mini=0), X(HARICOT_VERT, 100), X(ROMARIN, 1)],
    ["Cuis la pomme de terre et le panais en morceaux 20 minutes dans l’eau.", "Écrase-les avec le lait chaud et le beurre.",
     "Saisis le filet mignon en médaillons 3 minutes par face avec le romarin.", "Sers avec la purée et les haricots verts cuits à la vapeur."])
recette("Colin aux herbes, riz & fenouil fondant", ["diner"], 30, ["Salé"], [
    P(COLIN, 150), G(RIZ, 55), X(FENOUIL, 150), L(HUILE_OLIVE, 8, mini=0), X(CITRON, 10), X(PERSIL, 3), X(ANETH, 1)],
    ["Émince le fenouil et fais-le fondre 15 minutes à feu doux avec la moitié de l’huile et un fond d’eau.", "Cuis le riz.",
     "Fais cuire le colin 3 minutes par face avec le reste d’huile.", "Parsème d’herbes et de citron, sers avec le riz et le fenouil."])
recette("Curry de pois chiches, tofu & épinards", ["diner", "dejeuner"], 30, ["Salé", "Végétarien", "Batch cooking"], [
    P(TOFU, 100), X(POIS_CHICHE, 60), G(RIZ, 50), L(LAIT_COCO, 30, mini=0), X(EPINARD, 80), X(TOMATE_PULPE, 100), X(OIGNON, 30),
    X(CURRY, 2), X(GINGEMBRE_FRAIS, 3)],
    ["Fais revenir l’oignon, le gingembre et le curry 2 minutes.", "Ajoute le tofu en dés, les pois chiches, la pulpe de tomate et le lait de coco.",
     "Laisse mijoter 15 minutes, puis ajoute les épinards jusqu’à ce qu’ils tombent.", "Sers avec le riz."])
recette("Gratin de chou-fleur, pommes de terre & jambon", ["diner"], 45, ["Salé", "Batch cooking"], [
    P(JAMBON, 60), X(CHOU_FLEUR, 250), G(PDT, 150), X(LAIT, 120), X(FECULE, 8), L(EMMENTAL, 20), X(MUSCADE, 0.5)],
    ["Cuis le chou-fleur en fleurettes et la pomme de terre en rondelles 12 minutes à la vapeur.", "Fais épaissir le lait avec la fécule à feu doux en remuant, ajoute la muscade.",
     "Dispose légumes et jambon en lanières dans un plat, nappe de sauce et parsème d’emmental.", "Gratine 20 minutes à 200 °C."],
    description="Le réconfort d’un gratin, en version légère.")
recette("Endives au jambon, sauce légère", ["diner"], 45, ["Salé"], [
    P(JAMBON, 60), X(ENDIVE, 250), X(LAIT, 120), X(FECULE, 8), L(GRUYERE, 20), G(PDT, 150), X(MUSCADE, 0.5)],
    ["Cuis les endives 15 minutes à la vapeur, puis presse-les pour enlever l’eau.", "Roule chaque endive dans une tranche de jambon.",
     "Prépare la sauce : fais épaissir le lait avec la fécule et la muscade. Nappe les endives et parsème de gruyère.", "Gratine 20 minutes à 200 °C. Sers avec les pommes de terre vapeur."])
recette("Saumon, lentilles vertes & poireaux à la moutarde", ["diner", "dejeuner"], 35, ["Salé"], [
    P(SAUMON, 110), G(LENTILLE_VERTE, 50), X(POIREAU, 120), X(MOUTARDE, 5), L(HUILE_OLIVE, 3, mini=0), X(THYM, 1)],
    ["Cuis les lentilles 25 minutes avec le thym.", "Fais fondre les poireaux émincés 10 minutes à la poêle avec un fond d’eau, ajoute la moutarde.",
     "Fais cuire le saumon côté peau 6 minutes à feu moyen, puis 1 minute de l’autre côté.", "Sers sur les lentilles et les poireaux."])
recette("Steak haché, potatoes au four & salade", ["diner", "dejeuner"], 35, ["Salé"], [
    P(BOEUF5, 120), G(PDT, 200), L(HUILE_OLIVE, 6, mini=0), X(PAPRIKA, 1), X(HERBES, 1), X(LAITUE, 50), X(TOMATE, 80)],
    ["Coupe les pommes de terre en quartiers avec la peau, mélange-les avec l’huile, le paprika et les herbes.", "Enfourne 30 minutes à 210 °C en les retournant à mi-cuisson.",
     "Cuis le steak haché 2 à 3 minutes par face.", "Sers avec la salade et la tomate."],
    description="Le classique qui fait plaisir, sans friteuse.")
recette("Risotto crémeux aux champignons & poulet", ["diner", "dejeuner"], 35, ["Salé"], [
    G(RIZ, 60), P(POULET, 100), X(CHAMPIGNON, 120), X(OIGNON, 30), X(BOUILLON_LEGUMES, 250), L(PARMESAN, 15), L(HUILE_OLIVE, 3, mini=0)],
    ["Fais revenir l’oignon et les champignons émincés avec l’huile.", "Ajoute le riz, mélange 1 minute, puis verse le bouillon chaud louche par louche en remuant (18 minutes).",
     "Pendant ce temps, fais dorer le poulet en dés.", "Hors du feu, incorpore le parmesan et le poulet."])
recette("Tacos de poulet, avocat & salsa tomate", ["diner", "dejeuner"], 20, ["Salé"], [
    G(TORTILLA, 2, unite="unite"), P(POULET, 120), L(AVOCAT, 40, mini=0), X(TOMATE, 80), X(OIGNON_ROUGE, 20), X(CITRON_VERT, 5),
    X(CORIANDRE, 3), X(LAITUE, 30), X(PAPRIKA, 1), X(CUMIN, 1)],
    ["Cuis le poulet en lanières 6 minutes avec le paprika et le cumin.", "Mélange la tomate et l’oignon rouge en petits dés avec le citron vert et la coriandre : c’est la salsa.",
     "Réchauffe les tortillas 30 secondes à la poêle.", "Garnis de salade, poulet, avocat en lamelles et salsa."])
recette("Bouillon asiatique au poulet & pak choï", ["diner"], 25, ["Salé"], [
    P(POULET, 110), G(VERMICELLE_RIZ, 120), X(PAK_CHOI, 100), X(CHAMPIGNON, 50), X(GINGEMBRE_FRAIS, 4), X(SAUCE_SOJA, 10),
    X(BOUILLON_VOLAILLE, 350), L(HUILE_SESAME, 4, mini=0), X(CORIANDRE, 2)],
    ["Porte le bouillon à frémissement avec le gingembre râpé et la sauce soja.", "Ajoute le poulet en fines lanières et les champignons, cuis 6 minutes.",
     "Ajoute le pak choï émincé et les vermicelles, cuis 2 minutes.", "Sers avec un filet d’huile de sésame et la coriandre."],
    description="Un bol chaud et parfumé, parfait les soirs d’hiver.")
recette("Lasagnes courgettes & bœuf", ["diner"], 50, ["Salé", "Batch cooking"], [
    P(BOEUF5, 110), G(PATES, 40, note="feuilles de lasagne"), X(COURGETTE, 200), X(TOMATE_PULPE, 150), X(OIGNON, 30), L(MOZZA, 30), X(ORIGAN, 1)],
    ["Fais revenir l’oignon et le bœuf, ajoute la pulpe de tomate et l’origan, laisse mijoter 10 minutes.", "Coupe la courgette en fines tranches dans la longueur.",
     "Alterne dans un plat : sauce, feuilles de lasagne, courgettes. Termine par la sauce et la mozzarella.", "Enfourne 30 minutes à 190 °C."])
recette("Wok de porc au gingembre & légumes croquants", ["diner", "dejeuner"], 20, ["Salé", "Rapide"], [
    P(PORC_FILET, 120), G(RIZ, 55), X(POIS_GOURMAND, 80), X(POIVRON, 60), X(POUSSES_SOJA, 50), X(GINGEMBRE_FRAIS, 4), X(SAUCE_SOJA, 10),
    L(HUILE_SESAME, 5, mini=0)],
    ["Cuis le riz.", "Saisis le porc en fines lanières 3 minutes dans le wok bien chaud avec l’huile.",
     "Ajoute le poivron, les pois gourmands et le gingembre, saute 3 minutes : ils doivent rester croquants.", "Ajoute les pousses de soja et la sauce soja, mélange 1 minute. Sers avec le riz."])
recette("Truite au four, pommes de terre & brocolis, sauce aneth", ["diner"], 30, ["Salé"], [
    P(TRUITE, 130), G(PDT, 180), X(BROCOLI, 120), X(SKYR, 40), X(ANETH, 2), X(CITRON, 10), L(HUILE_OLIVE, 5, mini=0)],
    ["Cuis les pommes de terre 20 minutes et le brocoli 6 minutes à la vapeur.", "Pose la truite sur une plaque, arrose d’huile et de citron, enfourne 12 minutes à 200 °C.",
     "Mélange le skyr avec l’aneth, sel et poivre.", "Sers la truite avec les légumes et la sauce."])
recette("Tajine de poulet, carottes & pois chiches", ["diner", "dejeuner"], 40, ["Salé", "Batch cooking"], [
    P(POULET, 120), G(SEMOULE, 45), X(POIS_CHICHE, 50), X(CAROTTE, 100), X(OIGNON, 40), X(CUMIN, 1), X(CURCUMA, 1), X(CANNELLE, 0.5),
    L(HUILE_OLIVE, 5, mini=0), X(CORIANDRE, 2)],
    ["Fais dorer le poulet en morceaux avec l’huile, l’oignon et les épices.", "Ajoute les carottes en rondelles, les pois chiches et un verre d’eau.",
     "Couvre et laisse mijoter 25 minutes.", "Prépare la semoule et sers avec la coriandre."])

# ----- Collations (10) -----
recette("Muffins myrtilles & avoine", ["collation", "petit_dejeuner"], 25, ["Sucré", "Végétarien", "Batch cooking"], [
    G(FLOCONS, 35, note="mixés en farine"), P(WHEY, 15), P(BLANC_OEUF, 40), F(MYRTILLE, 40, pas=10), X(LAIT, 30), X(LEVURE, 2),
    X(SIROP_ERABLE, 5), L(HUILE_COLZA, 4, mini=0)],
    ["Préchauffe le four à 180 °C.", "Mélange la farine d’avoine, la protéine et la levure, puis ajoute les blancs, le lait, l’huile et le sirop d’érable.",
     "Incorpore les myrtilles et répartis dans 2 moules à muffins.", "Enfourne 18 à 20 minutes."])
recette("Banana bread protéiné", ["collation", "petit_dejeuner"], 50, ["Sucré", "Végétarien", "Batch cooking"], [
    G(FLOCONS, 30, note="mixés en farine"), F(BANANE, 50, pas=10), P(WHEY, 15), P(BLANC_OEUF, 30), L(NOIX, 8), X(LEVURE, 2), X(CANNELLE, 1)],
    ["Écrase des bananes bien mûres, ajoute les blancs, la farine d’avoine, la protéine, la levure et la cannelle.", "Incorpore les noix concassées.",
     "Verse dans un moule à cake et enfourne 40 minutes à 180 °C.", "Laisse tiédir avant de couper en tranches."],
    description="Pour un cake entier, multiplie les quantités par 6 : une tranche = une portion.")
recette("Fromage blanc, kiwi & pistaches", ["collation"], 5, ["Sucré", "Végétarien", "Rapide", "Sans cuisson"], [
    P(FROMAGE_BLANC, 150), F(KIWI, 100, pas=10), L(PISTACHE, 10), G(FLOCONS, 15)],
    ["Verse le fromage blanc dans un bol.", "Ajoute le kiwi en dés et les flocons.", "Parsème de pistaches concassées."])
recette("Tartine de seigle, ricotta & figue", ["collation"], 5, ["Sucré", "Végétarien", "Rapide", "Sans cuisson"], [
    G(PAIN_SEIGLE, 40, pas=10), X(RICOTTA, 25), P(SKYR, 80), F(FIGUE_SECHE, 20, pas=5), L(NOIX, 5, mini=0), X(MIEL, 3)],
    ["Mélange la ricotta et le skyr, puis tartine le pain.", "Ajoute la figue en lamelles et les noix concassées.", "Termine par un filet de miel."])
recette("Pois chiches croustillants & dip aux herbes", ["collation"], 30, ["Salé", "Végétarien", "Batch cooking"], [
    G(POIS_CHICHE, 80), L(HUILE_OLIVE, 5, mini=0), X(PAPRIKA, 1), P(SKYR, 100), X(CIBOULETTE, 2), X(CAROTTE, 60), X(CONCOMBRE, 60)],
    ["Sèche bien les pois chiches dans un torchon, mélange-les avec l’huile, le paprika et le sel.", "Enfourne 25 minutes à 200 °C en remuant à mi-cuisson : ils deviennent croustillants.",
     "Mélange le skyr avec la ciboulette, sel et poivre.", "Sers avec les bâtonnets de carotte et de concombre."])
recette("Mousse chocolat-skyr & framboises", ["collation"], 5, ["Sucré", "Végétarien", "Rapide", "Sans cuisson"], [
    P(SKYR, 150), X(CACAO, 8), L(CHOCOLAT_NOIR, 10, mini=0), F(FRAMBOISE, 60, pas=10), X(SIROP_ERABLE, 5)],
    ["Fais fondre le chocolat 30 secondes au micro-ondes.", "Fouette le skyr avec le cacao, le sirop d’érable et le chocolat fondu.",
     "Sers avec les framboises."],
    description="L’envie de chocolat, version rassasiante.")
recette("Crêpe protéinée express & compote", ["collation"], 10, ["Sucré", "Végétarien", "Rapide"], [
    G(FLOCONS, 30, note="mixés en farine"), P(BLANC_OEUF, 80), X(LAIT, 30), F(COMPOTE, 80, pas=10), X(CANNELLE, 1), L(HUILE_COLZA, 2, mini=0)],
    ["Mixe les flocons avec les blancs et le lait.", "Verse dans une poêle légèrement huilée et étale.",
     "Cuis 1 à 2 minutes par face.", "Garnis de compote et de cannelle, puis roule."])
recette("Smoothie orange, carotte & gingembre", ["collation"], 5, ["Sucré", "Végétarien", "Rapide", "Sans cuisson"], [
    F(ORANGE, 100, pas=10), X(CAROTTE, 40), P(SKYR, 120), G(FLOCONS, 15), L(LIN, 5, mini=0), X(GINGEMBRE_FRAIS, 2)],
    ["Épluche l’orange et coupe la carotte en rondelles.", "Mixe tous les ingrédients avec un peu d’eau froide jusqu’à obtenir un smoothie lisse."],
    description="Un plein de vitamine C pour l’hiver.")
recette("Barres de céréales maison aux pruneaux", ["collation"], 30, ["Sucré", "Végétarien", "Batch cooking"], [
    G(FLOCONS, 30), F(PRUNEAU, 20, pas=5), L(AMANDE, 10), P(WHEY, 10), X(MIEL, 5), X(CANNELLE, 1)],
    ["Mixe grossièrement les pruneaux et les amandes.", "Mélange avec les flocons, la protéine, le miel, la cannelle et 2 cuillères d’eau.",
     "Tasse dans un petit moule et enfourne 15 minutes à 170 °C.", "Laisse refroidir complètement avant de couper en barres."],
    astuce="Elles se gardent une semaine dans une boîte : pratique dans le sac.")
recette("Roulés de jambon, chèvre frais & galettes de riz", ["collation"], 5, ["Salé", "Rapide", "Sans cuisson"], [
    P(JAMBON, 50), L(CHEVRE_FRAIS, 25), G(GALETTE_RIZ, 2, unite="unite"), X(CONCOMBRE, 60), X(CIBOULETTE, 2)],
    ["Tartine les tranches de jambon de chèvre frais et parsème de ciboulette.", "Ajoute des bâtonnets de concombre et roule.",
     "Sers avec les galettes de riz."])


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
