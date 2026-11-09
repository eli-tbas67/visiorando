// Champ « Où voulez-vous randonner ? » : combobox ARIA 1.2 avec suggestions de lieux et de randonnées.
import { esc, norm } from "./utils.js";

/**
 * @param {HTMLInputElement} input
 * @param {HTMLUListElement} list
 * @param {(q: string) => {label: string, kind: string, value: any}[]} source
 * @param {(item) => void} onPick
 */
export function combobox(input, list, source, onPick) {
  let opts = [];
  let act = -1;
  const id = list.id;

  function render() {
    if (!opts.length) {
      list.innerHTML = '<li class="lb-empty" role="presentation">Aucune suggestion. Vous pouvez quand même lancer la recherche.</li>';
    } else {
      list.innerHTML = opts.map((o, i) =>
        `<li role="option" id="${id}-o${i}" aria-selected="false"><span>${esc(o.label)}</span><small>${esc(o.kind)}</small></li>`
      ).join("");
    }
  }
  function open() {
    const q = input.value.trim();
    opts = q.length ? source(q).slice(0, 8) : [];
    act = -1;
    if (!q.length) { close(); return; }
    render();
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
  }
  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    act = -1;
  }
  function move(d) {
    if (list.hidden) open();
    if (!opts.length) return;
    act = (act + d + opts.length) % opts.length;
    list.querySelectorAll('[role="option"]').forEach((li, i) => li.setAttribute("aria-selected", String(i === act)));
    input.setAttribute("aria-activedescendant", `${id}-o${act}`);
    document.getElementById(`${id}-o${act}`)?.scrollIntoView({ block: "nearest" });
  }
  function choose(i) {
    const o = opts[i];
    if (!o) return;
    input.value = o.fill ?? o.label;
    close();
    onPick(o);
  }

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", id);
  input.setAttribute("autocomplete", "off");
  list.setAttribute("role", "listbox");
  list.hidden = true;

  input.addEventListener("input", open);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (e.altKey) open(); else move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && !list.hidden && act > -1) { e.preventDefault(); choose(act); }
    else if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); } else if (input.value) { input.value = ""; } }
    else if (e.key === "Tab") close();
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest('[role="option"]');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.id.split("-o").pop()));
  });
  return { close };
}

/** Index de recherche : lieux + randonnées (par nom ou numéro). */
export function makeSource(places, randos) {
  const P = places.map((p) => ({ ...p, n: norm(p.name) }));
  const R = randos.map((r) => ({ r, n: norm(r.name + " " + r.commune) }));
  return (q) => {
    const nq = norm(q).replace(/^n\s*°?\s*/, "");
    const out = [];
    for (const p of P) {
      if (p.n.startsWith(nq) || p.n.includes(" " + nq) || p.n.includes(nq)) {
        out.push({ label: p.name, kind: "Lieu", value: p, type: "place", score: p.n.startsWith(nq) ? 0 : 1 });
      }
    }
    out.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label, "fr"));
    const hikes = [];
    for (const { r, n } of R) {
      if (r.ref === nq || n.includes(nq)) hikes.push({ label: r.name, kind: `Rando n° ${r.ref}`, value: r, type: "rando" });
    }
    return out.slice(0, 5).concat(hikes.slice(0, 5));
  };
}
