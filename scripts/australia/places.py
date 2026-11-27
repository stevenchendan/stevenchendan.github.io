"""Build public/data/australia/places.json from nationally released ABS 2021 files.

Requires Python 3, pyshp 2.x, shapely 2.x, pyproj and numpy.
Run from any directory: python scripts/australia/places.py
"""

import csv
import io
import json
from collections import Counter
from zipfile import ZipFile

import numpy as np
import shapefile
from pyproj import Transformer
from shapely import transform
from shapely.geometry import Point, shape

from regions import BOUNDARIES, GRID, PACKS, STATES, archive


def populations(level):
    url = f"{PACKS}/download/2021_GCP_{level}_for_AUS_short-header.zip"
    with ZipFile(archive(url, f"atlas-gcp-{level}.zip")) as pack:
        members = [entry for entry in pack.namelist() if "_G01_" in entry and entry.endswith(".csv")]
        assert len(members) == 1
        with pack.open(members[0]) as raw:
            rows = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))
            return {row[rows.fieldnames[0]][len(level):]: int(row["Tot_P_P"]) for row in rows}


def build():
    to_albers = Transformer.from_crs(4283, 3577, always_xy=True)
    to_wgs = Transformer.from_crs(3577, 4326, always_xy=True)
    from_wgs = Transformer.from_crs(4326, 3577, always_xy=True)
    places = []
    counts = Counter()
    for level, prefix in (("UCL", "U"), ("SAL", "S")):
        population = populations(level)
        url = f"{BOUNDARIES}/{level}_2021_AUST_GDA94_SHP.zip"
        with shapefile.Reader(str(archive(url, f"atlas-shape-{level}.zip"))) as reader:
            for item in reader.iterShapeRecords():
                attrs = item.record.as_dict()
                code, name = attrs[f"{level}_CODE21"], attrs[f"{level}_NAME21"]
                if not item.shape.shapeType or name.startswith("Remainder of State/Territory"):
                    continue
                geom = transform(shape(item.shape.__geo_interface__), lambda xy: np.column_stack(to_albers.transform(*xy.T)))
                largest = max(geom.geoms, key=lambda part: part.area) if geom.geom_type == "MultiPolygon" else geom
                point = largest.centroid
                if not largest.contains(point):
                    point = largest.representative_point()
                lon, lat = to_wgs.transform(point.x, point.y)
                # Keep greater precision only if ordinary rounding crosses a boundary.
                for precision in (5, 7, 10):
                    x, y = round(lon, precision), round(lat, precision)
                    if largest.covers(Point(*from_wgs.transform(x, y))):
                        break
                else:
                    raise ValueError(f"External representative coordinate for {code}")
                state = STATES[int(attrs["STE_CODE21"])]
                places.append([prefix + code, name, state, x, y, population[code]])
                counts[level, state] += 1
    assert all(counts[level, state] for level in ("UCL", "SAL") for state in STATES[1:9])
    assert len({p[0] for p in places}) == len(places)
    assert all(p[1] and p[5] >= 0 for p in places)
    places.sort(key=lambda p: (p[0][0] != "U", -p[5], p[0]))
    (GRID / "places.json").write_text(json.dumps({"places": places}, ensure_ascii=False, separators=(",", ":")) + "\n",
                                      encoding="utf-8")
    print(counts, len(places))


if __name__ == "__main__":
    build()
