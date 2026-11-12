// Cartes Leaflet : fonds IGN / OpenStreetMap, marqueurs utilisables au clavier.
/* global L */
import { esc, fr1, dur, LEVELS } from "./utils.js";

const IGN = (layer, format, maxNativeZoom) => L.tileLayer(
  "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  `&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&FORMAT=${format}` +
  "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
  { maxZoom: 19, maxNativeZoom, attribution: '<a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a> – Géoplateforme' }
);

function baseLayers() {
  return {
    "Plan IGN": IGN("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png", 18),
    "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a>',
    }),
    "Photos aériennes": IGN("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg", 19),
  };
}

export function hasLeaflet() { return typeof window.L !== "undefined"; }

/**
 * Crée une carte accessible.
 * @param {HTMLElement} el
 * @param {{label: string, center?: [number, number], zoom?: number}} o
 */
export function createMap(el, o) {
  if (!hasLeaflet()) {
    el.innerHTML = '<p style="padding:16px">La carte n\'a pas pu se charger. Toutes les informations restent disponibles dans la liste.</p>';
    return null;
  }
  const map = L.map(el, {
    center: o.center || [45.6, 4.75], zoom: o.zoom || 9,
    scrollWheelZoom: false, keyboard: true, zoomControl: false, attributionControl: true,
  });
  // Boutons de zoom nommés en français dès leur création (RGAA 6.2) : Leaflet en fait aussi l'aria-label.
  map.zoomControl = L.control.zoom({ position: o.zoomPosition || "topleft", zoomInTitle: "Zoomer", zoomOutTitle: "Dézoomer" }).addTo(map);
  const layers = baseLayers();
  layers["Plan IGN"].addTo(map);
  // Repli automatique sur OpenStreetMap si le serveur IGN ne répond pas.
  let tileErrors = 0;
  layers["Plan IGN"].on("tileerror", () => {
    tileErrors++;
    if (tileErrors === 6 && map.hasLayer(layers["Plan IGN"])) {
      map.removeLayer(layers["Plan IGN"]);
      layers["OpenStreetMap"].addTo(map);
    }
  });
  L.control.layers(layers, null, { position: o.layersPosition || "topright", collapsed: true }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

  // Le conteneur est focalisable : on lui donne un nom et un rôle (RGAA 7.1).
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", o.label);
  el.setAttribute("aria-roledescription", "carte");
  // Les boutons de zoom ont déjà un title ; on traduit leurs noms.
  const zin = el.querySelector(".leaflet-control-zoom-in");
  const zout = el.querySelector(".leaflet-control-zoom-out");
  if (zin) { zin.setAttribute("aria-label", "Zoomer"); zin.title = "Zoomer"; }
  if (zout) { zout.setAttribute("aria-label", "Dézoomer"); zout.title = "Dézoomer"; }
  const lt = el.querySelector(".leaflet-control-layers-toggle");
  if (lt) { lt.setAttribute("aria-label", "Changer le fond de carte"); lt.title = "Changer le fond de carte"; lt.setAttribute("role", "button"); }
  const ll = el.querySelector(".leaflet-control-layers-list");
  if (ll) ll.setAttribute("aria-label", "Fonds de carte");

  // Molette active seulement après un clic dans la carte (évite de piéger le défilement).
  map.on("focus click", () => map.scrollWheelZoom.enable());
  map.on("blur mouseout", () => map.scrollWheelZoom.disable());
  return map;
}

export function numberIcon(n) {
  return L.divIcon({ className: "", html: `<div class="mk"><span>${n}</span></div>`, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
}
export const startIcon = () => L.divIcon({ className: "", html: '<div class="mk-start"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
export const stepIcon = (n) => L.divIcon({ className: "", html: `<div class="mk-step">${n}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
export const posIcon = () => L.divIcon({ className: "", html: '<div class="mk-pos"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

/** Marqueur numéroté d'un résultat : focalisable, nommé, Entrée ouvre la bulle. */
export function resultMarker(map, r, n, distanceText) {
  const m = L.marker(r.start, { icon: numberIcon(n), keyboard: true, title: `${n}. ${r.name}`, riseOnHover: true }).addTo(map);
  m.bindPopup(
    `<p><strong>${n}. ${esc(r.name)}</strong></p>` +
    `<p class="pp-meta">${esc(r.commune)}${distanceText ? " · " + esc(distanceText) : ""}<br>${dur(r.durationMin)} · ${fr1(r.km)} km · ${LEVELS[r.level]}</p>` +
    `<p><a href="#/rando/${encodeURIComponent(r.id)}">Voir la fiche</a></p>`,
    { autoPanPadding: [24, 24] }
  );
  const el = m.getElement();
  if (el) el.setAttribute("aria-label", `${n}. ${r.name}, ${r.commune}. Entrée pour afficher le résumé.`);
  m.on("popupopen", (e) => {
    const a = e.popup.getElement()?.querySelector("a[href^='#/rando']");
    if (a) setTimeout(() => a.focus(), 0);
  });
  m.on("popupclose", () => {
    const icon = m.getElement();
    const map0 = m._map;
    // si le focus était dans la bulle, on le rend au marqueur
    setTimeout(() => {
      if (icon && map0 && (document.activeElement === document.body || map0.getContainer().contains(document.activeElement))) icon.focus();
    }, 0);
  });
  return m;
}
