// Visorando accessible — application (routeur par hash + vues), design d'après la maquette d'Eliott.
/* global L */
import { $, $$, esc, norm, fr1, fr0, dur, levelHTML, levelPill, LEVELS, TAGS, randos, km, announce, placeholderSVG, installImageFallback, trapFocus, cleanAuthor, ICONS } from "./utils.js";
import * as store from "./store.js";
import { createMap, resultMarker, startIcon, stepIcon, posIcon, hasLeaflet } from "./map.js";
import { combobox, makeSource } from "./combobox.js";
import { DEFAULTS, clone, fromParams, toParams, matches, active, removeOne, summary, openFilters } from "./filters.js";
import { renderProfile, cumulative } from "./profile.js";
import { galleryHTML, wireGallery, credit } from "./gallery.js";
import { climbsHTML, wireTabs, loadWeather, faq } from "./extras.js";

const SITE = "Visorando (refonte)";
const PAGE = 12;
const LYON = { name: "Lyon", lat: 45.7578, lon: 4.832 };
let DATA = null;
let BYID = new Map();
let PHOTOS = {};
let maps = [];
let homeFilters = clone(DEFAULTS);
let pendingFocus = null;
const main = document.getElementById("contenu");

installImageFallback();

/* =================== Données =================== */
async function load() {
  const [res, ph] = await Promise.all([fetch("data/randos.json"), fetch("data/photos.json").catch(() => null)]);
  if (!res.ok) throw new Error("HTTP " + res.status);
  DATA = await res.json();
  BYID = new Map(DATA.randos.map((r) => [r.id, r]));
  try { PHOTOS = ph && ph.ok ? await ph.json() : {}; } catch { PHOTOS = {}; }
}
const PLACE = (name) => DATA.places.find((p) => norm(p.name) === norm(name));

/** Image d'ambiance locale (srcset) */
function img(name, { sizes = "100vw", cls = "", alt = "", big = 2000, small = 1200, eager = false } = {}) {
  const has2000 = ["hero-accueil", "hero-resultats", "footer"].includes(name);
  const lo = has2000 ? 1200 : 800, hi = has2000 ? big : small;
  return `<img class="${cls}" src="assets/img/${name}-${lo}.jpg" srcset="assets/img/${name}-${lo}.jpg ${lo}w, assets/img/${name}-${hi}.jpg ${hi}w" sizes="${sizes}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
}
function photoCredit(name) {
  const p = PHOTOS[name];
  if (!p) return "";
  return `Photo : ${esc(cleanAuthor(p.author))}, <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.license)}<span class="vh"> (Wikimedia Commons, nouvelle fenêtre)</span></a>`;
}

/* =================== Routeur =================== */
function parse() {
  const h = location.hash || "#/";
  const [path, qs] = h.slice(1).split("?");
  return { path: path || "/", params: new URLSearchParams(qs || "") };
}
function go(hash, { replace = false, keepFocusId = null } = {}) {
  pendingFocus = keepFocusId;
  if (replace) { history.replaceState(null, "", hash); render(false); }
  else if (location.hash === hash) render(false);
  else location.hash = hash;
}
window.addEventListener("hashchange", () => {
  if (!location.hash.startsWith("#/") && location.hash !== "") return;
  render(false);
});

function render(initial) {
  maps.forEach((m) => m.remove());
  maps = [];
  const { path, params } = parse();
  let view;
  if (path === "/" || path === "") view = viewHome();
  else if (path === "/recherche") view = viewResults(params);
  else if (path.startsWith("/rando/")) view = viewFiche(decodeURIComponent(path.slice(7)));
  else if (path === "/favoris") view = viewFavs();
  else if (path === "/accessibilite") view = viewA11y();
  else view = view404();

  main.innerHTML = view.html;
  main.firstElementChild?.classList.add("view-enter");
  document.title = `${view.title} · ${SITE}`;
  $$("#menu-panel a").forEach((a) => {
    if (a.dataset.nav === view.nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  closeMenu(false);
  view.wire?.();
  if (pendingFocus && document.getElementById(pendingFocus)) {
    document.getElementById(pendingFocus).focus();
  } else if (!initial) {
    window.scrollTo({ top: 0, behavior: "instant" });
    $("h1", main)?.focus({ preventScroll: true });
  }
  pendingFocus = null;
  if (view.announce) announce(view.announce);
}

/* =================== Composants =================== */
function cardHTML(r, o = {}) {
  const h = o.h || "h3";
  const ph = r.photos[0];
  const where = [r.commune === r.dept.name ? r.commune : `${r.commune}, ${r.dept.name}`, o.distText].filter(Boolean).join(" • ");
  return `<li class="card" data-id="${esc(r.id)}">
    <div class="card-media">
      ${ph ? `<img src="${esc(ph.thumb)}" alt="" loading="lazy" data-fallback="${esc(r.id)}">` : placeholderSVG(r.id)}
      ${o.n ? `<span class="card-num" aria-hidden="true">${o.n}</span>` : ""}
    </div>
    <div class="card-body">
      <${h}><a class="card-link" id="lk-${esc(r.id)}" href="#/rando/${encodeURIComponent(r.id)}">${o.n ? `<span class="vh">${o.n}. </span>` : ""}${esc(r.name)}</a></${h}>
      <p class="card-place">${esc(where)}</p>
      <dl class="facts">
        <div><dt>Durée</dt><dd>${dur(r.durationMin)}</dd></div>
        <div><dt>Distance</dt><dd>${fr1(r.km)} km</dd></div>
        <div><dt>Dénivelé</dt><dd>${fr0(r.ascent)} m</dd></div>
        <div><dt>Niveau</dt><dd>${levelHTML(r.level)}</dd></div>
      </dl>
    </div>
    ${o.fav === false ? "" : `<button type="button" class="fav" data-fav="${esc(r.id)}" aria-pressed="${store.isFav(r.id)}" aria-label="Favori : ${esc(r.name)}">${ICONS.star}</button>`}
  </li>`;
}
function wireFavs(root, onToggle) {
  root.querySelectorAll("[data-fav]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.fav;
    const now = store.toggleFav(id);
    root.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((x) => x.setAttribute("aria-pressed", String(now)));
    announce(now ? `« ${BYID.get(id).name} » ajoutée à vos favoris.` : `« ${BYID.get(id).name} » retirée de vos favoris.`);
    onToggle?.(id, now, b);
  }));
}
function updateFavCount() {
  const n = store.favorites().length;
  $("#fav-count").textContent = n;
  $("#fav-count-sr").textContent = `, ${n} ${n > 1 ? "randonnées enregistrées" : "randonnée enregistrée"}`;
}
store.onChange(updateFavCount);

function nearHTML(r, d) {
  const ph = r.photos[0];
  return `<li><div class="near">
    <div class="near-media">${ph ? `<img src="${esc(ph.thumb)}" alt="" loading="lazy" data-fallback="${esc(r.id)}">` : placeholderSVG(r.id)}${levelPill(r.level)}</div>
    <a href="#/rando/${encodeURIComponent(r.id)}">${esc(r.name)}</a>
    <p class="meta">${dur(r.durationMin)} · ${fr1(r.km)} km · ${fr0(r.ascent)} m D+${d != null ? ` · à ${fr0(d)} km` : ""}</p>
  </div></li>`;
}
function carousel(id, title, items, intro = "") {
  return `<section class="section section-tight" aria-labelledby="${id}-t">
    <div class="carousel-head">
      <div><h2 id="${id}-t">${title}</h2>${intro ? `<p class="muted" style="margin-top:6px;max-width:60ch">${intro}</p>` : ""}</div>
      <div class="carousel-btns">
        <button type="button" class="round-btn" data-car-prev="${id}" aria-label="Défiler vers la gauche : ${esc(title)}">${ICONS.prev}</button>
        <button type="button" class="round-btn" data-car-next="${id}" aria-label="Défiler vers la droite : ${esc(title)}">${ICONS.next}</button>
      </div>
    </div>
    <ul class="track" id="${id}" aria-label="${esc(title)}">${items}</ul>
  </section>`;
}
function wireCarousels(root) {
  root.querySelectorAll(".track").forEach((t) => {
    const prev = t.id && root.querySelector(`[data-car-prev="${t.id}"]`), next = t.id && root.querySelector(`[data-car-next="${t.id}"]`);
    if (!prev || !next) return;
    const upd = () => { prev.disabled = t.scrollLeft < 4; next.disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 4; };
    const step = (dir) => t.scrollBy({ left: dir * t.clientWidth * 0.85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    t.addEventListener("scroll", upd, { passive: true });
    // un lien focalisé hors champ fait défiler la piste
    t.addEventListener("focusin", (e) => e.target.closest("li")?.scrollIntoView({ block: "nearest", inline: "nearest" }));
    setTimeout(upd, 50);
  });
}

/* =================== Recherche =================== */
function searchFormHTML({ q = "Lyon", rayon = "50", variant = "home", filters }) {
  const radii = [["10", "10 km"], ["25", "25 km"], ["50", "50 km"], ["100", "100 km"]];
  const a = active(filters).length;
  return `
  <form class="search" id="search-form" role="search" aria-label="Rechercher une randonnée" novalidate>
    <label for="loc">${variant === "home" ? "Où voulez-vous randonner ?" : "Lieu de la recherche"} <span class="fix" aria-hidden="true">11.1</span></label>
    ${variant === "home" ? `<p class="hint" id="loc-hint">Ville, massif ou n° de randonnée. Exemple : Lyon</p>` : ""}
    <div class="search-row">
      <div class="combo">
        <input id="loc" name="lieu" type="text" value="${esc(q)}" aria-describedby="${variant === "home" ? "loc-hint " : ""}loc-msg" enterkeyhint="search" spellcheck="false">
        <ul id="loc-list" class="listbox" aria-label="Suggestions"></ul>
      </div>
      <button type="submit" class="btn btn-white">${ICONS.search} Rechercher</button>
    </div>
    <div class="search-row">
      <span class="inline-field"><label for="rayon">Dans un rayon de</label>
        <select id="rayon" name="rayon" class="pill-select">${radii.map(([v, t]) => `<option value="${v}" ${v === rayon ? "selected" : ""}>${t}</option>`).join("")}</select></span>
      <button type="button" class="btn btn-ghost btn-sm" id="locate">${ICONS.locate} Autour de moi</button>
      <button type="button" class="btn btn-ghost btn-sm" id="open-filters" aria-haspopup="dialog">${ICONS.filter} <span>${a ? `Filtres (${a})` : "Filtres"}</span></button>
      <p class="filter-note" id="filter-summary">${esc(summary(filters))}</p>
      <span class="fix" aria-hidden="true">7.1 · 7.3 · 12.8</span>
    </div>
    <p id="loc-msg" class="form-msg" hidden></p>
  </form>`;
}

async function resolvePlace(q) {
  const t = q.trim();
  if (!t) return { error: "Indiquez un lieu, par exemple Lyon." };
  const ref = t.replace(/^n\s*°?\s*/i, "");
  const byRef = DATA.randos.find((r) => r.ref === ref);
  if (byRef) return { rando: byRef };
  const byName = DATA.randos.find((r) => norm(r.name) === norm(t));
  if (byName) return { rando: byName };
  const p = PLACE(t) || DATA.places.find((x) => norm(x.name).startsWith(norm(t)));
  if (p) return { place: p };
  try {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=fr&accept-language=fr&q=${encodeURIComponent(t)}`, { signal: ctrl.signal });
    clearTimeout(tm);
    const j = await res.json();
    if (j[0]) return { place: { name: j[0].name || t, lat: +j[0].lat, lon: +j[0].lon } };
  } catch { /* hors ligne */ }
  return { error: `Nous ne trouvons pas « ${t} ». Essayez une ville proche, par exemple Lyon, Saint-Étienne ou Pélussin.` };
}

function resultsHash(place, rayon, f, extra = {}) {
  const p = new URLSearchParams();
  p.set("lieu", place.name);
  if (place.lat != null) { p.set("lat", (+place.lat).toFixed(5)); p.set("lon", (+place.lon).toFixed(5)); }
  p.set("rayon", rayon);
  toParams(f, p);
  Object.entries(extra).forEach(([k, v]) => p.set(k, v));
  return "#/recherche?" + p.toString();
}

/**
 * @param {() => object} getFilters
 * @param {(f) => void} onFilters appelé après « Appliquer » dans le panneau
 * @param {(f) => number} count nombre de résultats pour des filtres donnés
 */
function wireSearch(getFilters, onFilters, count) {
  const form = $("#search-form");
  const input = $("#loc");
  const msg = $("#loc-msg");
  const showError = (t) => {
    msg.textContent = t; msg.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.focus();
    announce(t);
  };
  input.addEventListener("input", () => { msg.hidden = true; input.removeAttribute("aria-invalid"); });
  combobox(input, $("#loc-list"), makeSource(DATA.places, DATA.randos), (o) => {
    if (o.type === "rando") go(`#/rando/${encodeURIComponent(o.value.id)}`);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await resolvePlace(input.value);
    if (r.error) return showError(r.error);
    if (r.rando) return go(`#/rando/${encodeURIComponent(r.rando.id)}`);
    go(resultsHash(r.place, $("#rayon").value, getFilters()));
  });
  $("#locate").addEventListener("click", () => {
    if (!("geolocation" in navigator)) return showError("Votre navigateur ne permet pas la géolocalisation. Saisissez un lieu.");
    announce("Recherche de votre position…");
    navigator.geolocation.getCurrentPosition(
      (pos) => go(resultsHash({ name: "votre position", lat: pos.coords.latitude, lon: pos.coords.longitude }, $("#rayon").value, getFilters())),
      () => showError("Position indisponible. Autorisez la localisation dans votre navigateur ou saisissez un lieu."),
      { timeout: 10000, maximumAge: 300000 }
    );
  });
  const fb = $("#open-filters");
  fb.addEventListener("click", () => openFilters({ filters: getFilters(), opener: fb, count, onApply: onFilters }));
}

/* =================== Vue : accueil =================== */
function viewHome() {
  const latest = DATA.randos
    .filter((r) => km([LYON.lat, LYON.lon], r.start) <= 60 && r.photos.length)
    .sort((a, b) => (b.source.updated || "").localeCompare(a.source.updated || "") || a.name.localeCompare(b.name, "fr"))
    .slice(0, 6);
  const pilat = ["gt-8910", "gt-8807", "gt-8795", "gt-8821", "gt-8869", "gt-8931", "gt-8794", "gt-8916"].map((id) => BYID.get(id)).filter(Boolean);
  const themes = [
    ["famille", ICONS.family, "Courtes, faciles, sans gros dénivelé"],
    ["eau", ICONS.water, "Rivières, cascades et bords du Rhône"],
    ["vue", ICONS.view, "Crêts, belvédères et tables d'orientation"],
    ["patrimoine", ICONS.heritage, "Chapelles, aqueducs, villages"],
    ["transports", ICONS.bus, "Départ desservi en bus, tram ou train"],
    ["ville", ICONS.city, "Balades urbaines dans Lyon"],
  ];
  const countHome = (f) => DATA.randos.filter((r) => matches(r, f)).length;
  return {
    title: "Trouver une randonnée", nav: "accueil",
    html: `
    <div>
      <section class="photo-hero home-hero on-photo" aria-labelledby="h-page">
        ${img("hero-accueil", { cls: "bg", eager: true })}
        <div class="wrap">
          <p class="eyebrow-pill"><span>${DATA.randos.length} itinéraires autour de Lyon et dans le Pilat</span></p>
          <h1 id="h-page" tabindex="-1">Trouver une randonnée <span class="fix" aria-hidden="true">9.1 h1</span></h1>
          ${searchFormHTML({ variant: "home", filters: homeFilters })}
        </div>
        <p class="photo-credit">${photoCredit("hero-accueil")}</p>
      </section>

      <section class="wrap section" aria-labelledby="h-latest">
        <div class="section-head">
          <div>
            <h2 id="h-latest">Derniers itinéraires publiés <span class="fix" aria-hidden="true">9.1 h2</span></h2>
            <p class="muted" style="margin-top:4px">Autour de Lyon, classés du plus récemment mis à jour au plus ancien</p>
          </div>
          <a href="${resultsHash(LYON, "50", clone(DEFAULTS))}">Voir toutes les randonnées autour de Lyon</a>
        </div>
        <ul class="cards">${latest.map((r) => cardHTML(r, { fav: false })).join("")}</ul>
      </section>

      <section class="wrap section section-tight" aria-labelledby="h-intro">
        <h2 id="h-intro" class="vh">Pourquoi randonner</h2>
        <div class="intro-text">
          <p>Que vous soyez adepte des randonnées pédestres, du trek ou des randonnées en montagne, la randonnée est l'activité idéale pour profiter des grands espaces. Entre paysages somptueux et sites d'exception, chacun peut se lancer dans l'aventure à son rythme.</p>
          <p>Randonner, c'est aussi passer du temps en famille et se ressourcer. Quels que soient vos objectifs, la randonnée est accessible à tous : des traboules de Lyon aux crêts du Pilat, il y a toujours un sentier près de chez vous.</p>
        </div>
      </section>

      <div class="photo-pair" role="group" aria-label="Photos de montagne">
        <figure>${img("grand-1", { sizes: "(max-width: 640px) 100vw, 50vw", alt: "Le lac du Lauvitel au pied des sommets du massif des Écrins" })}<figcaption>${photoCredit("grand-1")}</figcaption></figure>
        <figure>${img("grand-2", { sizes: "(max-width: 640px) 100vw, 50vw", alt: "Le lac Cornu entre les rochers, face aux falaises des Fiz" })}<figcaption>${photoCredit("grand-2")}</figcaption></figure>
      </div>

      <section class="wrap section" aria-labelledby="h-envies">
        <div class="section-head"><h2 id="h-envies">Vous avez envie de…</h2></div>
        <ul class="themes">${themes.map(([k, ic, sub]) => {
          const n = DATA.randos.filter((r) => r.tags.includes(k)).length;
          return `<li><a class="theme" href="${resultsHash(LYON, "100", { ...clone(DEFAULTS), tags: [k] })}">${ic}<b>${esc(TAGS[k])}</b><span>${sub}</span><span class="tabular">${randos(n)}</span></a></li>`;
        }).join("")}</ul>
      </section>

      <div class="wrap">${carousel("car-pilat", "Dans le massif du Pilat", pilat.map((r) => nearHTML(r, km([LYON.lat, LYON.lon], r.start))).join(""), "À une heure de Lyon : crêts à plus de 1 400 m, cascades et landes de bruyère. Itinéraires officiels du Parc naturel régional.")}</div>

      <section class="wrap section" aria-labelledby="h-chiffres">
        <div class="section-head">
          <h2 id="h-chiffres">Une refonte pensée pour tous</h2>
          <a href="#/accessibilite">Voir les corrections de l'audit</a>
        </div>
        <dl class="stats">
          <div><dt>itinéraires avec tracé, profil et photos</dt><dd>${DATA.randos.length}</dd></div>
          <div><dt>non-conformités RGAA corrigées</dt><dd>12</dd></div>
          <div><dt>erreur axe-core sur les pages testées</dt><dd>0</dd></div>
          <div><dt>de large minimum, sans défilement horizontal</dt><dd>320 px</dd></div>
        </dl>
      </section>
    </div>`,
    wire() {
      wireSearch(() => homeFilters, (f) => {
        homeFilters = f;
        const a = active(f).length;
        $("#open-filters span").textContent = a ? `Filtres (${a})` : "Filtres";
        $("#filter-summary").textContent = summary(f);
        $("#open-filters").focus();
        announce(`Filtres enregistrés. ${summary(f)}. Lancez la recherche pour voir les résultats.`);
      }, countHome);
      wireCarousels(main);
    },
  };
}

/* =================== Vue : résultats =================== */
function introText(lieu, list) {
  const tags = (t) => list.filter((x) => x.r.tags.includes(t)).length;
  const lv = (l) => list.filter((x) => x.r.level === l).length;
  const where = lieu === "votre position" ? "Autour de vous" : `Autour de ${lieu}`;
  return `${where}, les sentiers passent des traboules de Lyon aux forêts des Monts d'Or, des vignobles de la vallée du Rhône aux crêts du Pilat. ${list.length ? `Parmi ces itinéraires, ${lv(1)} sont faciles, ${tags("eau")} longent l'eau et ${tags("vue")} offrent un beau point de vue.` : ""} Filtrez selon votre niveau pour trouver la sortie idéale.`;
}

function viewResults(params) {
  const lieu = params.get("lieu") || "Lyon";
  let lat = parseFloat(params.get("lat")), lon = parseFloat(params.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) { const p = PLACE(lieu) || LYON; lat = p.lat; lon = p.lon; }
  const center = [lat, lon];
  const rayon = ["10", "25", "50", "100", "tout"].includes(params.get("rayon")) ? params.get("rayon") : "50";
  const tri = ["proche", "duree", "distance", "denivele", "nom"].includes(params.get("tri")) ? params.get("tri") : "proche";
  const shown = Math.max(PAGE, parseInt(params.get("n") || PAGE, 10) || PAGE);
  const f = fromParams(params);

  const inRadius = DATA.randos.map((r) => ({ r, d: km(center, r.start) })).filter((x) => rayon === "tout" || x.d <= +rayon);
  const list = inRadius.filter((x) => matches(x.r, f));
  const sorters = { proche: (a, b) => a.d - b.d, duree: (a, b) => a.r.durationMin - b.r.durationMin, distance: (a, b) => a.r.km - b.r.km, denivele: (a, b) => a.r.ascent - b.r.ascent, nom: (a, b) => a.r.name.localeCompare(b.r.name, "fr") };
  list.sort(sorters[tri]);
  const n = list.length;
  const ofPlace = lieu === "votre position" ? "de vous" : `de ${lieu}`;
  const dText = (d) => (d < 1 ? `à moins d'1 km ${ofPlace}` : `à ${fr0(d)} km ${ofPlace}`);
  const where = lieu === "votre position" ? "autour de vous" : `autour de ${lieu}`;
  const h1 = n ? `${randos(n)} ${where}` : `Aucune randonnée ${where}`;
  const chips = active(f);
  const vis = list.slice(0, shown);
  const self = (changes = {}) => {
    const p = new URLSearchParams(params);
    p.set("lieu", lieu); p.set("lat", lat.toFixed(5)); p.set("lon", lon.toFixed(5));
    Object.entries(changes).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    return "#/recherche?" + p.toString();
  };
  const withFilters = (g) => { const p = new URLSearchParams(self().split("?")[1]); toParams(g, p); p.delete("n"); return "#/recherche?" + p.toString(); };
  const mosaic = [
    ["grille-1", "Le château de Grangent sur son île, au milieu des gorges de la Loire"],
    ["grille-2", "Les toits de tuiles du Vieux-Lyon"],
    ["grille-3", "La basilique de Fourvière illuminée la nuit"],
    ["grille-4", "Des vignes aux couleurs d'automne au-dessus d'Avenas, dans le Beaujolais"],
  ];

  return {
    title: `Randonnées ${where} (${n})`, nav: "recherche",
    announce: n ? `${randos(n)} trouvées ${where}, dans un rayon de ${rayon === "tout" ? "toute la région" : rayon + " kilomètres"}.` : `Aucune randonnée ne correspond ${where}.`,
    html: `
    <div class="wrap">
      <section class="photo-hero res-hero on-photo" aria-labelledby="h-page">
        ${img("hero-resultats", { cls: "bg", sizes: "(max-width: 1300px) 100vw, 1280px", eager: true })}
        ${searchFormHTML({ q: lieu === "votre position" ? "" : lieu, rayon: rayon === "tout" ? "100" : rayon, variant: "results", filters: f })}
        <div style="align-self:center;justify-self:center">
          <h1 id="h-page" tabindex="-1">${esc(h1)}</h1>
          <p class="res-sub">${rayon === "tout" ? "Toute la région" : `Dans un rayon de ${rayon} km`} <span class="fix" aria-hidden="true">7.5 · 8.6 · 9.1</span></p>
        </div>
        <p class="photo-credit">${photoCredit("hero-resultats")}</p>
      </section>

      <div class="res-top">
        <div class="res-list">
          <ul class="mosaic">${mosaic.map(([k, alt]) => `<li>${img(k, { sizes: "(max-width: 1000px) 50vw, 30vw", alt })}</li>`).join("")}</ul>

          <div class="res-list-head">
            <h2 id="h-liste">Nos meilleures sélections</h2>
            <div class="res-tools">
              <label for="tri">Trier par</label>
              <select id="tri">${[["proche", "Les plus proches"], ["duree", "Durée, de la plus courte"], ["distance", "Distance, de la plus courte"], ["denivele", "Dénivelé, du plus faible"], ["nom", "Nom, de A à Z"]].map(([v, t]) => `<option value="${v}" ${v === tri ? "selected" : ""}>${t}</option>`).join("")}</select>
            </div>
          </div>
          ${chips.length ? `<ul class="chips" aria-label="Filtres actifs">${chips.map((c) => `<li><button type="button" data-chip="${esc(c.k)}">${esc(c.label)} ${ICONS.close}<span class="vh"> : retirer ce filtre</span></button></li>`).join("")}<li><button type="button" data-chip="__all">Tout effacer</button></li></ul>` : ""}

          ${n ? `<div class="selection" role="region" aria-labelledby="h-liste" tabindex="0">
              <ol class="cards" id="results" role="list">${vis.map((x, i) => cardHTML(x.r, { n: i + 1, distText: dText(x.d), h: "h3" })).join("")}</ol>
            </div>
            ${n > shown ? `<div class="more-row"><button type="button" class="btn btn-outline btn-sm" id="more">Afficher ${Math.min(PAGE, n - shown)} randonnées de plus <span class="vh">(${shown} affichées sur ${n})</span></button></div>` : ""}`
          : `<div class="empty" style="margin-top:16px">
              <p><strong>Aucune randonnée ne correspond.</strong> ${inRadius.length ? "Vos filtres sont peut-être trop stricts." : `Il n'y a pas encore d'itinéraire dans ce rayon autour de ${esc(lieu)}.`}</p>
              <div class="actions">
                ${rayon !== "100" && rayon !== "tout" ? `<a class="btn btn-primary btn-sm" href="${self({ rayon: "100", n: null })}">Élargir à 100 km</a>` : `<a class="btn btn-primary btn-sm" href="${self({ rayon: "tout", n: null })}">Voir toute la région</a>`}
                ${chips.length ? `<a class="btn btn-outline btn-sm" href="${withFilters(clone(DEFAULTS))}">Retirer tous les filtres</a>` : ""}
              </div>
            </div>`}
        </div>

        <aside class="res-side" aria-label="Présentation et carte">
          <p class="res-intro">${esc(introText(lieu, list))}</p>
          <section class="map-panel" aria-labelledby="h-carte">
            <h2 id="h-carte" class="vh">Carte des résultats</h2>
            <div class="map" id="res-map"></div>
            <p class="map-note">Les numéros de la carte sont ceux de la liste. Au clavier : <kbd>Tab</kbd> jusqu'à un marqueur, puis <kbd>Entrée</kbd>. Toutes les randonnées de la carte sont aussi dans la liste.</p>
          </section>
        </aside>
      </div>
      <div class="page-bottom"></div>
    </div>`,
    wire() {
      wireSearch(() => f, (g) => go(withFilters(g), { replace: true, keepFocusId: "h-page" }), (g) => inRadius.filter((x) => matches(x.r, g)).length);
      const mapEl = $("#res-map");
      const map = createMap(mapEl, { label: `Carte : ${h1}`, center, zoom: 10 });
      const markers = new Map();
      if (map) {
        maps.push(map);
        L.marker(center, { icon: posIcon(), keyboard: false, interactive: false }).addTo(map).getElement()?.setAttribute("aria-hidden", "true");
        if (rayon !== "tout") L.circle(center, { radius: +rayon * 1000, color: "#2F4A07", weight: 1.5, fill: false, dashArray: "6 6", interactive: false }).addTo(map);
        list.forEach((x, i) => markers.set(x.r.id, resultMarker(map, x.r, i + 1, dText(x.d))));
        const pts = list.map((x) => x.r.start);
        if (pts.length) map.fitBounds(L.latLngBounds([...pts, center]).pad(0.12), { maxZoom: 13, animate: false });
        setTimeout(() => { if (maps.includes(map)) map.invalidateSize(); }, 60);
      }
      const hot = (id, on) => { const m = markers.get(id); const el = m?.getElement(); if (el) { el.classList.toggle("is-hot", on); m.setZIndexOffset(on ? 1000 : 0); } };
      $$(".card[data-id]", main).forEach((c) => {
        c.addEventListener("mouseenter", () => hot(c.dataset.id, true));
        c.addEventListener("mouseleave", () => hot(c.dataset.id, false));
        c.addEventListener("focusin", () => hot(c.dataset.id, true));
        c.addEventListener("focusout", () => hot(c.dataset.id, false));
      });
      markers.forEach((m, id) => {
        m.on("mouseover", () => $(`.card[data-id="${CSS.escape(id)}"]`)?.classList.add("is-hot"));
        m.on("mouseout", () => $(`.card[data-id="${CSS.escape(id)}"]`)?.classList.remove("is-hot"));
      });
      wireFavs(main);
      $("#tri").addEventListener("change", (e) => go(self({ tri: e.target.value }), { replace: true, keepFocusId: "tri" }));
      $("#more")?.addEventListener("click", () => {
        const first = list[shown];
        go(self({ n: shown + PAGE }), { replace: true, keepFocusId: first ? "lk-" + first.r.id : null });
        announce(`${Math.min(PAGE, n - shown)} randonnées ajoutées à la liste. Vous êtes sur la randonnée ${shown + 1}.`);
      });
      $$("[data-chip]").forEach((b) => b.addEventListener("click", () => {
        const g = b.dataset.chip === "__all" ? clone(DEFAULTS) : removeOne(f, b.dataset.chip);
        go(withFilters(g), { replace: true, keepFocusId: "open-filters" });
      }));
    },
  };
}

/* =================== Vue : fiche =================== */
function gpx(r) {
  const pts = r.geom.map((p) => `      <trkpt lat="${p[0]}" lon="${p[1]}"><ele>${p[2]}</ele></trkpt>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Visorando refonte accessible (maquette)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(r.name)}</name><desc>${esc(r.source.name)} – ${esc(r.source.trace)}</desc></metadata>
  <trk>
    <name>${esc(r.name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
}
function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function waypoints(r) {
  if (r.steps && r.steps.length) {
    return r.steps.map((s, i) => ({
      mark: i === 0 ? "D" : i === r.steps.length - 1 ? "A" : String(i),
      kind: i === 0 ? "Départ" : i === r.steps.length - 1 ? "Arrivée" : `Étape ${i}`,
      name: s.name, km: s.km, alt: s.alt, text: s.text, lat: s.lat, lon: s.lon, idx: i,
    }));
  }
  const cum = cumulative(r.geom);
  const iMax = r.geom.reduce((b, p, i, a) => (p[2] > a[b][2] ? i : b), 0);
  const last = r.geom.length - 1;
  const tmp = document.createElement("div");
  tmp.innerHTML = r.access || "";
  const out = [{ mark: "D", kind: "Départ", name: r.departure, km: 0, alt: r.geom[0][2], text: tmp.textContent.trim(), lat: r.geom[0][0], lon: r.geom[0][1], idx: 0 }];
  if (iMax > 0 && iMax < last) out.push({ mark: "1", kind: "Point haut", name: `Point culminant à ${fr0(r.geom[iMax][2])} m`, km: cum[iMax], alt: r.geom[iMax][2], text: "Le point le plus haut du parcours.", lat: r.geom[iMax][0], lon: r.geom[iMax][1], idx: 1 });
  out.push({ mark: "A", kind: "Arrivée", name: r.route === "Traversée" ? (r.arrival || "Arrivée") : `Retour : ${r.departure}`, km: cum[last], alt: r.geom[last][2], text: r.route === "Boucle" ? "Fin de la boucle, au point de départ." : r.route === "Aller-retour" ? "Fin de l'aller-retour, au point de départ." : "Fin de la traversée.", lat: r.geom[last][0], lon: r.geom[last][1], idx: out.length });
  return out;
}

function viewFiche(id) {
  const r = BYID.get(id);
  if (!r) return view404();
  const fav = store.isFav(r.id);
  const near = DATA.randos.filter((x) => x.id !== r.id).map((x) => ({ x, d: km(r.start, x.start) })).sort((a, b) => a.d - b.d).slice(0, 8);
  const deptQuery = resultsHash({ name: r.commune, lat: r.start[0], lon: r.start[1] }, "50", clone(DEFAULTS));
  const commQuery = resultsHash({ name: r.commune, lat: r.start[0], lon: r.start[1] }, "10", clone(DEFAULTS));
  const wps = waypoints(r);
  const tmp = document.createElement("div");
  tmp.innerHTML = r.ambiance || r.teaser || r.description || "";
  const lead = tmp.textContent.trim();
  const hasTransport = r.tags.includes("transports") && !!r.transport;
  const practical = [["Accès", r.access], ["Stationnement", r.parking], ["Transports en commun", r.transport]].filter(([, v]) => v);
  const collections = [["famille", "Balades en famille"], ["eau", "Au fil de l'eau"], ["vue", "Grands panoramas"], ["patrimoine", "Sur les traces du patrimoine"]].map(([k, t]) => {
    const items = DATA.randos.filter((x) => x.tags.includes(k) && x.photos.length && x.id !== r.id);
    return { k, t, n: items.length, ph: items[(r.ref.charCodeAt(3) + k.length) % Math.max(1, items.length)]?.photos[0] };
  });
  const sections = [["sec-etapes", "Étapes"], ["sec-carte", "Carte"], ["sec-profil", "Dénivelé"], ["sec-montees", "Montées et descentes"], ["sec-meteo", "Météo"], ["sec-infos", "Infos pratiques"], ["sec-faq", "Questions"]];
  const updated = r.source.updated ? new Date(r.source.updated).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

  return {
    title: r.name, nav: "",
    html: `
    <div class="wrap">
      <nav class="crumbs" aria-label="Fil d'Ariane">
        <ol>
          <li><a href="#/">Accueil</a></li>
          <li><a href="${deptQuery}">${esc(r.dept.name)}</a></li>
          <li><a href="${commQuery}">${esc(r.commune)}</a></li>
          <li><span aria-current="page">${esc(r.name)}</span></li>
        </ol>
      </nav>

      <div class="fiche-layout">
        <article class="fiche-main" aria-labelledby="h-page">
          ${galleryHTML(r)}

          <div class="fiche-intro">
            <div class="fix-row"><span class="fix" aria-hidden="true">3.2 fil d'Ariane</span><span class="fix" aria-hidden="true">9.1 titres</span><span class="fix" aria-hidden="true">1.1 alternatives</span></div>
            ${levelPill(r.level)}
            <h1 id="h-page" tabindex="-1">${esc(r.name)}</h1>
            <dl class="statline">
              <div><dt>${ICONS.clock}<span class="vh">Durée</span></dt><dd>${dur(r.durationMin)}</dd></div>
              <div><dt>${ICONS.ruler}<span class="vh">Distance</span></dt><dd>${fr1(r.km)} km</dd></div>
              <div><dt>${ICONS.up}<span class="vh">Dénivelé positif</span></dt><dd>${fr0(r.ascent)} m</dd></div>
              <div><dt>${ICONS.down}<span class="vh">Dénivelé négatif</span></dt><dd>${fr0(r.descent)} m</dd></div>
            </dl>
            <p class="muted">${esc(r.route)} · ${esc(r.commune)} (${esc(r.dept.code)}) · Randonnée n° <span class="tabular">${esc(r.ref)}</span></p>
            ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
            ${updated ? `<p class="updated">Mis à jour le ${updated}</p>` : ""}
            <div class="callout">${ICONS.busBig}<p>${hasTransport ? `<b>Accessible sans voiture</b> ${esc((document.createRange().createContextualFragment(r.transport).textContent || "").slice(0, 160))}` : `<b>Départ : ${esc(r.departure)}</b>Pensez au covoiturage pour rejoindre le point de départ.`}</p></div>
          </div>

          <nav class="page-nav" aria-label="Sur cette page">
            <ul>${sections.map(([sid, t]) => `<li><a href="#${sid}" data-jump="${sid}">${t}</a></li>`).join("")}</ul>
          </nav>

          <section id="sec-etapes" aria-labelledby="h-etapes" tabindex="-1">
            <h2 id="h-etapes">Étapes</h2>
            <ol class="timeline">${wps.map((w) => `
              <li>
                <span class="tl-km">${fr1(w.km)} km</span>
                <span class="tl-dot" aria-hidden="true">${w.mark}</span>
                <div class="tl-body">
                  <h3><span class="vh">${w.kind} : </span>${esc(w.name)} <span class="alt">· ${fr0(w.alt)} m</span></h3>
                  ${w.text ? `<p>${esc(w.text)}</p>` : ""}
                  <button type="button" class="link-btn" data-step="${w.idx}">Voir ${w.kind === "Départ" ? "le départ" : w.kind === "Arrivée" ? "l'arrivée" : w.kind === "Point haut" ? "le point haut" : `l'${w.kind.toLowerCase()}`} sur la carte</button>
                </div>
              </li>`).join("")}
            </ol>
          </section>

          <section id="sec-carte" aria-labelledby="h-map" tabindex="-1">
            <h2 id="h-map">Carte du parcours</h2>
            <div class="map fiche-map" id="f-map"></div>
            <p class="map-note" style="margin-top:8px">${esc(r.source.trace)}. La carte se déplace aussi au clavier avec les flèches quand elle a le focus.</p>
          </section>

          <section id="sec-profil" aria-labelledby="h-profil" tabindex="-1">
            <h2 id="h-profil">Dénivelé</h2>
            <div class="card-box" id="f-profile"></div>
          </section>

          <section id="sec-montees" aria-labelledby="h-montees" tabindex="-1">
            <h2 id="h-montees">Montées et descentes</h2>
            <div class="card-box" id="climbs">${climbsHTML(r)}</div>
          </section>

          <section id="sec-meteo" aria-labelledby="h-meteo" tabindex="-1">
            <h2 id="h-meteo">Météo</h2>
            <div class="weather" id="weather" aria-live="polite"><p>Chargement des prévisions…</p></div>
          </section>

          <section id="sec-infos" aria-labelledby="h-infos" tabindex="-1">
            <h2 id="h-infos">Infos pratiques</h2>
            <div class="prose">
              ${r.description ? `<h3 style="font-size:1.2rem">Description de l'itinéraire</h3>${r.description}` : ""}
              ${practical.length ? `<dl class="practical">${practical.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
              ${r.advice && r.id.startsWith("gt-") ? `<details class="data"><summary>Lire les recommandations du gestionnaire</summary><div class="prose" style="margin-top:10px">${r.advice}</div></details>` : ""}
            </div>
          </section>
        </article>

        <aside class="fiche-side" aria-label="Actions et sécurité">
          <button type="button" class="btn btn-primary btn-block" id="f-gpx">${ICONS.download} Télécharger le tracé GPX</button>
          <button type="button" class="btn btn-sand btn-block" id="f-fav" aria-pressed="${fav}">${ICONS.heart} <span>${fav ? "Dans mes favoris" : "Ajouter aux favoris"}</span></button>
          <p class="status-msg" id="f-status" role="status"></p>
          <div class="side-card">
            <ul>
              <li><button type="button" class="side-action" id="f-copy">${ICONS.link} Copier le lien</button></li>
              <li><button type="button" class="side-action" id="f-print">${ICONS.print} Imprimer la fiche</button></li>
              <li><button type="button" class="side-action" data-step="0">${ICONS.pin} Voir le départ sur la carte</button></li>
              <li><a class="side-action" href="https://www.openstreetmap.org/directions?to=${r.start[0]}%2C${r.start[1]}" target="_blank" rel="noopener">${ICONS.external} Itinéraire jusqu'au départ<span class="vh"> (OpenStreetMap, nouvelle fenêtre)</span></a></li>
              ${r.source.pdf ? `<li><a class="side-action" href="${esc(r.source.pdf)}" target="_blank" rel="noopener">${ICONS.pdf} Fiche PDF officielle<span class="vh"> (nouvelle fenêtre)</span></a></li>` : ""}
            </ul>
          </div>
          <section class="safety" aria-labelledby="h-secu">
            <h2 id="h-secu">${ICONS.warn} Sécurité</h2>
            <span class="fix" aria-hidden="true">3.2 texte 15,6:1 (avant 3,23:1)</span>
            <p>Soyez toujours prudent et prévoyant. Vous restez responsable de votre sécurité sur ce parcours.</p>
            <ul>
              <li>Vérifiez la météo avant de partir${r.maxEl > 1000 ? " : le Pilat est souvent venté et enneigé l'hiver" : ""}.</li>
              <li>Prévenez un proche de votre itinéraire.</li>
              <li>Emportez de l'eau et de bonnes chaussures.</li>
              <li>En cas d'urgence, appelez le <strong class="tabular">112</strong>.</li>
            </ul>
          </section>
          <p class="credit">Source : ${esc(r.source.name)}${r.source.provider ? ` – ${esc(r.source.provider)}` : ""}.</p>
        </aside>
      </div>

      <section class="section faq-center" id="sec-faq" aria-labelledby="h-faq" tabindex="-1">
        <h2 id="h-faq" style="font-size:clamp(1.6rem,3.4vw,2.3rem);font-weight:600">Questions fréquentes</h2>
        ${faq(r, hasTransport)}
      </section>

      ${carousel("car-near", "Randonnées à proximité", near.map(({ x, d }) => nearHTML(x, d)).join(""))}

      <section class="section section-tight" aria-labelledby="h-also">
        <div class="carousel-head"><h2 id="h-also">Vous aimerez aussi</h2></div>
        <ul class="track" aria-labelledby="h-also" style="grid-auto-columns:minmax(14rem,1fr)">
          ${collections.map((c) => `<li><a class="collection" href="${resultsHash({ name: r.commune, lat: r.start[0], lon: r.start[1] }, "100", { ...clone(DEFAULTS), tags: [c.k] })}">${c.ph ? `<img src="${esc(c.ph.thumb)}" alt="" loading="lazy" data-fallback="${c.k}">` : ""}<span><b>${esc(c.t)}</b><small>${randos(c.n)} près de ${esc(r.commune)}</small></span></a></li>`).join("")}
        </ul>
      </section>
      <div class="page-bottom"></div>
    </div>`,
    wire() {
      wireGallery(main, r);
      wireCarousels(main);
      wireTabs($("#climbs"));
      loadWeather($("#weather"), r);
      $$("[data-jump]").forEach((a) => a.addEventListener("click", (e) => {
        e.preventDefault();
        const t = document.getElementById(a.dataset.jump);
        t.scrollIntoView({ block: "start" });
        t.focus({ preventScroll: true });
      }));
      const map = createMap($("#f-map"), { label: `Carte du parcours ${r.name}`, center: r.start, zoom: 13 });
      let pos = null;
      if (map) {
        maps.push(map);
        const line = r.geom.map((p) => [p[0], p[1]]);
        L.polyline(line, { color: "#FFFFFF", weight: 8, opacity: 0.9, interactive: false }).addTo(map);
        const pl = L.polyline(line, { color: "#1F5FA8", weight: 4.5, opacity: 1, interactive: false }).addTo(map);
        wps.forEach((w) => {
          const m = L.marker([w.lat, w.lon], { icon: w.mark === "D" ? startIcon() : stepIcon(w.mark), keyboard: true, title: `${w.kind} : ${w.name}` }).addTo(map)
            .bindPopup(`<strong>${esc(w.kind)}</strong><br>${esc(w.name)}<br><span class="pp-meta">km ${fr1(w.km)} · ${fr0(w.alt)} m</span>`);
          m.getElement()?.setAttribute("aria-label", `${w.kind} : ${w.name}`);
        });
        map.fitBounds(pl.getBounds().pad(0.08), { animate: false });
        pos = L.marker(r.start, { icon: posIcon(), keyboard: false, interactive: false });
      }
      renderProfile($("#f-profile"), r, (i) => {
        if (!map || !pos) return;
        if (i === null) { pos.remove(); return; }
        pos.setLatLng([r.geom[i][0], r.geom[i][1]]);
        if (!map.hasLayer(pos)) pos.addTo(map);
        pos.getElement()?.setAttribute("aria-hidden", "true");
      });
      $$("[data-step]").forEach((b) => b.addEventListener("click", () => {
        const w = wps[+b.dataset.step];
        if (!map) return;
        map.setView([w.lat, w.lon], 16, { animate: false });
        $("#f-map").scrollIntoView({ block: "center" });
        announce(`Carte centrée sur : ${w.name}.`);
      }));
      const status = $("#f-status");
      const say = (t) => { status.textContent = ""; setTimeout(() => (status.textContent = t), 60); };
      $("#f-fav").addEventListener("click", (e) => {
        const now = store.toggleFav(r.id);
        const b = e.currentTarget;
        b.setAttribute("aria-pressed", String(now));
        b.querySelector("span").textContent = now ? "Dans mes favoris" : "Ajouter aux favoris";
        say(now ? "Randonnée ajoutée à vos favoris." : "Randonnée retirée de vos favoris.");
      });
      $("#f-gpx").addEventListener("click", () => {
        const blob = new Blob([gpx(r)], { type: "application/gpx+xml" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${slug(r.name)}.gpx`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        say(`Fichier ${slug(r.name)}.gpx téléchargé.`);
      });
      $("#f-copy").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(location.href); say("Lien copié dans le presse-papiers."); }
        catch { say(`Copie impossible. Voici le lien : ${location.href}`); }
      });
      $("#f-print").addEventListener("click", () => window.print());
    },
  };
}

/* =================== Vue : favoris =================== */
function viewFavs() {
  const ids = store.favorites().filter((id) => BYID.has(id));
  const n = ids.length;
  return {
    title: "Mes favoris", nav: "favoris",
    html: `
    <div class="wrap">
      <div class="page-head">
        <h1 id="h-page" tabindex="-1">Mes favoris</h1>
        <p class="muted">${n ? `${randos(n)} enregistrée${n > 1 ? "s" : ""} sur cet appareil.` : "Les favoris sont enregistrés dans ce navigateur, sans compte."}</p>
      </div>
      ${n ? `<ul class="cards" id="fav-list">${ids.map((id) => cardHTML(BYID.get(id), { h: "h2" })).join("")}</ul>`
        : `<div class="empty"><p><strong>Vous n'avez pas encore de favori.</strong> Dans les résultats ou sur une fiche, utilisez l'étoile ou le bouton « Ajouter aux favoris ».</p><a class="btn btn-primary btn-sm" href="#/">Trouver une randonnée</a></div>`}
      <div class="page-bottom"></div>
    </div>`,
    wire() {
      wireFavs(main, (id, now, btn) => {
        if (now) return;
        const li = btn.closest("li");
        const next = li.nextElementSibling || li.previousElementSibling;
        li.remove();
        const left = $$("#fav-list > li").length;
        if (!left) { go("#/favoris", { replace: true }); return; }
        (next?.querySelector(".fav") || $("#h-page")).focus();
        $(".page-head p").textContent = `${randos(left)} enregistrée${left > 1 ? "s" : ""} sur cet appareil.`;
      });
    },
  };
}

/* =================== Vue : accessibilité =================== */
function viewA11y() {
  const rows = [
    ["11.1", "Le champ de recherche n'a pas de vraie étiquette : l'étiquette pointe vers un champ qui n'existe pas, la consigne est dans le placeholder.", "Étiquette visible reliée au champ (« Où voulez-vous randonner ? » sur l'accueil, « Lieu de la recherche » sur les résultats), aide permanente, erreurs reliées par aria-describedby.", "#/"],
    ["7.1", "Le panneau Filtres n'est pas déclaré comme une fenêtre ; le bouton menu ne dit pas s'il est ouvert.", "Panneau construit avec un élément dialog nommé par son titre ; bouton « Menu » avec aria-expanded.", "#/"],
    ["7.3", "Impossible d'entrer dans le panneau Filtres ou de le fermer au clavier.", "À l'ouverture, le focus va sur le premier curseur ; Échap ferme ; tous les contrôles sont natifs.", "#/"],
    ["12.8", "Tab envoie sur un bouton caché sous le panneau.", "Le reste de la page devient inerte et le focus boucle dans le panneau ; à la fermeture, il revient sur « Filtres ».", "#/"],
    ["9.1", "« Trouver une randonnée » est du texte en gras, le premier titre est vide, la page résultats n'a pas de h1.", "Chaque page a un seul h1, puis des h2 et h3 dans l'ordre.", "#/recherche?lieu=Lyon"],
    ["3.2", "Avertissement de sécurité gris #8F8F8F (3,23:1), titres blancs sur vert (2,8:1), fil d'Ariane (2,1:1).", "Texte principal à 15,6:1, gris secondaire à 7,4:1, blanc sur les cartes vertes à 6,1:1, voile sombre sous les textes posés sur photo, encadré Sécurité dédié.", "#/rando/ly-tony-garnier"],
    ["7.5", "Le nombre de résultats n'est pas annoncé après une recherche.", "Une zone de statut annonce « N randonnées trouvées autour de… » après chaque recherche ou changement de filtre.", "#/recherche?lieu=Lyon"],
    ["8.6", "Le titre d'onglet reste « Carte de recherche… », sans le lieu.", "Le titre d'onglet change à chaque page : lieu et nombre de résultats, ou nom de la randonnée.", "#/recherche?lieu=Lyon"],
    ["12.6", "Pas de zone de contenu principale sur la page résultats.", "Repères header, nav, main, aside et footer sur toutes les pages.", "#/recherche?lieu=Lyon"],
    ["12.7", "Pas de lien d'évitement.", "Lien « Aller au contenu », premier élément atteint avec Tab.", "#/"],
    ["6.2", "Le bouton « Ouvrir dans l'app » n'a aucun intitulé.", "Tous les boutons ont un texte visible ou un nom accessible explicite (étoile favori, zoom, fond de carte, flèches des carrousels).", "#/rando/ly-tony-garnier"],
    ["1.2", "Images décoratives sans alternative vide (randonneur animé, herbe, pictos).", "Photos d'ambiance et vignettes avec alt vide, pictogrammes masqués ; les photos qui portent une information ont un texte alternatif.", "#/"],
  ];
  return {
    title: "Accessibilité", nav: "accessibilite",
    html: `
    <div class="wrap">
      <div class="page-head">
        <h1 id="h-page" tabindex="-1">Accessibilité de la refonte</h1>
        <p class="lead" style="max-width:62ch">Cette maquette corrige les 12 non-conformités relevées lors de l'audit RGAA 4.1.2 partiel de visorando.com du 15 octobre 2026. Elle n'est pas encore déclarée conforme : il reste à la tester avec un lecteur d'écran.</p>
      </div>
      <div class="doc">
        <section aria-labelledby="h-corr">
          <h2 id="h-corr">Corrections critère par critère</h2>
          <p class="muted" style="margin-bottom:12px">Le réglage « Montrer les corrections RGAA », dans le menu et le pied de page, affiche ces numéros de critère sur les éléments corrigés.</p>
          <div class="table-wrap" tabindex="0" role="region" aria-label="Tableau des corrections">
            <table>
              <caption class="vh">Pour chaque critère non conforme de l'audit : problème, correction et page où le vérifier</caption>
              <thead><tr><th scope="col">Critère</th><th scope="col">Sur visorando.com</th><th scope="col">Dans cette refonte</th><th scope="col">Vérifier</th></tr></thead>
              <tbody>${rows.map(([c, a, b, h]) => `<tr><th scope="row" class="tabular">${c} <span class="pill pill-nc">NC</span></th><td>${esc(a)}</td><td>${esc(b)}</td><td><a href="${h}">Ouvrir<span class="vh"> la page pour le critère ${c}</span></a></td></tr>`).join("")}</tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="h-test" class="prose">
          <h2 id="h-test">Tester vous-même en 5 minutes</h2>
          <ol>
            <li>Rechargez la page et appuyez sur <kbd>Tab</kbd> : le lien « Aller au contenu » apparaît.</li>
            <li>Sur l'accueil, tapez « pel » dans le champ, choisissez « Pélussin » avec <kbd>↓</kbd> puis <kbd>Entrée</kbd>.</li>
            <li>Ouvrez « Filtres » avec <kbd>Entrée</kbd>, réglez la durée avec <kbd>←</kbd> : la valeur et l'unité sont annoncées.</li>
            <li>Appuyez sur <kbd>Tab</kbd> plusieurs fois : le focus reste dans le panneau. <kbd>Échap</kbd> le ferme et revient sur « Filtres ».</li>
            <li>Sur une fiche, parcourez le dénivelé avec <kbd>→</kbd> : le point rouge se déplace aussi sur la carte.</li>
          </ol>
        </section>
        <section aria-labelledby="h-reste" class="prose">
          <h2 id="h-reste">Ce qui reste à vérifier</h2>
          <ul>
            <li>Écoute réelle avec NVDA (Windows) et VoiceOver (macOS, iOS).</li>
            <li>Contrastes des textes posés sur les photos, mesurés à la main avec Colour Contrast Analyser.</li>
            <li>Zoom du texte seul à 200 %.</li>
            <li>Les fonds de carte IGN et OpenStreetMap sont des images : leurs libellés ne sont pas lus. La liste des résultats et le tableau des altitudes servent d'alternative.</li>
            <li>Les textes des itinéraires du Pilat viennent de leurs gestionnaires et n'ont pas été réécrits.</li>
          </ul>
        </section>
        <section aria-labelledby="h-data" class="prose">
          <h2 id="h-data">Données utilisées</h2>
          <ul>
            <li>${DATA.randos.filter((r) => r.id.startsWith("gt-")).length} itinéraires officiels : Geotrek Auvergne-Rhône-Alpes Tourisme (tracés, photos, descriptions).</li>
            <li>${DATA.randos.filter((r) => r.id.startsWith("ly-")).length} balades lyonnaises : tracés calculés sur OpenStreetMap, altitudes IGN, photos Wikimedia Commons, textes écrits pour la maquette.</li>
            <li>Fonds de carte : Plan IGN, photographies aériennes IGN, OpenStreetMap. Météo : Open-Meteo.</li>
          </ul>
        </section>
      </div>
    </div>`,
  };
}

function view404() {
  return {
    title: "Page introuvable", nav: "",
    html: `<div class="wrap page-head" style="padding-bottom:88px"><h1 id="h-page" tabindex="-1">Page introuvable</h1><p>Cette adresse ne correspond à aucune page ou randonnée.</p><p><a class="btn btn-primary btn-sm" href="#/">Retour à la recherche</a></p></div>`,
  };
}

/* =================== Menu, inscription, mode étude =================== */
const menuBtn = $("#menu-btn"), panel = $("#menu-panel");
function closeMenu(focusBtn) {
  if (panel.hidden) return;
  panel.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  if (focusBtn) menuBtn.focus();
}
menuBtn.addEventListener("click", () => {
  const open = panel.hidden;
  panel.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
  if (open) $("a", panel).focus();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { closeMenu(true); } });
document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(false); });
panel.addEventListener("focusout", (e) => { if (!panel.hidden && e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== menuBtn) closeMenu(false); });
$(".skip").addEventListener("click", (e) => { e.preventDefault(); main.focus(); main.scrollIntoView(); });

function setAnnot(on) {
  $$("[data-annot]").forEach((b) => b.setAttribute("aria-pressed", String(on)));
  document.documentElement.classList.toggle("annot", on);
}
$$("[data-annot]").forEach((b) => b.addEventListener("click", () => {
  const on = b.getAttribute("aria-pressed") !== "true";
  setAnnot(on);
  store.setPref("annot", on);
  announce(on ? "Corrections RGAA affichées sur la page." : "Corrections RGAA masquées.");
}));
setAnnot(!!store.getPref("annot", false));

$("#signup-btn").addEventListener("click", (e) => {
  const opener = e.currentTarget;
  const dlg = $("#signup");
  dlg.innerHTML = `
    <form class="dlg" novalidate>
      <div class="dlg-head"><h2 id="h-signup">Créer un compte</h2><button type="button" class="close-btn" data-close>${ICONS.close} Fermer</button></div>
      <div class="dlg-body">
        <p style="margin-top:12px">Recevez les nouveaux itinéraires près de chez vous et retrouvez vos favoris sur tous vos appareils.</p>
        <div class="text-field">
          <label for="su-mail">Adresse e-mail</label>
          <input id="su-mail" type="email" autocomplete="email" aria-describedby="su-hint su-err" required>
          <p id="su-hint" class="muted" style="font-size:.92rem">Exemple : prenom.nom@exemple.fr</p>
          <p id="su-err" class="form-msg" style="background:var(--safety-bg)" hidden></p>
        </div>
        <p id="su-ok" role="status"></p>
      </div>
      <div class="dlg-foot"><span></span><button type="submit" class="btn btn-primary btn-sm">S'inscrire</button></div>
    </form>`;
  const ac = new AbortController();
  trapFocus(dlg, ac.signal);
  const mail = $("#su-mail", dlg), err = $("#su-err", dlg);
  $("[data-close]", dlg).addEventListener("click", () => dlg.close());
  $("form", dlg).addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!mail.value.trim() || !mail.checkValidity()) {
      err.textContent = "Saisissez une adresse e-mail valide, par exemple prenom.nom@exemple.fr.";
      err.hidden = false; mail.setAttribute("aria-invalid", "true"); mail.focus();
      return;
    }
    err.hidden = true; mail.removeAttribute("aria-invalid");
    $("#su-ok", dlg).textContent = "Merci ! Cette maquette n'envoie aucune donnée : votre adresse n'a pas été enregistrée.";
  });
  dlg.addEventListener("close", () => { ac.abort(); opener.focus(); }, { signal: ac.signal });
  dlg.showModal();
  mail.focus();
});

function fillCredits() {
  const ul = $("#photo-credits");
  const labels = { "hero-accueil": "Lac de Roselend", "hero-resultats": "Gorges de la Loire", "grille-1": "Île de Grangent", "grille-2": "Toits du Vieux-Lyon", "grille-3": "Fourvière de nuit", "grille-4": "Vignes près d'Avenas", "grand-1": "Lac du Lauvitel", "grand-2": "Lac Cornu", footer: "Aiguilles d'Arves" };
  ul.innerHTML = Object.entries(PHOTOS).map(([k, p]) => `<li>${esc(labels[k] || k)} : ${esc(cleanAuthor(p.author))}, <a href="${esc(p.page)}" target="_blank" rel="noopener">${esc(p.license)}<span class="vh"> (nouvelle fenêtre)</span></a></li>`).join("") +
    "<li>Photos des itinéraires : leurs auteurs, crédités sur chaque fiche.</li>";
  const fc = $('[data-credit="footer"]');
  if (fc) fc.innerHTML = photoCredit("footer");
}

(async function start() {
  try {
    await load();
  } catch (e) {
    main.innerHTML = `<div class="wrap page-head"><h1 id="h-page" tabindex="-1">Les données n'ont pas pu être chargées</h1>
      <p>Ouvrez le site avec le lanceur fourni (adresse http://localhost:5173) plutôt qu'en double-cliquant sur index.html.</p></div>`;
    return;
  }
  updateFavCount();
  fillCredits();
  if (!location.hash) history.replaceState(null, "", "#/");
  render(true);
  if (!hasLeaflet()) console.warn("Leaflet indisponible : les cartes sont désactivées.");
})();
