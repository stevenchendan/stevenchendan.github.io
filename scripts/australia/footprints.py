"""Build Australian place footprints after places.py, regions.py and terrain.py.

Requires numpy, pyproj, pyshp 2.x and shapely 2.x. Run this file directly.
"""

import hashlib
import json
import math

import numpy as np
import shapefile
from pyproj import Transformer
from shapely import STRtree, area, intersection, make_valid, points, polygons, transform
from shapely.geometry import shape

from regions import BOUNDARIES, CAPITALS, GRID, ROOT, STATES, archive, write


def source_features(level, ids):
    stem = f"{level}_2021_AUST_GDA94_SHP" if level != "GCCSA" else "GCCSA_2021_AUST_SHP_GDA94"
    path = archive(f"{BOUNDARIES}/{stem}.zip", f"atlas-shape-{level}.zip")
    projection = Transformer.from_crs(4283, 3577, always_xy=True)
    prefix = {"UCL": "U", "SAL": "S", "GCCSA": ""}[level]
    code_field = ("GCC" if level == "GCCSA" else level) + "_CODE21"
    with shapefile.Reader(str(path)) as reader:
        for item in reader.iterShapeRecords():
            key = prefix + item.record[code_field]
            if key not in ids:
                continue
            geom = transform(shape(item.shape.__geo_interface__), lambda xy: np.column_stack(projection.transform(*xy.T)))
            yield key, STATES[int(item.record["STE_CODE21"])], geom if geom.is_valid else make_valid(geom)


def build():
    terrain_bytes = (GRID / "terrain.json").read_bytes()
    terrain = json.loads(terrain_bytes)
    spacing = terrain["spacingMetres"]
    q, r, state = np.array(terrain["cells"])[:, :3].T
    xy = np.column_stack([spacing * (q + r / 2), spacing * math.sqrt(3) * r / 2])
    centres = STRtree(points(xy))
    angles = np.deg2rad(np.arange(30, 390, 60))
    corners = spacing / math.sqrt(3) * np.column_stack([np.cos(angles), np.sin(angles)])
    hexagons = polygons(xy[:, None, :] + corners)
    hex_tree = STRtree(hexagons)

    places = json.loads((GRID / "places.json").read_bytes())["places"]
    projection = Transformer.from_crs(4326, 3577, always_xy=True)
    place_points = {key: projection.transform(lon, lat) for key, _, _, lon, lat, _ in places}
    cities = json.loads((ROOT / "site/data/australia/regions.json").read_bytes())["cities"]
    for city in cities:
        place_points[city["code"]] = projection.transform(city["lon"], city["lat"])
    suburbs = [row for row in places if row[0].startswith("S")]
    suburb_tree = STRtree(points([place_points[row[0]] for row in suburbs]))
    membership = {row[0]: [None, None] for row in suburbs}
    cells, anchors = {}, {}
    summary = {}
    for level in ("GCCSA", "UCL", "SAL"):
        ids = CAPITALS if level == "GCCSA" else {p[0] for p in places if p[0][0] == level[0]}
        counts = dict(centre=0, overlap=0, anchor=0, offGrid=0)
        seen = set()
        for key, jurisdiction, geom in source_features(level, ids):
            seen.add(key)
            if level != "SAL":
                column = int(level == "GCCSA")
                for i in suburb_tree.query(geom, predicate="covers"):
                    row = suburbs[i]
                    if row[2] == jurisdiction:
                        assert membership[row[0]][column] is None
                        membership[row[0]][column] = key
            if jurisdiction not in terrain["states"]:
                counts["offGrid"] += 1
                continue
            state_index = terrain["states"].index(jurisdiction)
            selected = centres.query(geom, predicate="covers")
            selected = selected[state[selected] == state_index]
            if selected.size:
                cells[key] = sorted(selected.tolist())
                counts["centre"] += 1
                continue
            candidates = np.sort(hex_tree.query(geom, predicate="intersects"))
            candidates = candidates[state[candidates] == state_index]
            if candidates.size:
                overlaps = area(intersection(hexagons[candidates], geom))
                best = np.argmax(overlaps)
                if overlaps[best] > 0:
                    cells[key] = [int(candidates[best])]
                    counts["overlap"] += 1
                    continue
            same_state = np.flatnonzero(state == state_index)
            distances = np.linalg.norm(xy[same_state] - place_points[key], axis=1)
            best = np.argmin(distances)
            if distances[best] <= spacing:
                anchors[key] = int(same_state[best])
                counts["anchor"] += 1
            else:
                counts["offGrid"] += 1
        assert seen == ids
        summary[level] = counts
    assert not cells.keys() & anchors.keys()
    assert all(len(cells.get(key, [])) for key in CAPITALS)
    write(GRID / "footprints.json", {"cells": cells, "anchors": anchors, "membership": membership})
    print("Terrain SHA256:", hashlib.sha256(terrain_bytes).hexdigest())
    print(summary)
    print("SAL points in a UCL:", sum(pair[0] is not None for pair in membership.values()))
    print("SAL points in a capital GCCSA:", sum(pair[1] is not None for pair in membership.values()))


if __name__ == "__main__":
    build()
