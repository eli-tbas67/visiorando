// Profil altimétrique : SVG + curseur clavier + tableau de données (alternative textuelle).
import { fr1, fr0, km as dist } from "./utils.js";

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
 */
export function renderProfile(host, r, onMove) {
  const g = r.geom;
  const cum = cumulative(g);
  const total = cum[cum.length - 1];
  const zs = g.map((p) => p[2]);
  let lo = Math.min(...zs), hi = Math.max(...zs);
  if (hi - lo < 40) { const mid = (hi + lo) / 2; lo = mid - 20; hi = mid + 20; }
  const ys = niceStep(hi - lo, 4);
  const y0 = Math.floor(lo / ys) * ys, y1 = Math.ceil(hi / ys) * ys;
  const W = 720, H = 230, L = 58, R = 14, T = 14, B = 34;
  const X = (d) => L + (W - L - R) * (d / total);
  const Y = (z) => T + (H - T - B) * (1 - (z - y0) / (y1 - y0));
  const line = g.map((p, i) => `${i ? "L" : "M"}${X(cum[i]).toFixed(1)} ${Y(p[2]).toFixed(1)}`).join("");
  let grid = "";
  for (let v = y0; v <= y1 + 0.1; v += ys) {
    grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)" stroke-dasharray="3 4"/>` +
      `<text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="12" style="fill:var(--ink-2);font-family:var(--f-data)">${fr0(v)} m</text>`;
  }
  const xs = niceStep(total, 6);
  for (let d = 0; d <= total + 0.001; d += xs) {
    grid += `<line x1="${X(d)}" x2="${X(d)}" y1="${H - B}" y2="${H - B + 5}" style="stroke:var(--ink-2)"/>` +
      `<text x="${X(d)}" y="${H - B + 20}" text-anchor="middle" font-size="12" style="fill:var(--ink-2);font-family:var(--f-data)">${fr1(d)} km</text>`;
  }
  const iMax = zs.indexOf(Math.max(...zs));

  host.innerHTML = `
    <div class="profile">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="pf-desc">
        ${grid}
        <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" style="stroke:var(--ink-2)"/>
        <path d="${line}L${X(total)} ${H - B}L${L} ${H - B}Z" style="fill:var(--forest)" fill-opacity="0.18"/>
        <path d="${line}" fill="none" style="stroke:var(--forest)" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="${X(cum[iMax])}" cy="${Y(zs[iMax])}" r="4.5" style="fill:var(--surface);stroke:var(--forest)" stroke-width="2.5"/>
        <g class="pf-cursor" visibility="hidden">
          <line y1="${T}" y2="${H - B}" style="stroke:var(--ink)" stroke-width="1.5"/>
          <circle r="6" style="fill:#B3261E;stroke:var(--surface)" stroke-width="2.5"/>
        </g>
      </svg>
      <p id="pf-desc" class="muted">Profil d'altitude : de ${fr0(Math.min(...zs))} m à ${fr0(Math.max(...zs))} m, point haut à ${fr1(cum[iMax])} km, ${fr0(r.ascent)} m de dénivelé positif sur ${fr1(r.km)} km.</p>
      <label for="pf-pos">Parcourir le profil (flèches gauche et droite)</label>
      <input type="range" id="pf-pos" min="0" max="${g.length - 1}" step="1" value="0">
      <p class="readout" aria-hidden="true"><span>Distance : <b id="pf-d">0 km</b></span><span>Altitude : <b id="pf-z">${fr0(zs[0])} m</b></span></p>
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
  const cur = host.querySelector(".pf-cursor");
  const range = host.querySelector("#pf-pos");
  const out = { d: host.querySelector("#pf-d"), z: host.querySelector("#pf-z") };

  function set(i, fromPointer) {
    i = Math.max(0, Math.min(g.length - 1, i));
    const x = X(cum[i]), y = Y(zs[i]);
    cur.setAttribute("visibility", "visible");
    cur.querySelector("line").setAttribute("x1", x);
    cur.querySelector("line").setAttribute("x2", x);
    cur.querySelector("circle").setAttribute("cx", x);
    cur.querySelector("circle").setAttribute("cy", y);
    out.d.textContent = `${fr1(cum[i])} km`;
    out.z.textContent = `${fr0(zs[i])} m`;
    range.setAttribute("aria-valuetext", `${fr1(cum[i])} kilomètres, altitude ${fr0(zs[i])} mètres`);
    if (fromPointer) range.value = i;
    onMove?.(i);
  }
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
  svg.addEventListener("pointerleave", () => { cur.setAttribute("visibility", "hidden"); onMove?.(null); });
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
