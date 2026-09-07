# Journal de pêche V3

## Nouveautés
- Comptage automatique des poissons par IA
- Proposition automatique de l'espèce
- Espèces visées :
  - Doré jaune
  - Grand brochet
  - Perchaude
  - Truite
  - Achigan à petite bouche
  - Achigan à grande bouche
  - Esturgeon
- Résultat IA toujours modifiable avant l'enregistrement
- Dossiers automatiques par emplacement
- Onglet Moyennes :
  - poissons par entrée
  - température de l'air
  - température de l'eau en °F
  - vent
  - rafales
  - pression
  - précipitations
  - couverture nuageuse
  - condition météo la plus fréquente
  - endroit avec le plus de poissons enregistrés
- Les données V2 existantes sont récupérées automatiquement si elles sont encore dans le navigateur.

## Important concernant l'IA
Cette V3 utilise des modèles d'IA directement dans le navigateur.
Le premier lancement peut télécharger plusieurs centaines de Mo de modèles.
Sur iPhone, la première analyse peut donc prendre 1 à 3 minutes selon l'appareil et la connexion.

Le modèle est généraliste et n'est pas un modèle spécialisé entraîné uniquement sur les poissons du Québec.
L'espèce et le nombre doivent donc toujours être confirmés avant l'enregistrement.

## Mise à jour sur GitHub
1. Décompresse `JournalPecheV3.zip`.
2. Dans ton dépôt GitHub `Journal-peche`, remplace :
   - index.html
   - app.js
   - manifest.webmanifest
   - sw.js
3. Remplace aussi README.md si désiré.
4. Clique sur `Commit changes`.
5. Attends 1 à 3 minutes.
6. Ouvre l'application sur l'iPhone.
7. Si l'ancienne version apparaît encore, ferme l'app complètement et rouvre-la, ou recharge la page GitHub Pages dans Safari.

## Test IA
1. Ajoute une photo de pêche nette.
2. Appuie sur `Compter et identifier les poissons`.
3. Attends la fin de l'analyse.
4. Vérifie le nombre et l'espèce proposés.
5. Corrige au besoin.
6. Enregistre la prise.
7. Va dans `Endroits` pour voir le dossier créé.
8. Va dans `Moyennes` pour voir les statistiques globales.
