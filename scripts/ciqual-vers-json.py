"""
Convertit la table Ciqual officielle de l'ANSES (fichier Excel « Table Ciqual 2020_FR_2020 07 07.xls »)
en data/ciqual.json, utilisé par l'import des aliments dans le dashboard coach.

Usage :  python3 scripts/ciqual-vers-json.py chemin/vers/Table_Ciqual.xls
Dépendance : xlrd==2.0.1 (pip install xlrd==2.0.1)

Catégories d'exclusion : devinées à partir du groupe et du nom de l'aliment.
C'est une AIDE : la coach les vérifie (allergies !) dans le dashboard.
"""
import json
import re
import sys
import unicodedata

import xlrd

COLONNES = {
    "groupe": "alim_grp_nom_fr",
    "sous_groupe": "alim_ssgrp_nom_fr",
    "code": "alim_code",
    "nom": "alim_nom_fr",
    "kcal": "Energie, Règlement UE N° 1169/2011 (kcal/100 g)",
    "proteines": "Protéines, N x facteur de Jones (g/100 g)",
    "glucides": "Glucides (g/100 g)",
    "lipides": "Lipides (g/100 g)",
    "fibres": "Fibres alimentaires (g/100 g)",
    "alcool": "Alcool (g/100 g)",
}
EXCLUS = {"aliments infantiles"}
EXCLUS_SOUS_GROUPES = {"eaux"}


def normal(texte):
    t = unicodedata.normalize("NFD", texte.lower().replace("œ", "oe").replace("æ", "ae"))
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def nombre(valeur):
    if isinstance(valeur, float):
        return round(valeur, 2)
    v = str(valeur).strip().replace(",", ".")
    if v in ("", "-"):
        return None
    if v.lower() == "traces":
        return 0.0
    if v.startswith("<"):
        try:
            return round(float(v[1:].strip()) / 2, 2)
        except ValueError:
            return None
    try:
        return round(float(v), 2)
    except ValueError:
        return None


def contient(nom, mots):
    return any(re.search(r"\b" + m, nom) for m in mots)


def categories(nom_brut, groupe, sous_groupe):
    nom = normal(nom_brut)
    g, sg = normal(groupe), normal(sous_groupe)
    cats = set()
    vegetal = contient(nom, ["vegetal", "soja", "amande", "avoine", "riz", "coco", "noisette", "pois", "cajou", "epeautre",
                             "tofu", "seitan", "vegetarien", "vegan", "convient aux veganes"])

    porc = ["porc", "jambon", "lard", "lardon", "bacon", "saucisson", "chorizo", "rillette", "andouill", "boudin",
            "coppa", "pancetta", "mortadelle", "salami", "cervelas", "knack", "travers", "echine", "carbonara",
            "choucroute garnie", "cassoulet", "saucisse de toulouse", "saucisse de morteau", "saucisse de strasbourg",
            "pate de campagne", "pate de foie", "rosette", "jesus", "francfort"]
    volaille = ["poulet", "dinde", "canard", "pintade", "caille", "oie", "chapon", "volaille", "coquelet",
                "magret", "foie gras", "nuggets"]
    viande = ["boeuf", "veau", "agneau", "mouton", "cheval", "gibier", "chevreuil", "sanglier", "lapin", "steak",
              "entrecote", "bavette", "rumsteck", "faux-filet", "hache", "merguez", "kebab", "hamburger", "burger",
              "bolognaise", "hachis parmentier", "chili con carne", "moussaka", "lasagne", "boulette", "pot-au-feu",
              "blanquette", "tajine", "couscous royal", "osso", "carpaccio", "tartare de boeuf", "rosbif", "roti de",
              "cote de", "langue", "foie de", "rognon", "abats", "cordon bleu"]
    poisson = ["poisson", "saumon", "thon", "cabillaud", "colin", "sardine", "maquereau", "truite", "merlu", "sole",
               "dorade", "daurade", "bar ", "lieu", "hareng", "anchois", "surimi", "flétan", "fletan", "lotte",
               "merlan", "eglefin", "haddock", "tilapia", "panga", "rouget", "raie", "espadon", "brandade",
               "tarama", "rillettes de thon", "rillettes de saumon"]
    mer = ["crevette", "moule", "huitre", "calamar", "encornet", "poulpe", "seiche", "crabe", "homard",
           "langoustine", "saint-jacques", "coquille st", "bulot", "palourde", "bigorneau", "ecrevisse",
           "fruits de mer", "paella"]

    if not vegetal and contient(nom, porc):
        cats.add("Porc")
    if not vegetal and contient(nom, volaille) and "graisse" not in nom and not nom.startswith("oeuf"):
        cats.add("Volaille")
    if not vegetal and contient(nom, viande):
        cats.add("Viande")
    if sg in ("viandes crues", "viandes cuites", "charcuteries et assimilés".replace("é", "e"),
              "autres produits a base de viande") and not cats and not vegetal:
        cats.add("Viande")
    if sg in ("poissons crus", "poissons cuits", "produits a base de poissons et produits de la mer") or contient(nom, poisson):
        if not contient(nom, ["sauce poisson"]):
            cats.add("Poisson")
    if sg.startswith("mollusques et crustaces") or contient(nom, mer):
        cats.add("Fruits de mer")
        if "Poisson" in cats and not contient(nom, poisson):
            cats.discard("Poisson")
    if sg == "oeufs" or contient(nom, ["oeuf", "omelette", "mayonnaise", "quiche", "flan", "creme brulee",
                                        "creme caramel", "ile flottante", "meringue", "madeleine", "crepe", "gaufre",
                                        "pancake", "brioche", "genoise", "cake", "clafoutis", "tiramisu"]):
        if not contient(nom, ["sans oeuf"]):
            cats.add("Œuf")
    laitiers_mots = ["fromage", "yaourt", "yogourt", "skyr", "creme fraiche", "creme epaisse", "creme liquide",
                     "creme legere", "mozzarella", "parmesan", "emmental", "comte", "feta", "chevre", "ricotta",
                     "mascarpone", "camembert", "brie", "roquefort", "raclette", "gruyere", "cheddar", "reblochon",
                     "petit-suisse", "faisselle", "lait ", "lait,", "laitier", "beurre", "quiche", "gratin",
                     "bechamel", "glace", "creme dessert", "flan", "riz au lait", "chocolat au lait", "milk"]
    non_laitier = ["lait de coco", "lait d'amande", "lait de soja", "lait d'avoine", "lait de riz", "vegetal",
                   "beurre de cacahuete", "beurre d'arachide", "beurre de cacao", "creme de marron", "noix de coco",
                   "creme de coco", "sans lactose"]
    if (g == "produits laitiers et assimiles" or sg == "beurres" or contient(nom, laitiers_mots)) and not contient(nom, non_laitier):
        cats.add("Produits laitiers")
    gluten_mots = [r"ble\b", "froment", "pain", "pates", "pate brisee", "pate feuilletee", "pate sablee", "pate a ",
                   "semoule", "boulgour", "couscous", "farine",
                   "epeautre", "seigle", "orge", "avoine", "biscuit", "gateau", "viennoiserie", "croissant", "brioche",
                   "pizza", "quiche", "tarte", "crepe", "gaufre", "chapelure", "muesli", "cereales", "lasagne", "ravioli",
                   "tortilla de ble", "wrap", "galette des rois", "madeleine", "cake", "cookie", "sandwich", "burger",
                   "biere", "panure", "pane", "nuggets", "cordon bleu", "blini", "pancake", "taboule", "gnocchi",
                   "seitan", "gluten de ble"]
    sans_gluten = ["sans gluten", "farine de riz", "farine de mais", "farine de sarrasin", "farine de chataigne",
                   "farine de pois chiche", "galette de riz", "galette de sarrasin", "pomme de terre", "pain de sucre",
                   "pate d'amande", "pate de fruit", "pate a tartiner", "pate de campagne", "pate de foie"]
    if (contient(nom, gluten_mots) or sg in ("pains et assimiles", "viennoiseries", "biscuits sucres",
                                             "biscuits aperitifs", "gateaux et patisseries")) and not contient(nom, sans_gluten):
        if not contient(nom, ["riz", "quinoa", "sarrasin", "mais", "millet", "polenta", "tapioca"]) or contient(nom, [r"ble\b", "pain", "biscuit"]):
            cats.add("Gluten")
    if contient(nom, ["noix", "amande", "noisette", "cajou", "pistache", "pecan", "macadamia", "praline", "nougat",
                      "frangipane", "massepain"]) and not contient(nom, ["noix de coco", "noix de muscade",
                                                                         "noix de saint-jacques", "noix de veau",
                                                                         "noix de jambon", "coco",
                                                                         "pomme de terre noisette", "beurre noisette"]):
        cats.add("Fruits à coque")
    if contient(nom, ["arachide", "cacahuete"]):
        cats.add("Arachide")
    if contient(nom, ["soja", "tofu", "tempeh", "edamame", "miso"]):
        cats.add("Soja")
    if contient(nom, ["sesame", "tahin", "houmous", "hummus"]):
        cats.add("Sésame")
    return sorted(cats)


def main(chemin):
    feuille = xlrd.open_workbook(chemin).sheet_by_index(0)
    entete = [str(x).strip() for x in feuille.row_values(0)]
    idx = {cle: entete.index(nom) for cle, nom in COLONNES.items()}
    aliments = []
    for r in range(1, feuille.nrows):
        v = feuille.row_values(r)
        groupe, sous_groupe = str(v[idx["groupe"]]).strip(), str(v[idx["sous_groupe"]]).strip()
        if groupe in EXCLUS or sous_groupe in EXCLUS_SOUS_GROUPES:
            continue
        code = str(int(v[idx["code"]])) if isinstance(v[idx["code"]], float) else str(v[idx["code"]]).strip()
        nom = str(v[idx["nom"]]).strip()
        p, g, l = (nombre(v[idx[k]]) for k in ("proteines", "glucides", "lipides"))
        if p is None and g is None and l is None:
            continue
        kcal = nombre(v[idx["kcal"]])
        if kcal is None:
            fibres = nombre(v[idx["fibres"]]) or 0
            alcool = nombre(v[idx["alcool"]]) or 0
            kcal = round(4 * (p or 0) + 4 * (g or 0) + 9 * (l or 0) + 2 * fibres + 7 * alcool, 1)
        aliments.append({
            "c": code,
            "n": nom,
            "g": groupe or None,
            "sg": sous_groupe if sous_groupe and sous_groupe != "-" else None,
            "p": p if p is not None else 0,
            "gl": g if g is not None else 0,
            "l": l if l is not None else 0,
            "k": kcal,
            "i": p is None or g is None or l is None,
            "cat": categories(nom, groupe, sous_groupe),
        })
    aliments.sort(key=lambda a: normal(a["n"]))
    with open("data/ciqual.json", "w", encoding="utf-8") as f:
        json.dump({"source": "ANSES, Table de composition nutritionnelle des aliments Ciqual 2020 (Licence Ouverte Etalab 2.0)",
                   "aliments": aliments}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(aliments)} aliments écrits dans data/ciqual.json")


if __name__ == "__main__":
    main(sys.argv[1])
