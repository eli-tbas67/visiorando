"""Cherche de vraies photos près de chaque point de passage.

Source : Wikimedia Commons (recherche géographique, rayon de 150 m).
Au plus 3 photos par point, jamais deux fois la même photo sur une fiche.
Quand Commons n'a rien près d'un point, le point reste sans photo.

Les points suivent la même logique que waypoints() dans assets/js/app.js :
étapes du fichier si elles existent, sinon départ, point haut, arrivée.

Usage : python3 data/build_points_photos.py  ->  écrit data/points-photos.json
"""
import html, json, pathlib, re, subprocess, time, urllib.parse

HERE = pathlib.Path(__file__).parent
OUT = HERE / "points-photos.json"
API = "https://commons.wikimedia.org/w/api.php"
SKIP = re.compile(r"(carte|map|plan|logo|blason|coat of arms|panneau|sign|\.svg|\.png|\.tif)", re.I)
# Sujets sans rapport avec la randonnée (testés sur le titre et la description)
OFFTOPIC = re.compile(r"(distributeur|bancaire|\batm\b|v[ée]lo'?v|voiture|\bcar\b|bus\b|poubelle|station-service|parking|chantier|travaux|int[ée]rieur|interior)", re.I)


def get(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            out = subprocess.run(["curl", "-sf", "-m", "40", "-A", "visorando-maquette-cours/1.0", url],
                                 capture_output=True, check=True)
            return json.loads(out.stdout)
        except Exception as e:  # noqa: BLE001
            print("  nouvel essai", attempt + 1, e)
            time.sleep(5)
    return {}


def clean(s, n=None):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    if n and len(s) > n:
        s = s[: n - 1].rsplit(" ", 1)[0] + "…"
    return s


def points(r):
    if r["steps"]:
        return [(s["lat"], s["lon"], s["name"]) for s in r["steps"]]
    g = r["geom"]
    last = len(g) - 1
    i_max = max(range(len(g)), key=lambda i: g[i][2])
    pts = [(g[0][0], g[0][1], r["departure"])]
    if 0 < i_max < last:
        pts.append((g[i_max][0], g[i_max][1], "point culminant"))
    pts.append((g[last][0], g[last][1], r.get("arrival") or r["departure"]))
    return pts


STOP = {"rue", "avenue", "boulevard", "place", "arrêt", "arret", "chemin", "route", "depuis", "point", "retour", "départ", "depart", "arrivée", "arrivee", "lyon", "mendès", "france"}


def words(*texts):
    return {w for t in texts for w in re.findall(r"[a-zà-ÿ]{4,}", (t or "").lower()) if w not in STOP}


def search(lat, lon, keys=frozenset()):
    d = get({
        "action": "query", "format": "json", "generator": "geosearch",
        "ggscoord": f"{lat}|{lon}", "ggsradius": 150, "ggsnamespace": 6, "ggslimit": 12,
        "prop": "imageinfo|coordinates", "iiprop": "url|extmetadata|mime", "iiurlwidth": 960,
    })
    pages = list(d.get("query", {}).get("pages", {}).values())
    # Les photos dont le titre cite le lieu passent devant ; sinon, la plus proche d'abord.
    pages.sort(key=lambda p: (-len(words(p["title"]) & keys), p.get("index", 99)))
    out = []
    for p in pages:
        ii = (p.get("imageinfo") or [{}])[0]
        desc = (ii.get("extmetadata", {}).get("ImageDescription", {}) or {}).get("value", "")
        if ii.get("mime") != "image/jpeg" or SKIP.search(p["title"]) or OFFTOPIC.search(p["title"] + " " + desc):
            continue
        md = ii.get("extmetadata", {})
        lic = clean(md.get("LicenseShortName", {}).get("value"))
        if not lic:
            continue
        name = clean(re.sub(r"^File:|\.[a-z]+$", "", p["title"], flags=re.I))
        thumb = ii.get("thumburl", "").split("?")[0]
        out.append({
            "src": thumb,
            "thumb": re.sub(r"/\d+px-", "/500px-", thumb),  # largeurs standard de Wikimedia uniquement
            "alt": clean(md.get("ImageDescription", {}).get("value"), 160) or name,
            "credit": clean(md.get("Artist", {}).get("value"), 80) or "Auteur inconnu",
            "license": lic,
            "licenseUrl": clean(md.get("LicenseUrl", {}).get("value")),
            "sourceUrl": ii.get("descriptionurl", ""),
            "source": "Wikimedia Commons",
        })
    return out


def main():
    d = json.loads((HERE / "randos.json").read_text())
    out = json.loads(OUT.read_text()) if OUT.exists() else {}
    for r in d["randos"]:
        if r["id"] in out:
            continue
        print(r["id"], flush=True)
        used, res = set(), []
        for lat, lon, name in points(r):
            keys = frozenset(words(name, r["name"], r["commune"]))
            got = [p for p in search(lat, lon, keys) if p["sourceUrl"] not in used][:3]
            used.update(p["sourceUrl"] for p in got)
            res.append(got)
            time.sleep(0.5)
        out[r["id"]] = res
        OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print("ok", len(out), "fiches,", sum(1 for v in out.values() for pts in v if pts), "points avec photos")


if __name__ == "__main__":
    main()
