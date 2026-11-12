// Petits utilitaires partagés.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function norm(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").toLowerCase().trim();
}

const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const fr1 = (n) => nf1.format(n);
export const fr0 = (n) => nf0.format(n);

export function dur(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
export function durSpoken(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  const parts = [];
  if (h) parts.push(h + (h > 1 ? " heures" : " heure"));
  if (m) parts.push(m + " minutes");
  return parts.join(" ") || "0 minute";
}

export const LEVELS = ["", "Facile", "Modérée", "Assez difficile", "Difficile"];
export function levelHTML(l) {
  return `<span class="level level-${l}"><i aria-hidden="true"><b></b><b></b><b></b><b></b></i>${LEVELS[l]}</span>`;
}

export const TAGS = {
  famille: "Balade en famille",
  eau: "Au fil de l'eau",
  vue: "Point de vue",
  patrimoine: "Patrimoine",
  transports: "Accessible en transports",
  ville: "En ville",
};

export function plural(n, one, many) { return `${fr0(n)} ${n > 1 ? many : one}`; }
export const randos = (n) => plural(n, "randonnée", "randonnées");

/** distance en km entre [lat, lon] */
export function km(a, b) {
  const R = 6371, t = Math.PI / 180;
  const dl = (b[0] - a[0]) * t, dg = (b[1] - a[1]) * t;
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dg / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Annonce polie pour les lecteurs d'écran (RGAA 7.5). */
let annTimer;
export function announce(msg) {
  const a = document.getElementById("annonce");
  if (!a) return;
  a.textContent = "";
  clearTimeout(annTimer);
  annTimer = setTimeout(() => { a.textContent = msg; }, 120);
}

/* Courbes de niveau décoratives (seed stable). */
function rng(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function contourPaths(seed, w, h, rings, cx, cy) {
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  cx = cx ?? w * (0.3 + r() * 0.4);
  cy = cy ?? h * (0.35 + r() * 0.3);
  let out = "";
  for (let k = 1; k <= rings; k++) {
    const base = (Math.max(w, h) / rings) * k * 0.62;
    let d = "";
    for (let a = 0; a <= 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      const rad = base * (1 + 0.16 * Math.sin(3 * t + ph[0]) + 0.09 * Math.sin(5 * t + ph[1] + k * 0.3) + 0.05 * Math.sin(2 * t + ph[2]));
      d += (a ? "L" : "M") + (cx + Math.cos(t) * rad * 1.35).toFixed(1) + " " + (cy + Math.sin(t) * rad * 0.8).toFixed(1);
    }
    out += `<path d="${d}Z" fill="none" stroke="currentColor" stroke-width="${k % 4 === 0 ? 1.8 : 0.9}"/>`;
  }
  return out;
}
export function placeholderSVG(seed) {
  return `<svg class="ph" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${contourPaths(seed, 320, 180, 10)}</svg>`;
}

/** Remplace une image qui ne charge pas par des courbes de niveau. */
export function installImageFallback() {
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
    const span = document.createElement("span");
    span.innerHTML = placeholderSVG(img.dataset.fallback);
    img.replaceWith(span.firstChild);
  }, true);
}

export const ICONS = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.7 3.3 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M13.5 13.5 18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  filter: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  locate: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 3l10 10M13 3 3 13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  download: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M3.5 16.5h13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L10 5M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  print: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5.5 7V3h9v4M5.5 14H3.5V8h13v6h-2M6 11.5h8V17H6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  warn: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.5 22 20H2L12 2.5Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 9v5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m7.5 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  family: '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 25v-8a5 5 0 0 1 10 0v8M16 25v-6a4 4 0 0 1 8 0v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  water: '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M2 10c3 0 3-2.5 6-2.5S11 10 14 10s3-2.5 6-2.5S23 10 26 10M2 16c3 0 3-2.5 6-2.5s3 2.5 6 2.5 3-2.5 6-2.5 3 2.5 6 2.5M2 22c3 0 3-2.5 6-2.5s3 2.5 6 2.5 3-2.5 6-2.5 3 2.5 6 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  view: '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M2 23 10 9l5 8 4-5 7 11Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="21" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  heritage: '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M3 11 14 4l11 7M5 11v11M10 11v11M18 11v11M23 11v11M2 24h24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bus: '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><rect x="5" y="3" width="18" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 13h18M9 22v3M19 22v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9.5" cy="17.5" r="1.4" fill="currentColor"/><circle cx="18.5" cy="17.5" r="1.4" fill="currentColor"/></svg>',
  city: '<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><path d="M3 25V12l6-4v17M9 25V5h9v20M18 25V11h7v14M2 25h24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
};

/** Garde le focus dans un dialogue : Tab depuis le dernier élément revient au premier (RGAA 12.8). */
export function trapFocus(container, signal) {
  const SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const els = Array.from(container.querySelectorAll(SEL)).filter((el) => !el.hidden && el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, { signal });
}

Object.assign(ICONS, {
  star: '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path class="star" d="m16 7.8 2.5 5.2 5.6.8-4.1 3.9 1 5.6L16 20.6l-5 2.7 1-5.6-4.1-3.9 5.6-.8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 5.5V10l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  ruler: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 14 14 3l3 3L6 17Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m7 10 1.5 1.5M9.5 7.5 11 9M12 5l1.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 16 9 7l3 4 5-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 4h4v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 4l6 9 3-4 5 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 16h4v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camera: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 6.5h3l1.5-2h5l1.5 2h3v9H3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="11" r="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  pdf: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 2.5h7l3.5 3.5v11.5H5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 2.5V6h3.5M7.5 11h5M7.5 14h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  pin: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 18s5.5-5.3 5.5-9.5a5.5 5.5 0 0 0-11 0C4.5 12.7 10 18 10 18Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="8.5" r="2" fill="currentColor"/></svg>',
  external: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M11 3h6v6M17 3l-8 8M14 12v5H3V6h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookmark: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path class="fill-on" d="M5 2.5h10v15l-5-3.6-5 3.6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  share: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 12.5V2.5M6.5 6 10 2.5 13.5 6M4 10v7h12v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  navigate: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M17.5 2.5 2.5 9l6.5 2.5 2.5 6.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  expand: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M13.5 3.5l3 3L7 16H4v-3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  move: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2v16M2 10h16M7.5 4.5 10 2l2.5 2.5M7.5 15.5 10 18l2.5-2.5M4.5 7.5 2 10l2.5 2.5M15.5 7.5 18 10l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  code: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7 5 2 10l5 5M13 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="6.2" r="1.1" fill="currentColor"/></svg>',
  phone: '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="5.5" y="2" width="9" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="10" cy="14.8" r="0.9" fill="currentColor"/></svg>',
  busBig:'<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false"><rect x="5" y="3" width="18" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 13h18M9 22v3M19 22v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9.5" cy="17.5" r="1.4" fill="currentColor"/><circle cx="18.5" cy="17.5" r="1.4" fill="currentColor"/></svg>',
});

/** Pastille de niveau colorée (fiche, carrousels) : couleur + texte. */
export function levelPill(l) { return `<span class="pill-level l${l}">${LEVELS[l]}</span>`; }

/** Nettoie les noms d'auteurs Wikimedia. */
export function cleanAuthor(a) {
  return String(a || "").replace(/^This picture belongs to\s*/i, "").replace(/\. ?Please.*$/i, "").replace(/\s+from\s+.*$/i, "").replace(/\s*\(talk\)$/i, "").trim() || "Auteur inconnu";
}
