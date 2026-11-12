# Visorando accessible

Site en ligne : https://visiorando.vercel.app/
Fiche d'exemple : https://visiorando.vercel.app/#/rando/ly-tony-garnier

C'est notre refonte de visorando.com pour le module Accessibilité numérique (B3). On est partis de notre audit RGAA du 15 octobre 2026, puis on a corrigé les problèmes trouvés dans une maquette Figma et dans ce prototype codé.

On a audité la fiche « À flanc de colline entre Sainte-Foy-lès-Lyon et Oullins » sur visorando.com : https://www.visorando.com/randonnee-a-flanc-de-colline-entre-sainte-foy-les-/

Toutes les fiches de Visorando utilisent le même modèle de page, donc les problèmes relevés se retrouvent partout. Dans notre prototype, on montre les corrections sur la fiche « Murs peints de Lyon : Tony Garnier ».

C'est un projet de cours, il n'a aucun lien avec le vrai site.

## Le parcours qu'on a choisi

Trouver une randonnée autour de Lyon, l'affiner avec les filtres, puis ouvrir sa fiche. On a gardé quatre problèmes prioritaires :

1. Le champ de recherche n'a pas de vraie étiquette : la consigne est seulement dans le texte gris du champ, qui disparaît quand on tape.
2. Le panneau « Filtres » ne marche pas au clavier : le focus part derrière le panneau et Échap ne le ferme pas.
3. Il manque des titres et des repères : la recherche n'est pas un titre, la page des résultats n'a pas de h1 et le nombre de résultats n'est pas annoncé.
4. L'avertissement de sécurité de la fiche est trop pâle (3,23:1, il faut au moins 4,5:1).

Le détail de chaque problème, avec les preuves, est dans notre grille d'audit (Google Sheets) et sur la page Accessibilité du site.

## Ce qu'on trouve sur le site

| Page | Adresse | Contenu |
|---|---|---|
| Accueil | `#/` | Recherche avec suggestions, rayon, « Autour de moi » et filtres, derniers itinéraires, carrousel du Pilat |
| Résultats | `#/recherche?lieu=Lyon` | Liste des randonnées et carte synchronisées, tri, filtres qu'on peut retirer un par un |
| Fiche | `#/rando/ly-tony-garnier` | Fiche refaite d'après l'écran 4 de la maquette : photos, actions à droite, points de passage avec carte, types de voies, profil d'altitude, météo, encadré Sécurité |
| Favoris | `#/favoris` | Les randonnées enregistrées dans le navigateur |
| Accessibilité | `#/accessibilite` | Les 13 non-conformités de l'audit, ce qu'on a corrigé, nos tests et nos limites |

Dans le menu et le pied de page, le réglage « Montrer les corrections RGAA » affiche le numéro du critère corrigé sur chaque élément. On s'en sert pour présenter le projet.

## Nos tests

On a testé à la main, avec une procédure qu'on peut refaire :

1. **Clavier dans le panneau Filtres** (critères 7.1, 7.3, 12.8). Sur l'accueil, Tab jusqu'à « Filtres », Entrée, puis Tab plusieurs fois et Échap. Résultat : le focus arrive sur « Durée maximale », il reste dans le panneau, et Échap ferme le panneau en revenant sur « Filtres ».
2. **Affichage à 320 px de large** (critère 10.11), sur les 7 pages. Premier essai raté : sur la page Accessibilité, le texte était coupé à droite parce que la grille de la page s'élargissait à la taille du tableau. On a limité la colonne à la largeur de l'écran. Retest le 12/11/2026 : plus de défilement horizontal.
3. **Zoom à 200 %** : rien n'est coupé sur l'accueil, les résultats, une fiche et la page Accessibilité.
4. **Message après une recherche** (critère 7.5) : en cherchant « Lyon », la zone de statut contient « 41 randonnées trouvées autour de Lyon… ».
5. **VoiceOver avec Chrome (macOS)**, le 12/11/2026. Au démarrage sur l'accueil, VoiceOver lit le titre de la page. Ensuite, sur la fiche :
   - une photo est annoncée « Agrandir la photo 1 sur 3 du point 2 : Lyon (France/Rhône) - Musée Tony Garnier, accès, bouton » ;
   - un point sur la carte est annoncé « Point 1, Départ : Arrêt Jet d'Eau – Mendès France, bouton » ;
   - « Enregistrer » et « Agrandir la carte » sont annoncés comme boutons de basculement ;
   - le curseur du profil dit « 0,7 kilomètres, altitude 174 mètres, pente 1 % » à chaque flèche.

   Pendant ce test, on a vu que le contour de focus des onglets « Sur cette page » était coupé. On l'a corrigé (il est maintenant dessiné à l'intérieur de l'onglet) et on a retesté.

On a aussi passé l'outil automatique axe-core : il ne trouve aucune erreur. Mais un outil ne voit qu'une partie des problèmes, donc ça ne prouve pas que le site est conforme.

**Ce qu'on n'a pas encore vérifié** : l'écoute avec NVDA sous Windows (on n'avait pas de PC), les contrastes des textes posés sur les photos, et le zoom du texte seul à 200 %.

## Usage de l'IA

- Le prototype a été codé avec un agent IA de développement (Claude Code), à partir de notre maquette Figma et des problèmes de notre audit.
- On a ouvert et testé chaque proposition dans le navigateur (au clavier, à 320 px) avant de la garder, et on a repris l'agent quand il se trompait.
- Une relecture avec l'IA le 12/11/2026 a repéré le débordement à 320 px de la page Accessibilité. On l'a corrigé puis retesté (test 2).
- Le même jour, l'IA nous a aidés à rapprocher la fiche de la maquette Figma (écran 4). Les photos des points de passage sont choisies automatiquement sur Wikimedia Commons, à moins de 150 m de chaque point, puis triées.
- Ce README a été rédigé avec l'aide de l'IA, puis relu par nous.
- L'IA ne certifie pas l'accessibilité : notre refonte n'est déclarée conforme à aucun référentiel.

## Données utilisées

- **38 itinéraires officiels** (Pilat, vallée du Rhône, Gier), venant de [Geotrek Auvergne-Rhône-Alpes Tourisme](https://geotrek.auvergnerhonealpes-tourisme.com/) : tracés, photos et textes de leurs gestionnaires.
- **6 balades lyonnaises** (Tony Garnier, Fourvière, Croix-Rousse, Île Barbe, Mont Thou, aqueduc du Gier) : tracés calculés sur OpenStreetMap, altitudes IGN, photos Wikimedia Commons et textes écrits pour la maquette. À vérifier sur le terrain avant de les suivre.
- **Types de voies et surfaces** : calculés à partir des chemins OpenStreetMap que suit le tracé (`data/build_voies.py`). « Inconnu » veut dire qu'OpenStreetMap ne renseigne pas l'information.
- **Photos des points de passage** : Wikimedia Commons (`data/build_points_photos.py`), avec l'auteur et la licence sous chaque photo.
- **Cartes** : Plan IGN, photos aériennes IGN et OpenStreetMap, avec Leaflet 1.9.4. **Météo** : Open-Meteo.
- **Polices** : Atkinson Hyperlegible (Braille Institute) et Bricolage Grotesque, sous licence OFL.

Sur la fiche, « Éditer l'itinéraire », « Déplacer le point de départ » et les deux « Signaler » demandent un compte Visorando. Dans la maquette, ils affichent juste un message qui l'explique.

## Lancer le site sur son ordinateur (facultatif)

Le site en ligne suffit. Pour le lancer en local, après avoir téléchargé le dépôt, ouvrir un terminal dans le dossier du projet et taper `npm start` (ou `node server.mjs --open`).

Le site s'ouvre sur http://localhost:5173. Il n'y a rien à installer : Node 18 suffit. Il faut une connexion internet pour les cartes et les photos.

## Organisation des fichiers

```
index.html               page unique (navigation par #)
assets/css/app.css       styles
assets/js/app.js         pages du site
assets/js/filters.js     panneau Filtres
assets/js/combobox.js    champ de recherche avec suggestions
assets/js/map.js         cartes
assets/js/profile.js     profil d'altitude et tableau
assets/js/gallery.js     photos et visionneuse
assets/js/store.js       favoris
data/randos.json         les 44 randonnées
data/voies.json          types de voies et surfaces
data/points-photos.json  photos des points de passage
server.mjs               petit serveur local
```
