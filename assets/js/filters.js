// Panneau « Filtres » : <dialog> natif (focus piégé, Échap, retour au bouton) + curseurs nommés avec unité.
import { $, $$, esc, dur, durSpoken, fr0, LEVELS, TAGS, randos, announce, ICONS, trapFocus } from "./utils.js";

export const DEFAULTS = Object.freeze({ dur: 480, km: 30, dp: 800, lv: [1, 2, 3, 4], ty: ["Boucle", "Aller-retour", "Traversée"], tags: [] });
export const TYPES = ["Boucle", "Aller-retour", "Traversée"];

export function clone(f) { return JSON.parse(JSON.stringify(f)); }

export function fromParams(p) {
  const f = clone(DEFAULTS);
  if (p.get("dmax")) f.dur = clamp(+p.get("dmax"), 30, 480);
  if (p.get("kmax")) f.km = clamp(+p.get("kmax"), 1, 30);
  if (p.get("dpmax")) f.dp = clamp(+p.get("dpmax"), 0, 800);
  if (p.get("niv")) f.lv = p.get("niv").split(",").map(Number).filter((n) => n >= 1 && n <= 4);
  if (p.get("type")) f.ty = p.get("type").split(",").filter((t) => TYPES.includes(t));
  if (p.get("tags")) f.tags = p.get("tags").split(",").filter((t) => TAGS[t]);
  return f;
}
export function toParams(f, p) {
  ["dmax", "kmax", "dpmax", "niv", "type", "tags"].forEach((k) => p.delete(k));
  if (f.dur < DEFAULTS.dur) p.set("dmax", f.dur);
  if (f.km < DEFAULTS.km) p.set("kmax", f.km);
  if (f.dp < DEFAULTS.dp) p.set("dpmax", f.dp);
  if (f.lv.length < 4) p.set("niv", f.lv.join(","));
  if (f.ty.length < TYPES.length) p.set("type", f.ty.join(","));
  if (f.tags.length) p.set("tags", f.tags.join(","));
  return p;
}
function clamp(v, a, b) { return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : b; }

export function matches(r, f) {
  return r.durationMin <= f.dur && r.km <= f.km && r.ascent <= f.dp &&
    f.lv.includes(r.level) && f.ty.includes(r.route) && f.tags.every((t) => r.tags.includes(t));
}

export function active(f) {
  const a = [];
  if (f.dur < DEFAULTS.dur) a.push({ k: "dur", label: `Durée ≤ ${dur(f.dur)}` });
  if (f.km < DEFAULTS.km) a.push({ k: "km", label: `Distance ≤ ${f.km} km` });
  if (f.dp < DEFAULTS.dp) a.push({ k: "dp", label: `Dénivelé ≤ ${fr0(f.dp)} m` });
  if (f.lv.length < 4) a.push({ k: "lv", label: f.lv.length ? `Niveau : ${f.lv.map((l) => LEVELS[l]).join(", ")}` : "Aucun niveau" });
  if (f.ty.length < TYPES.length) a.push({ k: "ty", label: f.ty.length ? f.ty.join(" ou ") : "Aucun type" });
  f.tags.forEach((t) => a.push({ k: "tag:" + t, label: TAGS[t] }));
  return a;
}
export function removeOne(f, k) {
  const g = clone(f);
  if (k.startsWith("tag:")) g.tags = g.tags.filter((t) => t !== k.slice(4));
  else if (k === "dur") g.dur = DEFAULTS.dur;
  else if (k === "km") g.km = DEFAULTS.km;
  else if (k === "dp") g.dp = DEFAULTS.dp;
  else if (k === "lv") g.lv = [...DEFAULTS.lv];
  else if (k === "ty") g.ty = [...DEFAULTS.ty];
  return g;
}
export function summary(f) {
  const a = active(f);
  return a.length ? `${a.length} ${a.length > 1 ? "filtres actifs" : "filtre actif"} : ${a.map((x) => x.label).join(", ")}` : "Aucun filtre actif";
}

/**
 * Ouvre le panneau.
 * @param {object} o { filters, opener, count(f) -> number, onApply(f) }
 */
export function openFilters(o) {
  const dlg = $("#filters");
  dlg.innerHTML = `
  <form method="dialog" class="dlg" id="filters-form" novalidate>
    <div class="dlg-head">
      <h2 id="h-filtres">Filtres</h2>
      <button type="button" class="close-btn" data-close>${ICONS.close} Fermer</button>
    </div>
    <div class="dlg-body">
      <div class="fix-row" style="padding-top:12px"><span class="fix" aria-hidden="true">7.1 dialog nommé</span><span class="fix" aria-hidden="true">7.3 + 12.8 focus piégé, Échap</span><span class="fix" aria-hidden="true">11.1 curseurs nommés avec unité</span></div>
      <div class="field">
        <div class="field-top"><label for="f-dur">Durée maximale</label><output for="f-dur" id="o-dur"></output></div>
        <input type="range" id="f-dur" min="30" max="480" step="15">
        <div class="scale" aria-hidden="true"><span>30 min</span><span>8 h</span></div>
      </div>
      <div class="field">
        <div class="field-top"><label for="f-km">Distance maximale</label><output for="f-km" id="o-km"></output></div>
        <input type="range" id="f-km" min="1" max="30" step="1">
        <div class="scale" aria-hidden="true"><span>1 km</span><span>30 km</span></div>
      </div>
      <div class="field">
        <div class="field-top"><label for="f-dp">Dénivelé positif maximal</label><output for="f-dp" id="o-dp"></output></div>
        <input type="range" id="f-dp" min="0" max="800" step="25">
        <div class="scale" aria-hidden="true"><span>0 m</span><span>800 m</span></div>
      </div>
      <fieldset class="field">
        <legend>Niveau de difficulté</legend>
        <div class="checks">${[1, 2, 3, 4].map((l) => `<label><input type="checkbox" name="lv" value="${l}"> ${LEVELS[l]}</label>`).join("")}</div>
      </fieldset>
      <fieldset class="field">
        <legend>Type de parcours</legend>
        <div class="checks">${TYPES.map((t) => `<label><input type="checkbox" name="ty" value="${esc(t)}"> ${esc(t)}</label>`).join("")}</div>
      </fieldset>
      <fieldset class="field" style="border-bottom:0">
        <legend>Envies <span class="muted" style="font-weight:400">(toutes doivent correspondre)</span></legend>
        <div class="checks">${Object.entries(TAGS).map(([k, v]) => `<label><input type="checkbox" name="tags" value="${k}"> ${esc(v)}</label>`).join("")}</div>
      </fieldset>
    </div>
    <div class="dlg-foot">
      <button type="button" class="btn btn-outline btn-sm" data-reset>Réinitialiser</button>
      <button type="button" class="btn btn-primary btn-sm" data-apply></button>
    </div>
    <p class="vh" role="status" aria-live="polite" id="filters-count"></p>
  </form>`;

  const fDur = $("#f-dur", dlg), fKm = $("#f-km", dlg), fDp = $("#f-dp", dlg), apply = $("[data-apply]", dlg);

  function sync(f) {
    fDur.value = f.dur; fKm.value = f.km; fDp.value = f.dp;
    $$('input[name="lv"]', dlg).forEach((c) => (c.checked = f.lv.includes(+c.value)));
    $$('input[name="ty"]', dlg).forEach((c) => (c.checked = f.ty.includes(c.value)));
    $$('input[name="tags"]', dlg).forEach((c) => (c.checked = f.tags.includes(c.value)));
    update(false);
  }
  function read() {
    return {
      dur: +fDur.value, km: +fKm.value, dp: +fDp.value,
      lv: $$('input[name="lv"]:checked', dlg).map((c) => +c.value),
      ty: $$('input[name="ty"]:checked', dlg).map((c) => c.value),
      tags: $$('input[name="tags"]:checked', dlg).map((c) => c.value),
    };
  }
  let t;
  function update(speak) {
    const f = read();
    const max = (v, d) => v >= d;
    $("#o-dur", dlg).textContent = max(f.dur, DEFAULTS.dur) ? "sans limite" : `jusqu'à ${dur(f.dur)}`;
    fDur.setAttribute("aria-valuetext", max(f.dur, DEFAULTS.dur) ? "sans limite" : `jusqu'à ${durSpoken(f.dur)}`);
    $("#o-km", dlg).textContent = max(f.km, DEFAULTS.km) ? "sans limite" : `jusqu'à ${f.km} km`;
    fKm.setAttribute("aria-valuetext", max(f.km, DEFAULTS.km) ? "sans limite" : `jusqu'à ${f.km} kilomètres`);
    $("#o-dp", dlg).textContent = max(f.dp, DEFAULTS.dp) ? "sans limite" : `jusqu'à ${fr0(f.dp)} m`;
    fDp.setAttribute("aria-valuetext", max(f.dp, DEFAULTS.dp) ? "sans limite" : `jusqu'à ${f.dp} mètres`);
    const n = o.count(f);
    apply.textContent = n ? `Afficher ${randos(n)}` : "Aucune randonnée : élargissez les filtres";
    apply.disabled = false;
    if (speak) { clearTimeout(t); t = setTimeout(() => { $("#filters-count", dlg).textContent = `${randos(n)} avec ces filtres.`; }, 650); }
  }

  const ac = new AbortController();
  const sig = { signal: ac.signal };
  sync(o.filters);
  trapFocus(dlg, ac.signal);
  dlg.addEventListener("input", () => update(true), sig);
  dlg.addEventListener("change", () => update(true), sig);
  $("[data-close]", dlg).addEventListener("click", () => dlg.close("cancel"));
  $("[data-reset]", dlg).addEventListener("click", () => { sync(clone(DEFAULTS)); update(true); fDur.focus(); });
  apply.addEventListener("click", () => { const f = read(); dlg.close("apply"); o.onApply(f); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close("cancel"); }, sig);
  dlg.addEventListener("close", () => {
    ac.abort();
    // Retour du focus sur le bouton qui a ouvert le panneau (RGAA 12.8).
    if (dlg.returnValue !== "apply") {
      if (o.opener?.isConnected) o.opener.focus();
      announce("Filtres fermés sans modification.");
    }
  }, sig);

  dlg.returnValue = "";
  dlg.showModal();
  fDur.focus();
}
