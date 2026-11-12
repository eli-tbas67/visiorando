// Profil altimétrique : SVG + curseur clavier + tableau de données (alternative textuelle).
import { fr1, fr0, km as dist, announce } from "./utils.js";

export function cumulative(geom) {
  const c = [0];
  for (let i = 1; i < geom.length; i++) c.push(c[i - 1] + dist(geom[i - 1], geom[i]));
  return c;
}

function niceStep(range, target) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

/**
 * @param {HTMLElement} host
 * @param {object} r randonnée
 * @param {(i:number|null) => void} onMove
 * @param {{km:number,label:string,name:string}[]} marks points de passage affichés au-dessus du profil
 */
export function renderProfile(host, r, onMove, marks = []) {
  const g = r.geom;
  const cum = cumulative(g);
  const total = cum[cum.length - 1];
  const zs = g.map((p) => p[2]);
  // Pente en % (moyenne glissante sur ~100 m pour lisser le bruit d'altitude)
  const slope = zs.map((_, i) => {
    let a = i, b = i;
    while (a > 0 && cum[i] - cum[a] < 0.05) a--;
    while (b < g.length - 1 && cum[b] - cum[i] < 0.05) b++;
    const dx = (cum[b] - cum[a]) * 1000;
    return dx > 1 ? ((zs[b] - zs[a]) / dx) * 100 : 0;
  });
  const iMax = zs.indexOf(Math.max(...zs));
  const iMin = zs.indexOf(Math.min(...zs));
  const W = 720, H = 250, L = 58, R = 14, T = 40, B = 34;
  const X = (d) => L + (W - L - R) * (d / total);
  // Bandes de pente (comme la maquette) : la couleur double une information aussi donnée en texte (légende + tableau).
  const SLOPES = [[15, "#C8442F", "plus de 15 %"], [10, "#E8875A", "10 à 15 %"], [5, "#F4C08E", "5 à 10 %"]];
  let mode = "alt";
  let Y = null;

  function svgInner() {
    const vals = mode === "alt" ? zs : slope;
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const minSpan = mode === "alt" ? 40 : 10;
    if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    const ys = niceStep(hi - lo, 4);
    const y0 = Math.floor(lo / ys) * ys, y1 = Math.ceil(hi / ys) * ys;
    Y = (v) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
    const unit = mode === "alt" ? " m" : " %";
    const base = mode === "alt" ? H - B : Y(Math.max(y0, Math.min(y1, 0)));
    const line = vals.map((v, i) => `${i ? "L" : "M"}${X(cum[i]).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
    let grid = "";
    for (let v = y0; v <= y1 + 1e-6; v += ys) {
      grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line-strong)" stroke-dasharray="3 4"/>` +
        `<text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12" style="fill:var(--ink-2);font-family:var(--f-data)">${fr0(v)}${unit}</text>`;
    }
    const xs = niceStep(total, 6);
    for (let d = 0; d <= total + 0.001; d += xs) {
      grid += `<line x1="${X(d)}" x2="${X(d)}" y1="${T}" y2="${H - B}" style="stroke:var(--line)" stroke-dasharray="3 4"/>` +
        `<text x="${X(d)}" y="${H - B + 20}" text-anchor="middle" font-size="12" style="fill:var(--ink-2);font-family:var(--f-data)">${fr1(d)} km</text>`;
    }
    let bands = "";
    for (let i = 1; i < g.length; i++) {
      const s = Math.abs(slope[i]);
      const c = SLOPES.find(([min]) => s >= min);
      if (!c) continue;
      const xa = X(cum[i - 1]).toFixed(1), xb = X(cum[i]).toFixed(1);
      bands += `<path d="M${xa} ${Y(vals[i - 1]).toFixed(1)}L${xb} ${Y(vals[i]).toFixed(1)}L${xb} ${base}L${xa} ${base}Z" fill="${c[1]}" fill-opacity="0.55"/>`;
    }
    const pins = marks.map((m) => `<g><line x1="${X(m.km)}" x2="${X(m.km)}" y1="22" y2="${H - B}" style="stroke:var(--ink-2)" stroke-width="1" stroke-dasharray="2 3"/><circle cx="${X(m.km)}" cy="14" r="10" fill="#1B2111"/><text x="${X(m.km)}" y="18.5" text-anchor="middle" font-size="12" font-weight="700" fill="#FFFFFF">${m.label}</text></g>`).join("");
    const extremes = mode === "alt"
      ? `<path d="M${X(cum[iMax])} ${Y(zs[iMax]) - 18}l-6 10h12Z" fill="#C8442F"/><path d="M${X(cum[iMin])} ${Y(zs[iMin]) - 8}l-6 -10h12Z" fill="#5E8A1E"/>`
      : "";
    return `${grid}${pins}
        <line x1="${L}" x2="${W - R}" y1="${base}" y2="${base}" style="stroke:var(--ink-2)"/>
        <path d="${line}L${X(total)} ${base}L${L} ${base}Z" fill="#DCEBC4" fill-opacity="0.75"/>
        ${bands}
        <path d="${line}" fill="none" stroke="#5E8A1E" stroke-width="2.6" stroke-linejoin="round"/>
        ${extremes}
        <g class="pf-cursor" visibility="hidden">
          <line y1="${T}" y2="${H - B}" style="stroke:var(--ink)" stroke-width="1.5"/>
          <circle r="6" style="fill:#B3261E;stroke:var(--surface)" stroke-width="2.5"/>
        </g>`;
  }

  host.innerHTML = `
    <div class="profile">
      <div class="pf-head">
        <label for="pf-mode" class="vh">Afficher le profil</label>
        <span class="pf-select"><select id="pf-mode"><option value="alt">Élévation</option><option value="pente">Pente</option></select></span>
        <p class="muted" id="pf-hint">Survolez le profil ou utilisez le curseur sous le graphique pour suivre le tracé sur la carte.</p>
      </div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="pf-desc">${svgInner()}</svg>
      <ul class="pf-legend">
        <li><span class="tri" style="color:#C8442F" aria-hidden="true">▲</span> <b>Point culminant</b> <span class="tabular">(${fr0(zs[iMax])} m, km ${fr1(cum[iMax])})</span></li>
        <li><span class="tri" style="color:#5E8A1E" aria-hidden="true">▼</span> <b>Point le plus bas</b> <span class="tabular">(${fr0(zs[iMin])} m, km ${fr1(cum[iMin])})</span></li>
        ${SLOPES.slice().reverse().map(([, c, t]) => `<li><span class="sw" style="background:${c}" aria-hidden="true"></span> Pente ${t}</li>`).join("")}
      </ul>
      <p id="pf-desc" class="muted">Profil d'altitude : de ${fr0(Math.min(...zs))} m à ${fr0(Math.max(...zs))} m, point haut à ${fr1(cum[iMax])} km, ${fr0(r.ascent)} m de dénivelé positif sur ${fr1(r.km)} km.${marks.length ? " Les pastilles numérotées au-dessus du profil sont les points de passage." : ""}</p>
      <label for="pf-pos">Parcourir le profil (flèches gauche et droite)</label>
      <input type="range" id="pf-pos" min="0" max="${g.length - 1}" step="1" value="0">
      <p class="readout" aria-hidden="true"><span>Distance : <b id="pf-d">0 km</b></span><span>Altitude : <b id="pf-z">${fr0(zs[0])} m</b></span><span>Pente : <b id="pf-s">${fr0(slope[0])} %</b></span></p>
      <details class="data">
        <summary>Voir les altitudes dans un tableau</summary>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Tableau des altitudes">
          <table>
            <caption class="vh">Altitude tous les ${fr1(niceStep(total, 20))} km</caption>
            <thead><tr><th scope="col" class="num">Distance</th><th scope="col" class="num">Altitude</th></tr></thead>
            <tbody>${tableRows(cum, zs, total)}</tbody>
          </table>
        </div>
      </details>
    </div>`;

  const svg = host.querySelector("svg");
  const range = host.querySelector("#pf-pos");
  const out = { d: host.querySelector("#pf-d"), z: host.querySelector("#pf-z"), s: host.querySelector("#pf-s") };
  const vals = () => (mode === "alt" ? zs : slope);

  function set(i, fromPointer) {
    i = Math.max(0, Math.min(g.length - 1, i));
    const cur = host.querySelector(".pf-cursor");
    const x = X(cum[i]), y = Y(vals()[i]);
    cur.setAttribute("visibility", "visible");
    cur.querySelector("line").setAttribute("x1", x);
    cur.querySelector("line").setAttribute("x2", x);
    cur.querySelector("circle").setAttribute("cx", x);
    cur.querySelector("circle").setAttribute("cy", y);
    out.d.textContent = `${fr1(cum[i])} km`;
    out.z.textContent = `${fr0(zs[i])} m`;
    out.s.textContent = `${fr0(slope[i])} %`;
    range.setAttribute("aria-valuetext", `${fr1(cum[i])} kilomètres, altitude ${fr0(zs[i])} mètres, pente ${fr0(slope[i])} %`);
    if (fromPointer) range.value = i;
    onMove?.(i);
  }
  host.querySelector("#pf-mode").addEventListener("change", (e) => {
    mode = e.target.value;
    svg.innerHTML = svgInner();
    announce(mode === "alt" ? "Le graphique affiche l'altitude." : "Le graphique affiche la pente en pourcentage.");
  });
  range.addEventListener("input", () => set(+range.value, false));
  range.addEventListener("focus", () => set(+range.value, false));
  const nearest = (ev) => {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const d = ((p.x - L) / (W - L - R)) * total;
    let best = 0, bd = Infinity;
    for (let i = 0; i < cum.length; i++) { const dd = Math.abs(cum[i] - d); if (dd < bd) { bd = dd; best = i; } }
    return best;
  };
  svg.addEventListener("pointermove", (e) => set(nearest(e), true));
  svg.addEventListener("pointerleave", () => { host.querySelector(".pf-cursor").setAttribute("visibility", "hidden"); onMove?.(null); });
  range.setAttribute("aria-valuetext", `0 kilomètre, altitude ${fr0(zs[0])} mètres`);
  return { set };
}

function tableRows(cum, zs, total) {
  const step = niceStep(total, 20);
  let rows = "", next = 0;
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] + 1e-9 >= next || i === cum.length - 1) {
      rows += `<tr><td class="num tabular">${fr1(cum[i])} km</td><td class="num tabular">${fr0(zs[i])} m</td></tr>`;
      next = (Math.floor(cum[i] / step) + 1) * step;
    }
  }
  return rows;
}
