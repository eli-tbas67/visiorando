# Visorando accessible — refonte de cours

**Site en ligne : https://visiorando.vercel.app/** (fiche d'exemple : https://visiorando.vercel.app/#/rando/ly-tony-garnier)

Prototype codé de la refonte de visorando.com, construit à partir de l'audit RGAA 4.1.2 partiel du 15 octobre 2026.

L'audit a été réalisé sur la fiche visorando.com [« À flanc de colline entre Sainte-Foy-lès-Lyon et Oullins »](https://www.visorando.com/randonnee-a-flanc-de-colline-entre-sainte-foy-les-/). Les défauts relevés viennent du modèle de fiche commun à toutes les randonnées : dans la refonte, leurs corrections sont démontrées sur la fiche « Murs peints de Lyon : Tony Garnier » (`#/rando/ly-tony-garnier`), qui utilise ce même modèle.

Projet de cours, sans lien avec le site officiel.

## Lancer le site en local (facultatif)

Le site en ligne suffit pour le consulter. Cette partie sert seulement à le faire tourner sur un ordinateur, par exemple après avoir téléchargé le dépôt.

**Le plus simple (macOS)** : double-cliquez sur `Lancer le site.command`.
Le navigateur s'ouvre sur http://localhost:5173. Fermez la fenêtre du Terminal pour arrêter le site.

> Au premier lancement, macOS peut bloquer le fichier. Faites alors clic droit → **Ouvrir** → **Ouvrir**.

**Dans un terminal**, depuis le dossier du projet :

```bash
cd visiorando        # le dossier du dépôt cloné ou téléchargé
npm start          # ou : node server.mjs --open
```

Rien à installer : le projet n'a aucune dépendance. Node 18 ou plus suffit (sinon le lanceur utilise Python).
Une connexion internet est nécessaire pour les fonds de carte et les photos.

## Ce que fait le site

| Page | Adresse | Fonctions |
|---|---|---|
| Accueil | `#/` | Hero photo + recherche (suggestions, rayon, « Autour de moi », filtres), derniers itinéraires, envies, carrousel Pilat, chiffres |
| Résultats | `#/recherche?lieu=Lyon` | Hero photo + recherche, mosaïque, texte, carte synchronisée avec « Nos meilleures sélections », tri, filtres retirables, « Afficher plus » |
| Fiche | `#/rando/ly-tony-garnier` | Maquette Figma (écran 4) : fil d'Ariane, mosaïque de 3 photos + visionneuse, titre et chiffres clés, description, « Planifier votre visite » et détails du sentier ; bloc d'actions fixe à droite (9 actions, « Naviguer », « Envoyer vers mobile ») ; onglets « Sur cette page » ; frise numérotée des points de passage (photos Wikimedia prises à proximité) terminée par la carte du tracé (agrandir, zoom, recentrer) ; type de voies et surfaces ; élévation avec bandes de pente, menu Élévation / Pente, curseur clavier relié à la carte et tableau ; montée et descente ; météo du jour (Open-Meteo) ; encadré Sécurité ; commentaires |
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

`data/voies.json` (types de voies et surfaces de chaque fiche) est calculé par `data/build_voies.py` à partir des voies OpenStreetMap (API Overpass) que suit le tracé. Une portion est « Inconnu » quand OpenStreetMap ne renseigne pas la voie ou sa surface.

`data/points-photos.json` (photos des points de passage) est rempli par `data/build_points_photos.py` : photos Wikimedia Commons prises à moins de 150 m de chaque point, au plus 3 par point, auteur et licence affichés sous les photos. Un point sans photo proche reste sans photo.

Sur la fiche, « Éditer l'itinéraire », « Déplacer le point de départ » et les deux « Signaler » demandent un compte Visorando : dans la maquette, ils affichent seulement un message de statut qui le dit.

## Tests effectués

Tests manuels (procédure reproductible) :

1. **Clavier dans le panneau Filtres** (barrière 2 : critères 7.1, 7.3, 12.8). Accueil → `Tab` jusqu'à « Filtres » → `Entrée` → `Tab` une quarantaine de fois → `Échap`. Résultat : le focus arrive sur « Durée maximale », reste dans le panneau, `Échap` ferme et rend le focus à « Filtres ».
2. **Affichage à 320 px** (critère 10.11), sur les 7 pages. Résultat : **échec sur la page Accessibilité**, texte coupé à droite (page de 356 px). Cause : la grille `.doc` s'élargissait à la taille du tableau. Correction : `grid-template-columns: minmax(0, 1fr)` sur `.doc` et `position: relative` sur `.table-wrap`. **Retest le 12/11/2026 : plus de défilement horizontal sur les 7 pages.**
3. **Zoom 200 %** (fenêtre de 640 px) : pas de défilement horizontal sur l'accueil, les résultats, une fiche et la page Accessibilité.
4. **Message de statut** (critère 7.5) : après une recherche « Lyon », la zone `role="status"` contient « 41 randonnées trouvées autour de Lyon… ».
5. **Lecteur d'écran** : VoiceOver avec Chrome (macOS), le 12/11/2026, sur la fiche Tony Garnier. Phrases relevées dans le panneau de VoiceOver :
   - à l'ouverture, le titre de la page est lu (« Trouver une randonnée · Visorando (refonte) », critère 8.6) ;
   - photo d'un point de passage : « Agrandir la photo 1 sur 3 du point 2 : Lyon (France/Rhône) - Musée Tony Garnier, accès, bouton » (1.2, 6.2) ;
   - marqueur de la carte : « Point 1, Départ : Arrêt Jet d'Eau – Mendès France, bouton, Carte du parcours Murs peints de Lyon : Tony Garnier » ; la carte est annoncée comme « carte » (6.2) ;
   - « Enregistrer » et « Agrandir la carte » sont annoncés comme boutons de basculement (état activé / non activé) ;
   - curseur du profil : « 0,7 kilomètres, altitude 174 mètres, pente 1 % » à chaque flèche.
   Défaut trouvé et corrigé : le contour de focus des onglets « Sur cette page » était rogné par la liste qui défile ; il est maintenant dessiné à l'intérieur du lien. Reste à faire : NVDA sous Windows.

Outil automatique : axe-core 4.10 (WCAG 2.1 A et AA) ne relève aucune violation. Un outil ne détecte qu'une partie des problèmes : ce résultat ne prouve pas la conformité.

**Encore à vérifier** : écoute avec NVDA (VoiceOver testé, voir test 5), contrastes des textes posés sur photo mesurés à la main (Colour Contrast Analyser), zoom du texte seul à 200 %.

## Usage de l'IA

- Prototype codé avec un agent IA de développement (Claude Code), à partir de la maquette Figma et des barrières de l'audit.
- Propositions de l'agent vérifiées dans le navigateur (clavier, 320 px) avant d'être gardées.
- Relecture assistée par IA le 12/11/2026 : elle a repéré le débordement à 320 px de la page Accessibilité, corrigé puis retesté (test 2 ci-dessus).
- Mise en conformité de la fiche avec la maquette Figma (écran 4) assistée par IA le 12/11/2026, vérifiée avec axe-core (0 violation sur 7 pages), au clavier et à 320 px. Les photos des points de passage sont choisies automatiquement sur Wikimedia Commons (à moins de 150 m du point) puis filtrées.
- L'IA ne certifie pas l'accessibilité : la refonte n'est déclarée conforme à aucun référentiel.

## Structure

```
index.html             page unique (routeur par #)
assets/css/app.css     styles (thème clair), impression
assets/js/app.js       routeur et vues
assets/js/filters.js   panneau Filtres (dialog)
assets/js/combobox.js  champ de recherche à suggestions
assets/js/map.js       cartes Leaflet accessibles
assets/js/profile.js   profil altimétrique + tableau
assets/js/gallery.js   galerie et visionneuse
assets/js/store.js     favoris (localStorage)
data/randos.json       44 randonnées
data/voies.json        types de voies et surfaces (OpenStreetMap)
data/points-photos.json photos des points de passage (Wikimedia Commons)
vendor/leaflet/        Leaflet 1.9.4
server.mjs             serveur local sans dépendance
```
