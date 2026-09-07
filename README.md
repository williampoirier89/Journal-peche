# Journal de pêche PWA — test Windows + iPhone

## Méthode la plus simple : GitHub Pages
1. Crée un compte gratuit sur GitHub si nécessaire.
2. Crée un nouveau dépôt, par exemple `journal-peche`.
3. Décompresse ce ZIP sur ton PC.
4. Téléverse les fichiers suivants à la racine du dépôt :
   - index.html
   - app.js
   - manifest.webmanifest
   - sw.js
5. Dans GitHub : Settings > Pages.
6. Source : Deploy from a branch.
7. Branche : main, dossier : /root.
8. Enregistre.
9. GitHub te donnera une adresse web du type :
   `https://TON-NOM.github.io/journal-peche/`
10. Ouvre cette adresse sur ton iPhone dans Safari.
11. Appuie sur Partager > Ajouter à l’écran d’accueil.

## Ce que cette V1 teste
- ajout d’une photo
- lieu de pêche
- date et heure
- espèce
- nombre de poissons
- température
- sauvegarde locale sur l’iPhone
- statistiques de base
- export JSON

## Important
Cette V1 ne récupère pas encore automatiquement :
- la date EXIF réelle de la photo sur tous les iPhone
- la météo historique
- l’espèce de poisson par reconnaissance d’image

Ces fonctions seront ajoutées dans la prochaine version.
