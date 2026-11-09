"""Construit site/data/randos.json à partir des données collectées.

Sources :
- Geotrek Auvergne-Rhône-Alpes Tourisme (API publique) : 38 itinéraires, tracés, photos, textes.
- 6 balades lyonnaises : tracés calculés sur OpenStreetMap (OSRM, profil piéton),
  altitudes IGN (RGE ALTI), photos Wikimedia Commons, textes rédigés pour la maquette.
"""
import json, math, re, html

G = json.load(open('/home/claude/data/geotrek.json'))
L = json.load(open('/home/claude/data/lyon.json'))
C = json.load(open('/home/claude/data/commons.json'))

COMMUNES = {
    "42018": "Bessey", "42056": "Chavanay", "42085": "Doizieux", "42093": "Farnay", "42101": "Graix",
    "42168": "Pélussin", "42191": "Roisey", "42210": "Sainte-Croix-en-Jarez", "42218": "Saint-Étienne",
    "42242": "Saint-Joseph", "42265": "Saint-Michel-sur-Rhône", "42271": "Saint-Paul-en-Jarez",
    "42287": "Saint-Sauveur-en-Rue", "42322": "La Valla-en-Gier", "42326": "Véranne",
    "69064": "Condrieu", "69080": "Échalas", "69119": "Longes", "69252": "Trèves",
}
DEPTS = {"42": "Loire", "69": "Rhône"}
# Geotrek : id de difficulté -> (niveau 1..4, libellé)
DIFF = {2: 1, 3: 2, 6: 3, 1: 4}
ROUTE = {1: "Boucle", 2: "Aller-retour", 3: "Traversée", None: "Boucle"}


def hav(a, b):
    """a, b = [lon, lat]"""
    R = 6371000.0
    t = math.pi / 180
    dl = (b[1] - a[1]) * t
    dg = (b[0] - a[0]) * t
    x = math.sin(dl / 2) ** 2 + math.cos(a[1] * t) * math.cos(b[1] * t) * math.sin(dg / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def smooth(z, w=2):
    out = []
    for i in range(len(z)):
        s = z[max(0, i - w): i + w + 1]
        out.append(sum(s) / len(s))
    return out


def gain(z, thr=2.0):
    up = down = 0.0
    ref = z[0]
    for v in z[1:]:
        if v - ref >= thr:
            up += v - ref
            ref = v
        elif ref - v >= thr:
            down += ref - v
            ref = v
    return round(up), round(down)


def dp(pts, eps):
    """Douglas-Peucker sur [lon, lat, z], tolérance en degrés."""
    if len(pts) < 3:
        return pts
    x1, y1 = pts[0][0], pts[0][1]
    x2, y2 = pts[-1][0], pts[-1][1]
    kx = math.cos(y1 * math.pi / 180)
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        x, y = pts[i][0], pts[i][1]
        A, B = (x2 - x1) * kx, y2 - y1
        Cc, D = (x - x1) * kx, y - y1
        L2 = A * A + B * B
        t = ((A * Cc + B * D) / L2) if L2 else 0
        t = max(0, min(1, t))
        d = math.hypot(Cc - A * t, D - B * t)
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return dp(pts[: idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [pts[0], pts[-1]]


def text_of(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h or ""))).strip()


def tidy_html(h):
    if not h:
        return ""
    h = re.sub(r"(<br>\s*){2,}", "</p><p>", h)
    h = re.sub(r"<p>\s*(<br>\s*)+", "<p>", h)
    h = re.sub(r"(<br>\s*)+</p>", "</p>", h)
    h = re.sub(r"<p>\s*</p>", "", h)
    # liens bruts -> texte (on ne fait pas de lien vers des sites tiers non vérifiés)
    return h.strip()


def commons(key, idx, alt):
    p = C[key][idx]
    url = p["thumb"].split("?")[0]
    big = re.sub(r"/\d+px-", "/1280px-", url) if "/thumb/" in url else url
    small = re.sub(r"/\d+px-", "/960px-", url) if "/thumb/" in url else url
    return {
        "src": big,
        "thumb": small,
        "alt": alt,
        "credit": re.sub(r"\s+", " ", p["artist"]).strip() or "Auteur inconnu",
        "license": p["lic"],
        "licenseUrl": p["licUrl"],
        "sourceUrl": p["page"],
        "source": "Wikimedia Commons",
    }


def tags_for(r, blob):
    t = set()
    b = blob.lower()
    if r["km"] <= 6 and r["level"] <= 2:
        t.add("famille")
    if any(w in b for w in ["cascade", "rivière", "ruisseau", "barrage", "lône", "rhône", "saône", "gier", "étang", "castor", "fleuve"]):
        t.add("eau")
    if any(w in b for w in ["vue", "panorama", "crêt", "sommet", "table d'orientation", "point de vue", "belvédère"]):
        t.add("vue")
    if any(w in b for w in ["chapelle", "église", "château", "chartreuse", "aqueduc", "romain", "patrimoine", "croix", "musée", "abbaye", "historique", "moulin"]):
        t.add("patrimoine")
    if r.get("transport"):
        t.add("transports")
    return sorted(t)


out = []

# ---------- Geotrek ----------
for t in G:
    code = t["depCityCode"] or (t["cityCodes"] or [""])[0]
    commune = COMMUNES.get(code, "")
    dept = code[:2]
    geom = t["geom"]
    z = [p[2] for p in geom]
    level = DIFF.get(t["difficulty"], 2)
    name = re.sub(r"\s+", " ", t["name"]).strip()
    name = name.replace(" n° ", " n°").replace("n°", "n° ").replace("n°  ", "n° ")
    photos = []
    for i, p in enumerate(t["photos"]):
        alt = p["legend"] or p["title"] or ""
        photos.append({
            "src": p["url"], "thumb": p["thumb"],
            "alt": alt[:1].upper() + alt[1:] if alt else f"Paysage sur l'itinéraire « {name} »",
            "credit": (p["author"] or "").replace("©", "").strip() or t["provider"] or "Geotrek",
            "license": "Droits réservés à l'auteur, diffusé par Geotrek Auvergne-Rhône-Alpes",
            "licenseUrl": "", "sourceUrl": "", "source": "Geotrek Auvergne-Rhône-Alpes",
        })
    r = {
        "id": t["id"],
        "num": t["srcId"],
        "name": name,
        "commune": commune,
        "dept": {"code": dept, "name": DEPTS.get(dept, "")},
        "massif": "Massif du Pilat" if t["provider"] == "PNRPILAT" or dept == "42" else "Vallée du Rhône",
        "departure": t["departure"],
        "start": [t["start"][1], t["start"][0]],
        "level": level,
        "route": ROUTE.get(t["route"], "Boucle"),
        "km": round(t["km"], 2),
        "durationMin": int(round(float(t["duration"]) * 60 / 5) * 5),
        "ascent": int(t["ascent"]),
        "descent": abs(int(t["descent"])),
        "minEl": int(t["minEl"]),
        "maxEl": int(t["maxEl"]),
        "geom": [[p[1], p[0], p[2]] for p in geom],
        "photos": photos,
        "teaser": tidy_html(t["teaser"]),
        "ambiance": tidy_html(t["ambiance"]),
        "description": tidy_html(t["description"]),
        "steps": [],
        "access": tidy_html(t["access"]),
        "parking": tidy_html(t["parking"]),
        "transport": tidy_html(t["transport"]),
        "advice": tidy_html(t["advice"]),
        "themes": t["themes"],
        "source": {
            "name": "Geotrek Auvergne-Rhône-Alpes Tourisme",
            "provider": "Parc naturel régional du Pilat" if t["provider"] == "PNRPILAT" else (t["provider"] or ""),
            "gpx": t["gpx"], "pdf": t["pdf"], "updated": (t["updated"] or "")[:10],
            "trace": "Tracé officiel de l'itinéraire balisé",
        },
    }
    blob = " ".join([name, text_of(r["ambiance"]), text_of(r["description"]), text_of(r["teaser"])])
    r["tags"] = tags_for(r, blob)
    out.append(r)

# ---------- Balades lyonnaises ----------
LY = {
    "tony-garnier": dict(
        name="Murs peints de Lyon : Tony Garnier", commune="Lyon 8e", dept="69", massif="Lyon",
        departure="Arrêt de tram Jet d'Eau – Mendès France (T2)", level=1, extra=15,
        wp=["Arrêt Jet d'Eau – Mendès France", "Rue Paul Cazeneuve", "Musée urbain Tony Garnier", "Rue Joseph Chapelle", "Rue Émile Combes", "Boulevard des États-Unis", "Arrêt Jet d'Eau – Mendès France"],
        steps=[
            "Depuis l'arrêt de tram, longez le cimetière vers l'est-sud-est jusqu'au croisement de l'avenue Berthelot et du boulevard des États-Unis.",
            "Prenez à droite la rue Paul Cazeneuve : les premières fresques de la « Cité industrielle » apparaissent sur les pignons des immeubles.",
            "Passez devant l'entrée du musée urbain Tony Garnier, qui présente un appartement témoin des années 1930.",
            "Suivez la rue Joseph Chapelle vers l'est en gardant les murs peints sur votre gauche.",
            "Revenez vers l'ouest par la rue Émile Combes pour voir les fresques des « cités idéales » du monde.",
            "Rejoignez le boulevard des États-Unis puis l'avenue Berthelot pour retrouver l'arrêt de tram.",
        ],
        ambiance="Une balade urbaine et plate dans le quartier des États-Unis, au milieu des 25 murs peints qui racontent la Cité industrielle imaginée par l'architecte lyonnais Tony Garnier.",
        description="La cité Tony Garnier est un ensemble de logements sociaux construit dans les années 1920 et 1930. À partir de 1991, ses habitants et la coopérative CitéCréation ont recouvert les pignons de fresques monumentales. L'itinéraire suit les rues de la cité pour passer devant chacune d'elles. Le parcours n'est pas balisé : gardez la carte ouverte.",
        access="Tram T2 depuis Perrache, direction Saint-Priest Bel Air, arrêt Jet d'Eau – Mendès France.",
        parking="Stationnement payant dans les rues du quartier ; préférez les transports en commun.",
        transport="Tram T2, arrêt Jet d'Eau – Mendès France. Horaires sur tcl.fr.",
        photos=[("tg2", 0, "Fresque de la cité Tony Garnier : un abattoir et un grand arbre peints sur un pignon d'immeuble"),
                ("tg1", 1, "Fresque monumentale sur la façade d'un immeuble de la cité Tony Garnier"),
                ("tg1", 8, "Pergola couverte de glycines au musée urbain Tony Garnier")],
        tags_extra=["ville", "patrimoine", "transports"],
    ),
    "fourviere": dict(
        name="Fourvière par le jardin du Rosaire", commune="Lyon 5e", dept="69", massif="Lyon",
        departure="Cathédrale Saint-Jean, Vieux-Lyon", level=2, extra=20,
        wp=["Cathédrale Saint-Jean", "Jardin du Rosaire", "Esplanade de Fourvière", "Théâtres antiques", "Montée du Gourguillon", "Place de la Trinité", "Cathédrale Saint-Jean"],
        steps=[
            "Du parvis de la cathédrale Saint-Jean, rejoignez la montée Saint-Barthélemy et l'entrée basse du jardin du Rosaire.",
            "Montez par les allées en lacets du jardin : la vue s'ouvre sur la Presqu'île à chaque virage.",
            "Arrivé sur l'esplanade, contournez la basilique et profitez du panorama sur Lyon et, par temps clair, sur les Alpes.",
            "Descendez par la rue Cléberg jusqu'aux théâtres antiques de Lugdunum, en accès libre.",
            "Empruntez la montée du Gourguillon, une des plus anciennes rues pavées de la ville.",
            "Rejoignez le quartier Saint-Georges puis la cathédrale par les rues du Vieux-Lyon.",
        ],
        ambiance="Une boucle courte mais raide entre le Vieux-Lyon et la colline de Fourvière, avec deux des plus beaux points de vue de la ville.",
        description="Le jardin du Rosaire permet de monter à la basilique sans emprunter la route. Les théâtres antiques, bâtis à partir du Ier siècle, sont en accès libre aux heures d'ouverture du site. La descente par la montée du Gourguillon est pavée et glissante par temps de pluie.",
        access="Métro D, station Vieux Lyon – Cathédrale Saint-Jean.",
        parking="Parking Saint-Georges (payant) à 5 minutes à pied du départ.",
        transport="Métro D, station Vieux Lyon – Cathédrale Saint-Jean. Funiculaire F2 pour remonter à Fourvière si besoin.",
        photos=[("lyon", 1, "La basilique de Fourvière vue depuis la passerelle des Quatre-Vents"),
                ("fourviere2", 0, "Les gradins du théâtre antique de Lyon, sur la colline de Fourvière"),
                ("lyon", 2, "Panorama de Lyon depuis la colline de Fourvière, de Saint-Jean à la Part-Dieu")],
        tags_extra=["ville", "vue", "patrimoine", "transports"],
    ),
    "mont-thou": dict(
        name="Boucle du Mont Thou et des cabornes", commune="Saint-Romain-au-Mont-d'Or", dept="69", massif="Monts d'Or",
        departure="Route Neuve, Saint-Romain-au-Mont-d'Or", level=2, extra=0,
        wp=["Route Neuve", "Chemin de Pinay", "Caborne du Pinay", "Hameau du Mont Thou", "Sous le sommet du Mont Thou", "Caborne des Pierres Blanches", "Route Neuve"],
        steps=[
            "Au départ de la Route Neuve, prenez le chemin à gauche dans le virage, face au carrefour.",
            "Montez la rue qui devient le chemin de Pinay après la ligne électrique.",
            "Entrez dans la forêt et passez près d'une caborne, une cabane de pierres sèches typique des Monts d'Or.",
            "Rejoignez la route forestière de la Corniche puis le hameau du Mont Thou.",
            "Montez vers le Mont Thou (593 m) : vue sur la Dombes, la Saône et, par temps clair, le mont Blanc. Le sommet lui-même est un terrain militaire fermé.",
            "Redescendez par la lisière de la forêt et la caborne des Pierres Blanches jusqu'au point de départ.",
        ],
        ambiance="La plus belle boucle des Monts d'Or au départ de Saint-Romain : forêt, anciennes carrières de calcaire et cabanes de pierres sèches, avec 400 m de montée.",
        description="Les Monts d'Or sont le premier relief au nord de Lyon. Les cabornes, petites cabanes en pierres sèches, servaient d'abri aux vignerons et aux carriers. La montée est régulière, la descente parfois raide sur un sentier caillouteux : prévoyez de bonnes chaussures.",
        access="Depuis Lyon, D73 vers Saint-Romain-au-Mont-d'Or. Départ au début de la Route Neuve.",
        parking="Stationnement possible le long de la Route Neuve.",
        transport="Bus TCL jusqu'à Saint-Romain-au-Mont-d'Or. Itinéraires sur tcl.fr.",
        photos=[("mont-thou", 2, "Le Mont Thou couvert de forêt, à Saint-Cyr-au-Mont-d'Or"),
                ("mont-thou2", 9, "Caborne en pierres sèches dans les bois sous le Mont Thou"),
                ("mont-thou", 8, "Vue sur Rillieux-la-Pape et la plaine depuis le Mont Thou")],
        tags_extra=["vue", "patrimoine"],
    ),
    "ile-barbe": dict(
        name="Île Barbe et quais de Saône", commune="Lyon 9e", dept="69", massif="Lyon",
        departure="Place Henri Barbusse, Saint-Rambert-l'Île-Barbe", level=1, extra=10,
        wp=["Place Henri Barbusse", "Pont de l'Île Barbe", "Île Barbe", "Pont de l'Île Barbe", "Quai du Commerce", "Place Henri Barbusse"],
        steps=[
            "De la place Henri Barbusse, descendez vers la Saône et le pont suspendu de l'Île Barbe.",
            "Traversez la première travée du pont pour rejoindre l'île.",
            "Faites le tour de la partie publique de l'île : l'ancienne abbaye fondée au Ve siècle est privée et ne se visite pas.",
            "Revenez sur la rive droite par le même pont.",
            "Longez la Saône vers le sud par les quais aménagés jusqu'au quai du Commerce, à Vaise.",
            "Remontez les quais pour revenir à la place Henri Barbusse.",
        ],
        ambiance="Une promenade plate au bord de la Saône jusqu'à la plus ancienne île habitée de Lyon, avec ses maisons de pierre et son pont suspendu de 1827.",
        description="L'Île Barbe accueillit l'un des premiers monastères de la région. Le parcours suit ensuite les berges réaménagées de la Saône, accessibles aux poussettes. Les quais peuvent être inondés lors des crues : vérifiez les avis de la Métropole en hiver.",
        access="Gare SNCF de Saint-Rambert-l'Île-Barbe à 5 minutes à pied du départ.",
        parking="Stationnement dans les rues de Saint-Rambert.",
        transport="TER jusqu'à la gare de Saint-Rambert-l'Île-Barbe, ou bus TCL. Horaires sur tcl.fr et sncf-connect.com.",
        photos=[("ile-barbe", 4, "Un bateau sur la Saône près de l'Île Barbe et de son pont suspendu"),
                ("ile-barbe", 5, "La Saône vue depuis le pont de l'Île Barbe"),
                ("ile-barbe", 3, "Le côté est de l'Île Barbe et ses arbres au bord de l'eau")],
        tags_extra=["ville", "eau", "famille", "transports"],
    ),
    "aqueduc-gier": dict(
        name="Arches de l'aqueduc du Gier à Chaponost", commune="Chaponost", dept="69", massif="Monts du Lyonnais",
        departure="Centre de Chaponost", level=1, extra=10,
        wp=["Centre de Chaponost", "Plat de l'Air", "Arches du Plat de l'Air", "Centre de Chaponost"],
        steps=[
            "Du centre de Chaponost, suivez les panneaux vers le Plat de l'Air par les petites routes résidentielles.",
            "Au Plat de l'Air, le chemin longe les vestiges de l'aqueduc romain.",
            "Les arches, restaurées en 2009-2010, sont le plus long alignement conservé de l'aqueduc : 72 arches sur plus de 500 m.",
            "Revenez au centre de Chaponost par le même chemin.",
        ],
        ambiance="Une courte balade presque plate vers les arches les mieux conservées de l'aqueduc romain du Gier, qui alimentait Lugdunum en eau.",
        description="L'aqueduc du Gier, long de 86 km, amenait l'eau du mont Pilat jusqu'à Fourvière au IIe siècle. À Chaponost, il franchit le plateau sur une longue série d'arches. Le chemin est large et facile ; il peut être boueux après la pluie.",
        access="Depuis Lyon, D30 vers Chaponost.",
        parking="Parkings dans le centre de Chaponost.",
        transport="Bus TCL jusqu'au centre de Chaponost. Itinéraires sur tcl.fr.",
        photos=[("aqueduc-gier", 1, "Une série d'arches de l'aqueduc du Gier à Chaponost, après restauration"),
                ("aqueduc-gier", 3, "Le canal de l'aqueduc posé sur les arches au Plat de l'Air"),
                ("aqueduc-gier", 0, "L'aqueduc du Gier traversant un champ à Chaponost")],
        tags_extra=["patrimoine", "famille"],
    ),
    "croix-rousse": dict(
        name="Pentes de la Croix-Rousse et traboules", commune="Lyon 1er", dept="69", massif="Lyon",
        departure="Place des Terreaux", level=2, extra=25,
        wp=["Place des Terreaux", "Montée de la Grande Côte", "Jardin des Plantes", "Gros Caillou", "Place Colbert", "Place des Terreaux"],
        steps=[
            "De la place des Terreaux, remontez la rue Romarin vers les pentes.",
            "Grimpez la montée de la Grande Côte jusqu'à son belvédère sur la ville.",
            "Faites un détour par le jardin des Plantes et l'amphithéâtre des Trois Gaules.",
            "Rejoignez le plateau et le Gros Caillou, au bout du boulevard de la Croix-Rousse : vue sur le Rhône.",
            "Redescendez par la place Colbert et la cour des Voraces, une traboule célèbre de l'époque des canuts.",
            "Terminez par les escaliers des pentes jusqu'à la place des Terreaux.",
        ],
        ambiance="Une boucle courte et pleine d'escaliers dans le quartier des canuts, les ouvriers de la soie, entre traboules, belvédères et places animées.",
        description="Les traboules sont des passages qui traversent les immeubles d'une rue à l'autre. Certaines sont ouvertes au public en journée : respectez le calme des habitants. Le parcours compte beaucoup de marches ; il n'est pas adapté aux poussettes.",
        access="Métro A ou C, station Hôtel de Ville – Louis Pradel.",
        parking="Parking des Terreaux (payant).",
        transport="Métro A ou C, station Hôtel de Ville – Louis Pradel. Horaires sur tcl.fr.",
        photos=[("croix-rousse", 2, "La montée de la Grande Côte et ses façades colorées sur les pentes de la Croix-Rousse"),
                ("croix-rousse", 1, "Vue plongeante depuis le haut de la montée de la Grande Côte"),
                ("croix-rousse2", 3, "La cour des Voraces et son grand escalier, place Colbert")],
        tags_extra=["ville", "vue", "patrimoine", "transports"],
    ),
}

LY_SAFETY = "<p>Restez attentif à la circulation lors des traversées de rues. En cas d'urgence, composez le 112.</p>"

for key, d in LY.items():
    route = L[key]
    pts = route["pts"]
    zs = smooth([p[2] for p in pts])
    up, down = gain(zs)
    # cumul des distances
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + hav(a, b))
    km = cum[-1] / 1000
    # points de passage : distance cumulée à partir des longueurs de tronçons OSRM
    legs = route["legs"]
    wp_km = [0.0]
    for l in legs:
        wp_km.append(wp_km[-1] + l / 1000)
    scale = km / wp_km[-1] if wp_km[-1] else 1
    snap = route["wpSnap"]
    waypoints = []
    for i, name in enumerate(d["wp"]):
        s = snap[min(i, len(snap) - 1)]
        k = wp_km[min(i, len(wp_km) - 1)] * scale
        # altitude la plus proche
        j = min(range(len(cum)), key=lambda n: abs(cum[n] / 1000 - k))
        waypoints.append({"name": name, "lat": s[1], "lon": s[0], "km": round(k, 2), "alt": round(zs[j])})
    geom3 = [[p[0], p[1], round(zs[i])] for i, p in enumerate(pts)]
    simp = dp(geom3, 0.00002)
    dur = km / 4 * 60 + up / 300 * 60 + d["extra"]
    r = {
        "id": "ly-" + key,
        "num": None,
        "name": d["name"],
        "commune": d["commune"],
        "dept": {"code": d["dept"], "name": DEPTS[d["dept"]]},
        "massif": d["massif"],
        "departure": d["departure"],
        "start": [pts[0][1], pts[0][0]],
        "level": d["level"],
        "route": "Boucle" if key != "aqueduc-gier" else "Aller-retour",
        "km": round(km, 2),
        "durationMin": int(round(dur / 5) * 5),
        "ascent": up,
        "descent": down,
        "minEl": round(min(zs)),
        "maxEl": round(max(zs)),
        "geom": [[p[1], p[0], p[2]] for p in simp],
        "photos": [commons(k2, i2, alt) for (k2, i2, alt) in d["photos"]],
        "teaser": "",
        "ambiance": f"<p>{html.escape(d['ambiance'], quote=False)}</p>",
        "description": f"<p>{html.escape(d['description'], quote=False)}</p>",
        "steps": [dict(w, text=d["steps"][i] if i < len(d["steps"]) else "") for i, w in enumerate(waypoints[:-1])] + [dict(waypoints[-1], text="Arrivée au point de départ.")],
        "access": f"<p>{html.escape(d['access'], quote=False)}</p>",
        "parking": f"<p>{html.escape(d['parking'], quote=False)}</p>",
        "transport": f"<p>{html.escape(d['transport'], quote=False)}</p>",
        "advice": LY_SAFETY,
        "themes": [],
        "source": {
            "name": "Itinéraire conçu pour la maquette",
            "provider": "Tracé calculé sur OpenStreetMap (profil piéton OSRM), altitudes IGN RGE ALTI",
            "gpx": "", "pdf": "", "updated": "2026-11-02",
            "trace": "Tracé reconstitué à partir des points de passage, à vérifier sur le terrain",
        },
    }
    blob = " ".join([d["name"], d["ambiance"], d["description"]])
    r["tags"] = sorted(set(tags_for(r, blob)) | set(d["tags_extra"]))
    out.append(r)

# numéros de randonnée lisibles (comme sur Visorando) : 4 chiffres stables
for i, r in enumerate(sorted(out, key=lambda r: r["id"])):
    r["ref"] = f"{1001 + i}"

# Lyon d'abord, puis par nom
out.sort(key=lambda r: (0 if r["id"].startswith("ly-") else 1, r["name"]))

# lieux connus pour la recherche (lat, lon)
PLACES = {
    "Lyon": [45.7578, 4.8320], "Lyon 1er": [45.7676, 4.8344], "Lyon 5e": [45.7590, 4.8180], "Lyon 8e": [45.7350, 4.8690],
    "Lyon 9e": [45.7740, 4.8050], "Villeurbanne": [45.7719, 4.8902], "Caluire-et-Cuire": [45.7953, 4.8466],
    "Saint-Étienne": [45.4397, 4.3872], "Vienne": [45.5255, 4.8740], "Givors": [45.5906, 4.7689],
    "Rive-de-Gier": [45.5286, 4.6178], "Saint-Chamond": [45.4775, 4.5153], "Chaponost": [45.7107, 4.7469],
    "Monts d'Or": [45.8400, 4.8000], "Massif du Pilat": [45.3800, 4.5900], "Crêt de la Perdrix": [45.3597, 4.5714],
    "Saint-Romain-au-Mont-d'Or": [45.8378, 4.8239], "Oullins-Pierre-Bénite": [45.7140, 4.8080],
}
for r in out:
    if r["commune"] and r["commune"] not in PLACES:
        PLACES[r["commune"]] = r["start"]
places = [{"name": k, "lat": v[0], "lon": v[1]} for k, v in sorted(PLACES.items(), key=lambda kv: kv[0])]

json.dump({"generated": "2026-11-02", "randos": out, "places": places}, open("/home/claude/site/data/randos.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "randos")
for r in out:
    print(r["ref"], r["id"], r["name"][:40], r["commune"], r["level"], r["route"], r["km"], r["durationMin"], r["ascent"], len(r["geom"]), len(r["photos"]), r["tags"])
