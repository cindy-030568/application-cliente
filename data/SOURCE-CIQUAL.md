# Source des données nutritionnelles

`ciqual.json` est généré par `scripts/ciqual-vers-json.py` à partir de la
**Table de composition nutritionnelle des aliments Ciqual 2020** de l'ANSES
(fichier « Table Ciqual 2020_FR_2020 07 07.xls »), publiée sous
**Licence Ouverte / Open Licence Etalab 2.0**.

- Source : ANSES, https://ciqual.anses.fr — jeu de données sur data.gouv.fr
- Valeurs pour 100 g : protéines (N × facteur de Jones), glucides, lipides,
  énergie (règlement UE 1169/2011, kcal). « traces » → 0 ; « < x » → x/2 ;
  « - » → valeur manquante (aliment signalé « incomplet »).
- Les aliments infantiles et les eaux sont exclus.
- Les catégories d'exclusion (Gluten, Produits laitiers, Viande…) sont
  **devinées automatiquement** et doivent être vérifiées par la coach.

Empreinte SHA-256 du fichier source utilisé :
`a728c29d8d3c944aa679d62d7a2e591c80bac512059ea6772af95760f65da75d`
(date d'enregistrement interne : 3 juillet 2020 06:41:52, identique à la ressource data.gouv.fr).
