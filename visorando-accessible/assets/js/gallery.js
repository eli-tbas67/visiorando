// Galerie photo de la fiche + visionneuse plein écran (dialog, flèches, Échap).
import { $, esc, ICONS, announce, trapFocus } from "./utils.js";

export function credit(p) {
  const lic = p.licenseUrl ? `<a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener">${esc(p.license)}<span class="vh"> (nouvelle fenêtre)</span></a>` : esc(p.license || "");
  const src = p.sourceUrl ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">${esc(p.source)}<span class="vh"> (nouvelle fenêtre)</span></a>` : esc(p.source || "");
  return `Photo : ${esc(p.credit)}${lic ? " · " + lic : ""}${src ? " · " + src : ""}`;
}

export function galleryHTML(r) {
  const ph = r.photos;
  if (!ph.length) return "";
  const btn = (i, cls, extra = "") => `<button type="button" class="${cls}" data-lb="${i}" aria-label="Agrandir la photo ${i + 1} sur ${ph.length} : ${esc(ph[i].alt)}">
      <img src="${esc(i === 0 ? ph[i].src : ph[i].thumb)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} data-fallback="${esc(r.id + i)}">${extra}</button>`;
  const side = ph.slice(1, 3).map((_, k) => {
    const i = k + 1;
    const last = i === Math.min(2, ph.length - 1);
    return btn(i, "", last ? `<span class="g-count" aria-hidden="true">${ICONS.camera} ${ph.length} photos</span>` : "");
  }).join("");
  return `
  <section aria-label="Photos de la randonnée">
    <div class="gallery" ${ph.length === 1 ? 'style="grid-template-columns:1fr"' : ""}>
      <div class="g-main">${btn(0, "", ph.length === 1 ? `<span class="g-count" aria-hidden="true">${ICONS.camera} 1 photo</span>` : "")}</div>
      ${ph.length > 1 ? `<div class="g-side" ${ph.length === 2 ? 'style="grid-template-rows:1fr"' : ""}>${side}</div>` : ""}
    </div>
    <p class="credit">${credit(ph[0])}${ph.length > 1 ? " · Crédits des autres photos dans la visionneuse" : ""}</p>
  </section>`;
}

export function wireGallery(root, r) {
  root.querySelectorAll(".gallery [data-lb]").forEach((b) => b.addEventListener("click", () => openLightbox(r, +b.dataset.lb, b)));
}

export function openLightbox(r, start, opener) {
  const dlg = $("#lightbox");
  const ph = r.photos;
  let i = start;
  dlg.innerHTML = `
    <div class="dlg">
      <div class="dlg-head">
        <h2 id="lb-title" style="font-size:1.25rem">${esc(r.name)}</h2>
        <button type="button" class="close-btn" data-close>${ICONS.close} Fermer</button>
      </div>
      <div class="lb-stage"><img id="lb-img" alt=""></div>
      <div class="lb-nav">
        <button type="button" class="btn btn-sm" data-prev>${ICONS.prev} Photo précédente</button>
        <p id="lb-count" aria-live="polite" class="tabular"></p>
        <button type="button" class="btn btn-sm" data-next>Photo suivante ${ICONS.next}</button>
      </div>
      <p class="lb-cap" id="lb-cap"></p>
    </div>`;
  const img = $("#lb-img", dlg);
  function show() {
    const p = ph[i];
    img.src = p.src; img.alt = p.alt;
    $("#lb-count", dlg).textContent = `Photo ${i + 1} sur ${ph.length}`;
    $("#lb-cap", dlg).innerHTML = `${esc(p.alt)}<br>${credit(p)}`;
  }
  const many = ph.length > 1;
  $("[data-prev]", dlg).hidden = !many;
  $("[data-next]", dlg).hidden = !many;
  $("[data-prev]", dlg).addEventListener("click", () => { i = (i - 1 + ph.length) % ph.length; show(); });
  $("[data-next]", dlg).addEventListener("click", () => { i = (i + 1) % ph.length; show(); });
  $("[data-close]", dlg).addEventListener("click", () => dlg.close());
  const ac = new AbortController();
  trapFocus(dlg, ac.signal);
  dlg.addEventListener("keydown", (e) => {
    if (!many) return;
    if (e.key === "ArrowLeft") { i = (i - 1 + ph.length) % ph.length; show(); }
    if (e.key === "ArrowRight") { i = (i + 1) % ph.length; show(); }
  }, { signal: ac.signal });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }, { signal: ac.signal });
  dlg.addEventListener("close", () => { ac.abort(); opener?.focus(); }, { signal: ac.signal });
  show();
  dlg.showModal();
  $("[data-close]", dlg).focus();
}
