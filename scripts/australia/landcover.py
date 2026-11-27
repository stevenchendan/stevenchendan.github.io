"""Aggregate 2021 annual NASA MODIS land cover to the terrain grid.

Run with Python 3, numpy, Pillow and pyproj. Downloaded GIBS PNG tiles and
their official categorical legend are cached in the system temporary folder.
"""

import hashlib
import json
import math
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlretrieve

import numpy as np
from PIL import Image
from pyproj import Transformer

OUT = Path(__file__).resolve().parents[2] / "public/data/australia"
CACHE = Path(tempfile.gettempdir()) / "australia-landcover-2021-gibs"
YEAR = 2021
LAYER = "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual"
BASE = "https://gibs.earthdata.nasa.gov"
LEGEND = f"{BASE}/colormaps/v1.3/MODIS_IGBP_Land_Cover_Type.xml"
CLASSES = ["water", "forest", "shrubland", "savanna", "grassland", "wetland", "cropland", "built", "mosaic", "snow", "barren"]
IGBP = [0, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 0]


def download(url, filename):
    target = CACHE / filename
    if not target.exists():
        pending = target.with_suffix(".part")
        urlretrieve(url, pending)
        pending.replace(target)
    return target


def build():
    CACHE.mkdir(exist_ok=True)
    terrain_bytes = (OUT / "terrain.json").read_bytes()
    terrain = json.loads(terrain_bytes)
    q, r = np.array(terrain["cells"])[:, :2].T
    spacing = terrain["spacingMetres"]
    x = spacing * (q + r / 2)
    y = spacing * math.sqrt(3) * r / 2
    radius = spacing / math.sqrt(3)
    offsets = [(dx, dy) for dy in range(-14000, 14001, 2000) for dx in range(-12000, 12001, 2000)
               if abs(dx) < spacing / 2 and abs(dy) < radius - abs(dx) / math.sqrt(3)]
    dx, dy = np.array(offsets).T
    projection = Transformer.from_crs(terrain["crs"], 4326, always_xy=True)
    lon, lat = projection.transform(x[:, None] + dx, y[:, None] + dy)
    # WMTS 500m tile matrix level 5 has 40 x 20 tiles of 512 x 512 pixels.
    # The origin is (-180, 90) and each tile spans nine degrees.
    column = np.floor((lon + 180) * 512 / 9).astype(int)
    row = np.floor((90 - lat) * 512 / 9).astype(int)
    tile_id = (row // 512) * 40 + column // 512
    tile_ids = np.unique(tile_id)

    legend = ET.parse(download(LEGEND, "legend.xml"))
    palette = {}
    for entry in legend.findall(".//ColorMapEntry"):
        rgb = tuple(map(int, entry.attrib["rgb"].split(",")))
        value = int(entry.attrib.get("sourceValue", "255").split(",")[0])
        palette[rgb] = IGBP[value] if 0 <= value < len(IGBP) else -1

    def fetch(number):
        tile_y, tile_x = divmod(int(number), 40)
        url = f"{BASE}/wmts/epsg4326/best/{LAYER}/default/{YEAR}-01-01/500m/5/{tile_y}/{tile_x}.png"
        return download(url, f"{tile_y}-{tile_x}.png")

    observed = np.full(tile_id.shape, -1, dtype=np.int8)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for number, path in zip(tile_ids, pool.map(fetch, tile_ids)):
            with Image.open(path) as tile:
                assert tile.size == (512, 512) and tile.mode == "P"
                colours = np.array(tile.getpalette()).reshape(-1, 3)
                lookup = np.array([palette.get(tuple(rgb), -1) for rgb in colours], dtype=np.int8)
                # Treat unseen opaque palette colours as a source format change.
                assert all(tuple(colours[i]) in palette for _, i in tile.getcolors())
                mask = tile_id == number
                indices = np.asarray(tile)[row[mask] % 512, column[mask] % 512]
                observed[mask] = lookup[indices]
    votes = np.stack([(observed == c).sum(axis=1) for c in range(len(CLASSES))], axis=1)
    covers = votes.argmax(axis=1)
    # Resolve a tied mode with the closest valid sample belonging to a tied class.
    tied = (votes == votes.max(axis=1)[:, None]).sum(axis=1) > 1
    for i in np.flatnonzero(tied):
        if not votes[i].any():
            covers[i] = -1
            continue
        for sample in np.argsort(dx * dx + dy * dy, kind="stable"):
            value = observed[i, sample]
            if value >= 0 and votes[i, value] == votes[i].max():
                covers[i] = value
                break
    assert covers.shape == q.shape and np.all((covers >= -1) & (covers < len(CLASSES)))
    data = dict(year=YEAR, source="NASA GIBS · MODIS MCD12Q1.061 Terra/Aqua annual IGBP land cover",
                classes=CLASSES, cover=covers.tolist())
    encoded = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    (OUT / "landcover.json").write_bytes(encoded)
    print("Terrain SHA256", hashlib.sha256(terrain_bytes).hexdigest())
    print("Tiles, samples/hex, ties, unclassified samples:", len(tile_ids), len(dx), int(tied.sum()), int((observed < 0).sum()))
    print("Hexes per class:", Counter(data["cover"]))


if __name__ == "__main__":
    build()
