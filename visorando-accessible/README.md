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
| Fiche | `#/rando/ly-tony-garnier` | Mosaïque photo + visionneuse, actions (GPX, favoris, lien, impression, itinéraire), étapes en frise, carte du tracé, dénivelé au clavier relié à la carte, montées/descentes, météo en direct (Open-Meteo), infos pratiques, questions fréquentes, randos à proximité |
| Favoris | `#/favoris` | Randonnées enregistrées dans le navigateur |
| Accessibilité | `#/accessibilite` | Les 12 non-conformités de l'audit et leur correction, protocole de test |

Le réglage **« Montrer les corrections RGAA »** (dans le menu et le pied de page) affiche le numéro du critère corrigé sur chaque élément. Il sert pour l'oral.

## Données

- **38 itinéraires officiels** (Pilat, vallée du Rhône, Gier) : [Geotrek Auvergne-Rhône-Alpes Tourisme](https://geotrek.auvergnerhonealpes-tourisme.com/). Tracés, photos, textes et dénivelés viennent de leurs gestionnaires (Parc naturel régional du Pilat, communes).
- **6 balades lyonnaises** (Tony Garnier, Fourvière, Croix-Rousse, Île Barbe, Mont Thou, aqueduc du Gier) : tracés calculés sur OpenStreetMap (OSRM, profil piéton) à partir des points de passage, altitudes IGN RGE ALTI, photos Wikimedia Commons (auteur et licence sur chaque fiche), textes écrits pour la maquette. **Vérifiez ces tracés sur le terrain avant de les suivre.**
- Fonds de carte : Plan IGN et photographies aériennes (Géoplateforme IGN), OpenStreetMap. Bibliothèque Leaflet 1.9.4.
- Photos d'ambiance (accueil, résultats, pied de page) : Wikimedia Commons, auteurs et licences dans `data/photos.json` et dans « Crédits photos » en pied de page.
- Polices : Atkinson Hyperlegible (Braille Institute), Bricolage Grotesque, sous licence OFL.

Le fichier `data/randos.json` contient toutes les données. `data/build_data.py` est le script qui l'a généré.

## Tests effectués

- axe-core 4.10 (WCAG 2.1 A et AA, bonnes pratiques) : 0 violation sur les 8 pages, en clair et en sombre, à 1280 px et à 320 px.
- Clavier : lien d'évitement en premier, suggestions au clavier, focus piégé dans les filtres et la visionneuse, Échap ferme et rend le focus, profil parcouru avec les flèches.
- Pas de défilement horizontal à 320 px.

**Encore à faire** : écoute réelle avec NVDA et VoiceOver, et contrastes vérifiés à la main avec Colour Contrast Analyser.

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
