// Préférences locales (favoris, mode étude). Tout est protégé : le site marche sans stockage.

const KEY = "visorando-refonte";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
}

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => fn()); }

export function favorites() { return read().fav || []; }
export function isFav(id) { return favorites().includes(id); }
export function toggleFav(id) {
  const d = read();
  const list = d.fav || [];
  const i = list.indexOf(id);
  if (i > -1) list.splice(i, 1); else list.unshift(id);
  d.fav = list;
  write(d);
  emit();
  return i === -1;
}

export function getPref(name, fallback) { const v = read()[name]; return v === undefined ? fallback : v; }
export function setPref(name, value) { const d = read(); d[name] = value; write(d); }
