# Journal de pêche V2

## Nouveautés
- Date automatique à partir des métadonnées de la photo, si disponible
- GPS automatique à partir de la photo, si disponible
- Tentative de conversion GPS → nom du lieu
- Météo historique automatique :
  - température moyenne de l'air en °C
  - conditions (ensoleillé, nuageux, pluie, etc.)
  - vent moyen
  - rafales
  - direction du vent
  - pression atmosphérique moyenne
  - précipitations
  - couverture nuageuse
- Température de l'eau saisie manuellement en °F
- Option « température de l'eau inconnue »
- Journal et statistiques locales

## Mise à jour de ton GitHub Pages
Tu as déjà le dépôt `Journal-peche`.

1. Décompresse `JournalPecheV2.zip`.
2. Dans ton dépôt GitHub `Journal-peche`, remplace :
   - index.html
   - app.js
   - manifest.webmanifest
   - sw.js
3. Tu peux aussi remplacer README.md.
4. Fais `Commit changes`.
5. Attends environ 1 à 3 minutes.
6. Sur ton iPhone, ouvre ton Journal de pêche.
7. Si l'ancienne version reste affichée :
   - ferme complètement l'application
   - rouvre-la
   - ou ouvre le lien GitHub Pages dans Safari et actualise.

## Premier test recommandé
Utilise une photo prise avec ton iPhone pour laquelle la localisation de l'appareil photo était activée.

Résultat attendu :
1. Sélection de la photo
2. Date détectée automatiquement
3. GPS détecté automatiquement
4. Lieu rempli automatiquement si le service de localisation répond
5. Météo historique récupérée
6. Tu sélectionnes l'espèce et le nombre
7. Tu entres la température de l'eau en °F ou la laisses « Inconnue »
8. Tu enregistres

## Remarques
- Certaines photos partagées par Messenger, Facebook ou d'autres applications peuvent avoir perdu leurs métadonnées GPS/EXIF.
- La reconnaissance automatique de l'espèce de poisson n'est pas encore activée dans cette V2.
- Les données météo sont des données historiques modélisées et peuvent différer d'une mesure prise exactement sur le lac.
