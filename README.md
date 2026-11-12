# Visorando accessible — refonte de cours

Prototype codé de la refonte de visorando.com, construit à partir de l'audit RGAA 4.1.2 partiel du 15 octobre 2026.
Projet de cours, sans lien avec le site officiel.

## Lancer le site

**Le plus simple (macOS)** : double-cliquez sur `Lancer le site.command`.
Le navigateur s'ouvre sur http://localhost:5173. Fermez la fenêtre du Terminal pour arrêter le site.

> Au premier lancement, macOS peut bloquer le fichier. Faites alors clic droit → **Ouvrir** → **Ouvrir**.

**Dans un terminal** :

```bash
cd ~/Sites/visorando-accessible
npm start          # ou : node server.mjs --open
```

Rien à installer : le projet n'a aucune dépendance. Node 18 ou plus suffit (sinon le lanceur utilise Python).
Une connexion internet est nécessaire pour les fonds de carte et les photos.

## Ce que fait le site

| Page | Adresse | Fonctions |
|---|---|---|
| Accueil | `#/` | Hero photo + recherche (suggestions, rayon, « Autour de moi », filtres), derniers itinéraires, envies, carrousel Pilat, chiffres |
| Résultats | `#/recherche?lieu=Lyon` | Hero photo + recherche, mosaïque, texte, carte synchronisée avec « Nos meilleures sélections », tri, filtres retirables, « Afficher plus » |
| Fiche | `#/rando/ly-tony-garnier` | Structure de la maquette Figma (écran 4) : mosaïque photo + visionneuse, carte d'actions à droite (favoris, GPX, départ sur la carte, impression, partage, « Naviguer ») et encadré Sécurité, description et détails du sentier, onglets « Sur cette page », points de passage, carte du tracé, élévation au clavier reliée à la carte, montée et descente, météo en direct (Open-Meteo), infos pratiques, questions fréquentes, randos à proximité |
| Favoris | `#/favoris` | Randonnées enregistrées dans le navigateur |
| Accessibilité | `#/accessibilite` | Les 13 non-conformités de l'audit et leur correction, protocole de test |

Le réglage **« Montrer les corrections RGAA »** (dans le menu et le pied de page) affiche le numéro du critère corrigé sur chaque élément. Il sert pour l'oral.

## Données

- **38 itinéraires officiels** (Pilat, vallée du Rhône, Gier) : [Geotrek Auvergne-Rhône-Alpes Tourisme](https://geotrek.auvergnerhonealpes-tourisme.com/). Tracés, photos, textes et dénivelés viennent de leurs gestionnaires (Parc naturel régional du Pilat, communes).
- **6 balades lyonnaises** (Tony Garnier, Fourvière, Croix-Rousse, Île Barbe, Mont Thou, aqueduc du Gier) : tracés calculés sur OpenStreetMap (OSRM, profil piéton) à partir des points de passage, altitudes IGN RGE ALTI, photos Wikimedia Commons (auteur et licence sur chaque fiche), textes écrits pour la maquette. **Vérifiez ces tracés sur le terrain avant de les suivre.**
- Fonds de carte : Plan IGN et photographies aériennes (Géoplateforme IGN), OpenStreetMap. Bibliothèque Leaflet 1.9.4.
- Photos d'ambiance (accueil, résultats, pied de page) : Wikimedia Commons, auteurs et licences dans `data/photos.json` et dans « Crédits photos » en pied de page.
- Polices : Atkinson Hyperlegible (Braille Institute), Bricolage Grotesque, sous licence OFL.

Le fichier `data/randos.json` contient toutes les données. `data/build_data.py` est le script qui l'a généré.

## Tests effectués

Tests manuels (procédure reproductible) :

1. **Clavier dans le panneau Filtres** (barrière 2 : critères 7.1, 7.3, 12.8). Accueil → `Tab` jusqu'à « Filtres » → `Entrée` → `Tab` une quarantaine de fois → `Échap`. Résultat : le focus arrive sur « Durée maximale », reste dans le panneau, `Échap` ferme et rend le focus à « Filtres ».
2. **Affichage à 320 px** (critère 10.11), sur les 7 pages. Résultat : **échec sur la page Accessibilité**, texte coupé à droite (page de 356 px). Cause : la grille `.doc` s'élargissait à la taille du tableau. Correction : `grid-template-columns: minmax(0, 1fr)` sur `.doc` et `position: relative` sur `.table-wrap`. **Retest le 12/11/2026 : plus de défilement horizontal sur les 7 pages.**
3. **Zoom 200 %** (fenêtre de 640 px) : pas de défilement horizontal sur l'accueil, les résultats, une fiche et la page Accessibilité.
4. **Message de statut** (critère 7.5) : après une recherche « Lyon », la zone `role="status"` contient « 41 randonnées trouvées autour de Lyon… ».

Outil automatique : axe-core 4.10 (WCAG 2.1 A et AA) ne relève aucune violation. Un outil ne détecte qu'une partie des problèmes : ce résultat ne prouve pas la conformité.

**Encore à vérifier** : écoute réelle avec NVDA et VoiceOver, contrastes des textes posés sur photo mesurés à la main (Colour Contrast Analyser), zoom du texte seul à 200 %.

## Usage de l'IA

- Prototype codé avec un agent IA de développement (Claude Code), à partir de la maquette Figma et des barrières de l'audit.
- Propositions de l'agent vérifiées dans le navigateur (clavier, 320 px) avant d'être gardées.
- Relecture assistée par IA le 12/11/2026 : elle a repéré le débordement à 320 px de la page Accessibilité, corrigé puis retesté (test 2 ci-dessus).
- L'IA ne certifie pas l'accessibilité : la refonte n'est déclarée conforme à aucun référentiel.

## Structure

```
index.html             page unique (routeur par #)
assets/css/app.css     styles, thèmes clair et sombre, impression
assets/js/app.js       routeur et vues
assets/js/filters.js   panneau Filtres (dialog)
assets/js/combobox.js  champ de recherche à suggestions
assets/js/map.js       cartes Leaflet accessibles
assets/js/profile.js   profil altimétrique + tableau
assets/js/gallery.js   galerie et visionneuse
assets/js/store.js     favoris (localStorage)
data/randos.json       44 randonnées
vendor/leaflet/        Leaflet 1.9.4
server.mjs             serveur local sans dépendance
```
