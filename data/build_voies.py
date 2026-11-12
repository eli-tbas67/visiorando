"""Calcule les types de voies et les surfaces de chaque randonnée.

Source : OpenStreetMap (API Overpass). Pour chaque tronçon du tracé, on prend
la voie OSM la plus proche (à moins de 25 m) et on additionne les longueurs par
type de voie (tag highway) et par surface (tag surface).

Usage : python3 data/build_voies.py   ->  écrit data/voies.json
"""
import json, math, time, subprocess, pathlib

HERE = pathlib.Path(__file__).parent
OUT = HERE / "voies.json"
APIS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]

TYPES = {
    "path": "Sentier", "footway": "Sentier", "bridleway": "Sentier", "steps": "Escaliers",
    "track": "Chemin",
    "pedestrian": "Rue piétonne", "living_street": "Rue", "residential": "Rue", "service": "Rue",
    "unclassified": "Route", "tertiary": "Route", "secondary": "Route", "primary": "Route",
    "trunk": "Route", "tertiary_link": "Route", "secondary_link": "Route", "primary_link": "Route",
    "cycleway": "Piste cyclable",
}
SURF = {
    "asphalt": "Asphalte", "concrete": "Asphalte", "paved": "Pavé", "paving_stones": "Pavé", "sett": "Pavé",
    "cobblestone": "Pavé", "unhewn_cobblestone": "Pavé",
    "gravel": "Gravier", "fine_gravel": "Gravier", "compacted": "Gravier", "pebblestone": "Gravier",
    "unpaved": "Non pavé", "ground": "Non pavé", "dirt": "Non pavé", "earth": "Non pavé", "grass": "Non pavé",
    "mud": "Non pavé", "sand": "Non pavé", "rock": "Non pavé", "wood": "Non pavé",
}


def dist(a, b):
    r = 6371000
    la1, la2 = math.radians(a[0]), math.radians(b[0])
    dla, dlo = la2 - la1, math.radians(b[1] - a[1])
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def seg_dist(p, a, b):
    """Distance en mètres du point p au segment ab (projection plane locale)."""
    k = math.cos(math.radians(p[0])) * 111320
    ax, ay = (a[1] - p[1]) * k, (a[0] - p[0]) * 110540
    bx, by = (b[1] - p[1]) * k, (b[0] - p[0]) * 110540
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
    x, y = ax + t * dx, ay + t * dy
    return math.hypot(x, y)


def fetch(geom):
    # Requête légère : seulement les voies à moins de 25 m du tracé (et non tout le rectangle autour).
    pts, last = [], None
    for p in geom:
        if last is None or dist(last, p) >= 40:
            pts.append(p); last = p
    pts.append(geom[-1])
    line = ",".join(f"{p[0]:.5f},{p[1]:.5f}" for p in pts)
    q = f"[out:json][timeout:120];way[highway](around:25,{line});out tags geom;"
    for attempt in range(6):
        api = APIS[attempt % len(APIS)]
        try:
            # curl plutôt qu'urllib : le Python de macOS échoue parfois sur le TLS d'Overpass.
            out = subprocess.run(["curl", "-sf", "-m", "150", "-A", "visorando-maquette-cours/1.0",
                                  "--data-urlencode", f"data={q}", api], capture_output=True, check=True)
            return json.loads(out.stdout)["elements"]
        except Exception as e:  # noqa: BLE001
            print("  nouvel essai", attempt + 1, e)
            time.sleep(15 * (attempt + 1))
    raise RuntimeError("Overpass indisponible")


def densify(geom, step=20):
    out = []
    for a, b in zip(geom, geom[1:]):
        d = dist(a, b)
        n = max(1, int(d // step))
        for i in range(n):
            t = (i + 0.5) / n
            out.append(((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), d / n))
    return out


def classify(geom, ways):
    segs = []
    for w in ways:
        g = [(p["lat"], p["lon"]) for p in w.get("geometry", [])]
        for a, b in zip(g, g[1:]):
            segs.append((a, b, w["tags"]))
    types, surfs = {}, {}
    for p, length in densify(geom):
        best, bd = None, 25
        for a, b, tags in segs:
            if abs(a[0] - p[0]) > 0.0004 and abs(b[0] - p[0]) > 0.0004 and (a[0] - p[0]) * (b[0] - p[0]) > 0:
                continue
            d = seg_dist(p, a, b)
            if d < bd:
                best, bd = tags, d
        hw = best.get("highway") if best else None
        t = TYPES.get(hw, "Autre") if best else "Inconnu"
        s = SURF.get(best.get("surface", ""), None) if best else None
        if s is None:
            s = "Inconnu"
        types[t] = types.get(t, 0) + length
        surfs[s] = surfs.get(s, 0) + length
    rnd = lambda m: sorted(([k, round(v)] for k, v in m.items() if v >= 1), key=lambda kv: -kv[1])
    return {"types": rnd(types), "surfaces": rnd(surfs)}


def main():
    d = json.loads((HERE / "randos.json").read_text())
    out = json.loads(OUT.read_text()) if OUT.exists() else {}
    for r in d["randos"]:
        if r["id"] in out:
            continue
        print(r["id"], flush=True)
        ways = fetch(r["geom"])
        out[r["id"]] = classify(r["geom"], ways)
        OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
        time.sleep(4)
    print("ok", len(out))


if __name__ == "__main__":
    main()
