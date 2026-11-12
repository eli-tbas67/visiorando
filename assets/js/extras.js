// Calculs et contenus complémentaires de la fiche : montées/descentes, météo, questions fréquentes.
import { esc, fr0, fr1, dur, LEVELS } from "./utils.js";
import { cumulative } from "./profile.js";

/* ---------- Montées et descentes (calculées sur le tracé) ---------- */
function smooth(z, w = 2) {
  return z.map((_, i) => { const s = z.slice(Math.max(0, i - w), i + w + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
}
/**
 * Segments continus de montée (sign = 1) ou de descente (sign = -1).
 * Un retour en arrière de moins de `tol` mètres ne coupe pas le segment.
 */
export function segments(r, sign, minGain = 25, tol = 8) {
  const cum = cumulative(r.geom);
  const z = smooth(r.geom.map((p) => p[2]));
  const out = [];
  let i = 0;
  while (i < z.length - 1) {
    let start = i, best = i, j = i;
    while (j < z.length - 1) {
      j++;
      if ((z[j] - z[best]) * sign > 0) best = j;
      else if ((z[best] - z[j]) * sign > tol) break;
    }
    const gain = (z[best] - z[start]) * sign;
    if (gain >= minGain) {
      const d = cum[best] - cum[start];
      out.push({ from: cum[start], to: cum[best], gain, d, grade: d > 0 ? (gain / (d * 1000)) * 100 : 0, top: Math.round(z[best]) });
      i = best;
    } else i = Math.max(i + 1, best === start ? j : best);
  }
  return out.sort((a, b) => b.gain - a.gain);
}

export function climbsHTML(r) {
  const tab = (sign) => {
    const s = segments(r, sign);
    if (!s.length) return `<p>Aucune ${sign > 0 ? "montée" : "descente"} de plus de 25 m sur ce parcours.</p>`;
    return `<div class="table-wrap" style="max-height:none" tabindex="0" role="region" aria-label="${sign > 0 ? "Tableau des montées" : "Tableau des descentes"}"><table>
      <caption class="vh">${sign > 0 ? "Montées" : "Descentes"} du parcours, de la plus importante à la plus faible</caption>
      <thead><tr><th scope="col">N°</th><th scope="col" class="num">${sign > 0 ? "Dénivelé +" : "Dénivelé −"}</th><th scope="col" class="num">Pente moyenne</th><th scope="col" class="num">Longueur</th><th scope="col" class="num">Du km au km</th></tr></thead>
      <tbody>${s.slice(0, 5).map((x, i) => `<tr><th scope="row" class="tabular">${i + 1}</th><td class="num tabular">${fr0(x.gain)} m</td><td class="num tabular">${fr0(x.grade)} %</td><td class="num tabular">${fr1(x.d)} km</td><td class="num tabular">${fr1(x.from)} → ${fr1(x.to)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  };
  return `
    <div class="climbs-tabs" role="tablist" aria-label="Montées ou descentes">
      <button type="button" role="tab" id="tab-up" aria-selected="true" aria-controls="panel-up">Montées</button>
      <button type="button" role="tab" id="tab-down" aria-selected="false" aria-controls="panel-down" tabindex="-1">Descentes</button>
    </div>
    <div role="tabpanel" id="panel-up" aria-labelledby="tab-up" tabindex="0">${tab(1)}</div>
    <div role="tabpanel" id="panel-down" aria-labelledby="tab-down" tabindex="0" hidden>${tab(-1)}</div>
    <p class="muted" style="margin-top:10px;font-size:.92rem">Calculé à partir des altitudes du tracé. Les montées de moins de 25 m ne sont pas comptées.</p>`;
}

/** Onglets accessibles (motif ARIA : flèches gauche/droite, Début, Fin). */
export function wireTabs(root) {
  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const select = (t, focus) => {
    tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute("aria-selected", String(on));
      x.tabIndex = on ? 0 : -1;
      root.querySelector("#" + x.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t, false));
    t.addEventListener("keydown", (e) => {
      let n = null;
      if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") n = tabs[0];
      if (e.key === "End") n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); select(n, true); }
    });
  });
}

/* ---------- Météo (Open-Meteo, sans clé, appelée depuis le navigateur) ---------- */
const WMO = [
  [[0], "Ciel dégagé", "sun"], [[1], "Plutôt ensoleillé", "sun"], [[2], "Partiellement nuageux", "cloudsun"], [[3], "Couvert", "cloud"],
  [[45, 48], "Brouillard", "fog"], [[51, 53, 55, 56, 57], "Bruine", "rain"], [[61, 63, 65, 66, 67, 80, 81, 82], "Pluie", "rain"],
  [[71, 73, 75, 77, 85, 86], "Neige", "snow"], [[95, 96, 99], "Orage", "storm"],
];
function wmo(code) { return WMO.find(([c]) => c.includes(code)) || [[code], "Temps variable", "cloud"]; }
const WICON = {
  sun: '<circle cx="24" cy="24" r="9" fill="#E8A400"/><g stroke="#E8A400" stroke-width="3" stroke-linecap="round"><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.5 10.5l3.5 3.5M34 34l3.5 3.5M10.5 37.5 14 34M34 14l3.5-3.5"/></g>',
  cloudsun: '<circle cx="18" cy="18" r="8" fill="#E8A400"/><path d="M15 38h20a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 1 13Z" fill="#8A8F7E"/>',
  cloud: '<path d="M12 37h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0-1 15Z" fill="#8A8F7E"/>',
  fog: '<path d="M12 28h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0-1 15Z" fill="#8A8F7E"/><path d="M8 35h32M12 41h24" stroke="#8A8F7E" stroke-width="3" stroke-linecap="round"/>',
  rain: '<path d="M12 30h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0-1 15Z" fill="#8A8F7E"/><path d="m17 35-2 6M25 35l-2 6M33 35l-2 6" stroke="#1F5FA8" stroke-width="3" stroke-linecap="round"/>',
  snow: '<path d="M12 30h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0-1 15Z" fill="#8A8F7E"/><g fill="#1F5FA8"><circle cx="16" cy="38" r="2.2"/><circle cx="24" cy="41" r="2.2"/><circle cx="32" cy="38" r="2.2"/></g>',
  storm: '<path d="M12 28h24a9 9 0 0 0 0-18 12 12 0 0 0-23 3 7.5 7.5 0 0 0-1 15Z" fill="#5E6354"/><path d="M25 30l-6 9h6l-3 7 9-11h-6l3-5Z" fill="#E8A400"/>',
};
const wIcon = (k) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${WICON[k]}</svg>`;

export async function loadWeather(host, r) {
  const [lat, lon] = r.start;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Europe%2FParis&forecast_days=1`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    const d = j.daily;
    const day = (i) => new Date(d.time[i] + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const [, l0, ic0] = wmo(d.weather_code[0]);
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    host.innerHTML = `
      <div class="weather-today">
        ${wIcon(ic0)}
        <p class="w-day"><span class="vh">Aujourd'hui, </span>${cap(day(0))}<span class="w-label">${l0}</span></p>
        <dl class="w-vals">
          <div><dt><span class="tri up" aria-hidden="true">▲</span><span class="vh">Maximale</span></dt><dd class="tabular">${fr0(d.temperature_2m_max[0])} °C</dd></div>
          <div><dt><span class="tri" aria-hidden="true">▼</span><span class="vh">Minimale</span></dt><dd class="tabular">${fr0(d.temperature_2m_min[0])} °C</dd></div>
          <div><dt><span class="drop" aria-hidden="true"></span><span class="vh">Risque de pluie</span></dt><dd class="tabular">${d.precipitation_probability_max[0] ?? 0} %</dd></div>
        </dl>
      </div>
      <p class="src">Prévisions au point de départ (${esc(r.departure)}) par <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo<span class="vh"> (nouvelle fenêtre)</span></a>. Le temps change vite : vérifiez aussi Météo-France le jour J.</p>`;
  } catch {
    host.innerHTML = `<p><b>Météo indisponible.</b> Vérifiez votre connexion, ou consultez les prévisions de Météo-France avant de partir.</p>`;
  }
}

/* ---------- Questions fréquentes (réponses tirées des données) ---------- */
function text(h) { const d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent.trim(); }
export function faq(r, hasTransport) {
  const iMax = r.geom.reduce((b, p, i, a) => (p[2] > a[b][2] ? i : b), 0);
  const cum = cumulative(r.geom);
  const q = [
    [`Quelle est la difficulté de « ${r.name} » ?`, `Le niveau est « ${LEVELS[r.level]} ». Comptez ${dur(r.durationMin)} de marche pour ${fr1(r.km)} km et ${fr0(r.ascent)} m de dénivelé positif, sans les pauses.`],
    ["Est-ce une boucle ?", r.route === "Boucle" ? `Oui, c'est une boucle : vous revenez au point de départ, ${r.departure}.` : r.route === "Aller-retour" ? `Non, c'est un aller-retour : vous revenez par le même chemin jusqu'à ${r.departure}.` : `Non, c'est une traversée : le départ et l'arrivée ne sont pas au même endroit. Prévoyez le retour.`],
    ["Où commence la randonnée ?", `Au point de départ : ${r.departure}, à ${r.commune}. Coordonnées GPS : ${r.start[0].toFixed(5)}, ${r.start[1].toFixed(5)}.`],
    ["Où se garer ?", text(r.parking) || "Le gestionnaire n'indique pas de parking pour cet itinéraire. Garez-vous sur un emplacement autorisé près du départ."],
    ["Peut-on y aller en transports en commun ?", hasTransport ? text(r.transport) : "Aucune desserte n'est indiquée pour cet itinéraire. Renseignez-vous sur laregionvoustransporte.fr avant de partir."],
    ["Quel est le point le plus haut ?", `${fr0(r.maxEl)} m d'altitude, atteint vers le kilomètre ${fr1(cum[iMax])}. Le point le plus bas est à ${fr0(r.minEl)} m.`],
    ["Est-ce adapté aux enfants ?", r.level === 1 && r.km <= 6 ? "Oui : le parcours est court et facile. Gardez les enfants près de vous aux traversées de route." : r.level <= 2 && r.km <= 8 ? "Oui pour des enfants qui marchent régulièrement. Prévoyez des pauses." : "Plutôt pour des marcheurs habitués : le parcours est long ou exigeant."],
    ["D'où viennent ces informations ?", `${r.source.name}${r.source.provider ? ` (${r.source.provider})` : ""}. ${r.source.trace}.`],
  ];
  return `<div class="faq">${q.map(([a, b]) => `<details><summary>${esc(a)}</summary><div class="ans"><p>${esc(b)}</p></div></details>`).join("")}</div>`;
}
