"""Rebuild the bundled 25 km Australian Albers hex atlas from open geography."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
import tempfile
from urllib.request import urlopen

import numpy as np
from PIL import Image
from pyproj import Transformer
import shapefile
import shapely
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[2]
SPACING = 25000
ROW_HEIGHT = SPACING * math.sqrt(3) / 2
STATES = ["WA", "NT", "SA", "QLD", "NSW", "VIC", "TAS", "ACT"]
TERRAINS = ["Lowlands", "Plains", "Plateau", "Desert", "Hills", "Mountains"]
INVERSE = Transformer.from_crs(3577, 4326, always_xy=True)
VECTOR_URL = "https://naturalearth.s3.amazonaws.com/"
TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/5"
REGIONS = {"Desert", "Plateau", "Range/mtn", "Plain"}


def download(url, path):
    if not path.exists():
        with urlopen(url, timeout=120) as response:
            body = response.read()
        temporary = path.with_suffix(".part")
        temporary.write_bytes(body)
        temporary.replace(path)
    return path


def state_geometries(cache):
    path = download(VECTOR_URL + "10m_cultural/ne_10m_admin_1_states_provinces.zip", cache / "admin.zip")
    polygons = {state: [] for state in STATES}
    with shapefile.Reader(str(path)) as reader:
        for record in reader.iterRecords():
            state = record["iso_3166_2"].replace("AU-", "")
            if record["adm0_a3"] == "AUS" and state in polygons:
                polygons[state].append(shape(reader.shape(record.oid).__geo_interface__))
    return [shapely.union_all(polygons[state]) for state in STATES]


def region_masks(cache, lon, lat):
    path = download(VECTOR_URL + "10m_physical/ne_10m_geography_regions_polys.zip", cache / "regions.zip")
    masks = {kind: np.zeros(len(lon), dtype=bool) for kind in REGIONS}
    with shapefile.Reader(str(path)) as reader:
        for item in reader.iterShapeRecords():
            west, south, east, north = item.shape.bbox
            kind = item.record["FEATURECLA"]
            if kind in REGIONS and west < 155 and east > 111 and north > -45 and south < -9:
                masks[kind] |= shapely.contains_xy(shape(item.shape.__geo_interface__), lon, lat)
    return masks


def sample_elevation(cache, lon, lat):
    width = 256 * 2**5
    px = np.floor((lon + 180) / 360 * width).astype(int)
    py = np.floor((1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) * width / 2).astype(int)
    tiles = sorted(set(zip(px // 256, py // 256)))

    def read_tile(tile):
        col, row = tile
        path = download(f"{TILE_URL}/{col}/{row}.png", cache / f"z5-{col}-{row}.png")
        with Image.open(path) as image:
            rgb = np.asarray(image.convert("RGB"), dtype=float)
        return rgb[:, :, 0]*256 + rgb[:, :, 1] + rgb[:, :, 2]/256 - 32768

    heights = np.empty(len(lon))
    with ThreadPoolExecutor(max_workers=6) as pool:
        for (col, row), raster in zip(tiles, pool.map(read_tile, tiles)):
            mask = (px // 256 == col) & (py // 256 == row)
            heights[mask] = raster[py[mask] % 256, px[mask] % 256]
    return heights


def build(cache):
    cache.mkdir(parents=True, exist_ok=True)
    polygons = state_geometries(cache)
    land = shapely.union_all(polygons)
    shapely.prepare(land)
    # Bounds in projected metres, extended beyond the mainland and Tasmania.
    pairs = [(q, r) for r in range(-241, -34) for q in range(-120, 245)
             if abs(q + r / 2) < 112]
    q, r = np.asarray(pairs).T
    x, y = SPACING * (q + r/2), ROW_HEIGHT * r
    lon, lat = INVERSE.transform(x, y)
    states = np.full(len(lon), -1)
    for index, polygon in enumerate(polygons):
        states[shapely.contains_xy(polygon, lon, lat)] = index
    valid = (states >= 0) & (lon <= 154) & (lat >= -44)
    q, r, x, y, lon, lat, states = (a[valid] for a in (q, r, x, y, lon, lat, states))
    masks = region_masks(cache, lon, lat)
    # One centre and six points 8 km from the centre, in projected space.
    offsets = [(0, 0)] + [(8000*math.cos(i*math.pi/3), 8000*math.sin(i*math.pi/3)) for i in range(6)]
    sample_lon, sample_lat = INVERSE.transform(
        np.stack([x+dx for dx, dy in offsets]), np.stack([y+dy for dx, dy in offsets]))
    inland = shapely.contains_xy(land, sample_lon, sample_lat)
    samples = np.full(inland.shape, np.nan)
    samples[inland] = sample_elevation(cache, sample_lon[inland], sample_lat[inland])
    heights = np.rint(np.nanmedian(samples, axis=0)).astype(int)
    relief = np.nanmax(samples, axis=0) - np.nanmin(samples, axis=0)
    terrains = np.select(
        [heights >= 900, masks["Desert"], (relief >= 160) | masks["Range/mtn"],
         masks["Plain"], masks["Plateau"] | (heights >= 450), heights < 100],
        [5, 3, 4, 1, 2, 0], default=1)
    cells = np.stack([q, r, states, terrains, heights], axis=1).tolist()
    assert len(cells) == len(set(zip(q, r))) and 13900 < len(cells) < 14500
    assert set(states) == set(range(len(STATES))) and set(terrains) == set(range(len(TERRAINS)))
    assert -100 < heights.min() < 10 and 1400 < heights.max() < 2300
    return {"crs":"EPSG:3577", "spacingMetres":SPACING, "states":STATES, "terrains":TERRAINS, "cells":cells}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir())/"aus-atlas-src")
    args = parser.parse_args()
    data = build(args.cache)
    target = ROOT/"public/data/australia/terrain.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, separators=(",", ":"))+"\n", encoding="utf-8")
    print(f"{len(data['cells'])} hexes written to {target}")
