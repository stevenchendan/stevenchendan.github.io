"""Prepare Australian Census profiles and the atlas terrain-to-SA4 lookup.

Run after terrain.py with Python 3, numpy, pyshp 2.x, shapely 2.x and pyproj.
Raw ABS archives are cached in the system temporary directory.
"""

import csv
import io
import json
import math
import tempfile
from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile

import numpy as np
import shapefile
from pyproj import Transformer
from shapely import contains_xy, prepare, transform
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[2]
GRID = ROOT / "public/data/australia"
CACHE = Path(tempfile.gettempdir())
PACKS = "https://www.abs.gov.au/census/find-census-data/datapacks"
BOUNDARIES = ("https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/"
              "edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files")
STATES = ["", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT", "OT"]
CAPITALS = {"1GSYD", "2GMEL", "3GBRI", "4GADE", "5GPER", "6GHOB", "7GDAR", "8ACTE"}
INDUSTRIES = {
    "Ag_For_Fshg": "Agriculture, forestry and fishing", "Mining": "Mining",
    "Manufact": "Manufacturing", "El_Gas_Wt_Waste": "Electricity, gas, water and waste services",
    "Constru": "Construction", "WhlesaleTde": "Wholesale trade", "RetTde": "Retail trade",
    "Accom_food": "Accommodation and food services", "Trans_post_wrehsg": "Transport, postal and warehousing",
    "Info_media_teleco": "Information media and telecommunications", "Fin_Insur": "Financial and insurance services",
    "RtnHir_REst": "Rental, hiring and real estate services", "Pro_scien_tec": "Professional, scientific and technical services",
    "Admin_supp": "Administrative and support services", "Public_admin_sfty": "Public administration and safety",
    "Educ_trng": "Education and training", "HlthCare_SocAs": "Health care and social assistance",
    "Art_recn": "Arts and recreation services", "Oth_scs": "Other services",
}


def archive(url, filename):
    path = CACHE / filename
    if not path.exists():
        pending = path.with_suffix(".part")
        urlretrieve(url, pending)
        pending.replace(path)
    return path


def census(level):
    url = f"{PACKS}/download/2021_GCP_{level}_for_AUS_short-header.zip"
    records = {}
    with ZipFile(archive(url, f"atlas-gcp-{level}.zip")) as pack:
        for name in pack.namelist():
            if not any(f"_{table}_" in name for table in ("G01", "G02", "G43", "G54A", "G54B", "G54C", "G54D")):
                continue
            with pack.open(name) as raw:
                for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig")):
                    records.setdefault(next(iter(row.values())), {}).update(row)
    return records


def profile(row, australia):
    total = int(row["P_Tot_Tot"])
    national_total = int(australia["P_Tot_Tot"])
    industries = []
    for key, name in INDUSTRIES.items():
        field = f"P_{key}_Tot"
        count = int(row[field])
        share = 100 * count / total
        national_share = 100 * int(australia[field]) / national_total
        industries.append(dict(name=name, count=count, share=share, nationalShare=national_share,
                               ratio=share / national_share))
    top = max(industries, key=lambda item: item["count"])
    signature = max((item for item in industries if item["share"] >= 5), key=lambda item: (item["ratio"], item["count"]))
    def rounded(item):
        return {k: round(v, 2) if isinstance(v, float) else v for k, v in item.items()}
    return dict(population=int(row["Tot_P_P"]), employed=total, medianAge=int(row["Median_age_persons"]),
                weeklyIncome=int(row["Median_tot_prsnl_inc_weekly"]), labourForce=int(row["lfs_Tot_LF_P"]),
                topIndustry=rounded(top), signatureIndustry=rounded(signature))


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    terrain = json.loads((GRID / "terrain.json").read_bytes())
    spacing = terrain["spacingMetres"]
    q, r, state = np.array(terrain["cells"])[:, :3].T
    x = spacing * (q + r / 2)
    y = spacing * math.sqrt(3) / 2 * r
    grid_codes = np.zeros(len(q), dtype=int)
    geographic_codes = np.zeros(len(q), dtype=int)
    albers = Transformer.from_crs(4283, terrain["crs"], always_xy=True)
    wgs = Transformer.from_crs(terrain["crs"], 4326, always_xy=True)
    national = census("AUS")["AUS"]
    output = {
        "metadata": {
            "year": 2021, "source": "Australian Bureau of Statistics, 2021 Census General Community Profile and ASGS Edition 3",
            "accessed": "2026-11-28", "attribution": "Based on Australian Bureau of Statistics data. ABS data used with permission from the Australian Bureau of Statistics.",
            "sources": [PACKS, BOUNDARIES], "licence": "CC BY 4.0", "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
            "coverage": "All spatial SA4s including Other Territories, and eight capital GCCSAs. The Canberra profile covers the entire ACT.",
            "measures": "G01 population by usual residence; G02 median age in years and median total personal income in AUD per week for people aged 15 and over; G43 labour force; G54 employed residents aged 15 and over by ANZSIC division of main job.",
            "industries": "Shares divide each division count by all employed residents, including inadequately described and unstated industries. Signature industry has the highest local-to-national share ratio among divisions representing at least 5% locally. Independent Census perturbation can affect totals.",
            "locations": "Area-weighted Australian Albers centroid of the full ABS boundary, transformed to WGS84. An interior point of the largest polygon is used where a centroid falls outside its area.",
            "grid": "SA4 containing the exact EPSG:3577 terrain hex centre, only when its state agrees with the terrain state. Unmatched centres have no allocation. Small regions can fall between hex centres."
        },
        "national": profile(national, national), "regions": [], "cities": [],
    }
    for level, prefix, target in (("SA4", "SA4", "regions"), ("GCCSA", "GCC", "cities")):
        records = census(level)
        url = f"{BOUNDARIES}/{level}_2021_AUST_SHP_GDA94.zip"
        with shapefile.Reader(str(archive(url, f"atlas-shape-{level}.zip"))) as reader:
            for item in reader.iterShapeRecords():
                attrs = item.record.as_dict()
                code = attrs[f"{prefix}_CODE21"]
                if not item.shape.shapeType or (level == "GCCSA" and code not in CAPITALS):
                    continue
                geom = transform(shape(item.shape.__geo_interface__), lambda pts: np.column_stack(albers.transform(*pts.T)))
                centre = geom.centroid
                if not geom.covers(centre):
                    largest = max(geom.geoms, key=lambda p: p.area) if geom.geom_type == "MultiPolygon" else geom
                    centre = largest.representative_point()
                lon, lat = wgs.transform(centre.x, centre.y)
                abbrev = STATES[int(attrs["STE_CODE21"])]
                output[target].append(dict(code=code, name=attrs[f"{prefix}_NAME21"], state=abbrev,
                                           lon=round(lon, 5), lat=round(lat, 5), **profile(records[code], national)))
                if level == "SA4":
                    prepare(geom)
                    inside = contains_xy(geom, x, y)
                    assert not np.any(geographic_codes[inside]), f"Overlapping region {code}"
                    geographic_codes[inside] = int(code)
                    if abbrev in terrain["states"]:
                        grid_codes[inside & (state == terrain["states"].index(abbrev))] = int(code)
    rows = {}
    for number in sorted(set(r)):
        mask = (r == number) & (grid_codes != 0)
        if not np.any(mask):
            continue
        first, last = min(q[mask]), max(q[mask])
        values = np.zeros(last - first + 1, dtype=int)
        values[q[mask] - first] = grid_codes[mask]
        rows[str(number)] = [int(first)] + values.tolist()
    assert len(output["cities"]) == 8 and len(output["regions"]) == 89
    output["metadata"]["gridCoverage"] = {
        "terrainCells": len(q), "matched": int(np.count_nonzero(grid_codes)),
        "outsideBoundaries": int(np.count_nonzero(geographic_codes == 0)),
        "stateDisagreements": int(np.count_nonzero(geographic_codes != grid_codes)),
        "representedRegions": len(set(grid_codes) - {0}),
    }
    write(ROOT / "site/data/australia/regions.json", output)
    write(GRID / "regions-grid.json", {"byRow": rows})
    print(output["metadata"]["gridCoverage"])


if __name__ == "__main__":
    main()
