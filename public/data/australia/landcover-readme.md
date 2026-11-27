# Australian land cover, 2021

Each entry in `landcover.json` identifies the most frequently sampled cover group in one of the 14,213 Australian terrain hexes. Read `classes[cover[i]]` alongside `terrain.cells[i]`. A value of −1 means that no classified sample was available.

## Source

NASA's Global Imagery Browse Services (GIBS) publishes the annual Terra/Aqua MODIS International Geosphere–Biosphere Programme classification. Its source is the 500 m MCD12Q1 Version 6.1 land-cover product. This layer uses its 2021 categorical visualization at a coarser resolution. Credit MODIS Land Cover Science Team, NASA LP DAAC and NASA EOSDIS GIBS. [Product DOI](https://doi.org/10.5067/MODIS/MCD12Q1.061) · [GIBS layer metadata](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual.json) · [Official class palette](https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_IGBP_Land_Cover_Type.xml)

## How a hex gets its illustration

The game draws one feature per land hex. It first looks for a mapped landmark, then the largest ABS urban centre of at least 10,000 residents with its representative point in that same-jurisdiction hex. Capital trading posts use the city-centre marker. An urban block represents built-up cover or a city of at least 100,000 people. Smaller qualifying towns have a cluster of houses. Mountain terrain takes precedence over vegetation on the remaining high-altitude hexes. Everywhere else the most frequently sampled cover group chooses the illustration. A town's census population describes its whole urban centre. Open a hex to see both its illustrated feature and its underlying cover.

The original miniature artwork represents the feature at map scale. The site inspector links directly to the official record for each named landmark. Fremantle Prison and Darwin Military Museum are shown in the nearest same-state land hex within one 25 km spacing because their coordinates fall outside the generalised land grid. The inspector flags those two placements.

## Class groups and measured results

| Index | Code | MODIS IGBP classes grouped here | Dominant hexes |
| ---: | --- | --- | ---: |
| 0 | water | Water bodies, including ocean | 122 |
| 1 | forest | Evergreen, deciduous and mixed forest (1–5) | 465 |
| 2 | shrubland | Closed and open shrublands (6–7) | 8,389 |
| 3 | savanna | Woody savannas and savannas (8–9) | 947 |
| 4 | grassland | Grasslands (10) | 3,404 |
| 5 | wetland | Permanent wetlands (11) | 0 |
| 6 | cropland | Croplands (12) | 596 |
| 7 | built | Urban and built-up lands (13) | 15 |
| 8 | mosaic | Cropland and natural vegetation mosaics (14) | 0 |
| 9 | snow | Permanent snow and ice (15) | 0 |
| 10 | barren | Barren (16) | 275 |

## Sampling and reproduction

Run `python scripts/australia/landcover.py` with NumPy, Pillow and pyproj. The script fetches 18 indexed PNG tiles for 2021-01-01 in the geographic WMTS 500m matrix set, zoom level 5. Each 512-pixel tile spans nine degrees, giving a pixel width of 0.017578125°. It decodes the official discrete colours directly. Downloaded tiles and the palette are cached under `australia-landcover-2021-gibs` in the system temporary directory. [WMTS capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml) · [Example dated source tile](https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual/default/2021-01-01/500m/5/13/36.png)

Each 25 km terrain hex contributes 139 regularly spaced interior samples, including its centre. The builder places them 2 km apart in the terrain's Australian Albers equal-area projection and transforms each sample to the source tile grid. Each classified sample has one vote. The group receiving the most votes wins. For 20 tied hexes, the closest sample belonging to a tied group decides the result, with remaining equal-distance ties resolved south to north, then west to east. All 1,975,607 samples returned a class. [Terrain grid definition](terrain-readme.md)

The whole hex contributes, including its ocean portion. A coastal hex can therefore have water as its dominant class despite a land-based terrain centre. The result is a broad landscape description at approximately 541 km² per hex. Small towns, fields, wetlands and other local features can occur inside hexes dominated by another class.

Two cached rebuilds produced identical output, SHA-256 `d8586258a4597288aa2bb7f8c0de38e5318a9e8f7db7e438b64f10c7bd4d90af`. The terrain input digest was `1eb1cae4de0cc516844d729c546c0366131db337d1d747db057a876d8073807d`. Spot checks found built cover in the hexes nearest central Sydney, Melbourne, Brisbane and Perth, and cropland near 117.4° E, 31.5° S in Western Australia's Wheatbelt.
