# Australian terrain hexes

The offline atlas bundles 14,213 pointy-top hexagons in GDA94 / Australian Albers (EPSG:3577). Centres of adjacent hexagons are 25,000 projected metres apart. Each hexagon covers approximately 541.27 km². Latitude-dependent projection distortion affects distances on the ground.

## Coverage and fields

A hexagon belongs to the state or territory whose Natural Earth land polygon contains its centre. Coverage includes the mainland, Tasmania and nearby islands large enough to contain a grid centre. The eight jurisdictions contribute WA 4,667, NT 2,500, SA 1,810, QLD 3,204, NSW 1,481, VIC 420, TAS 127 and ACT 4 cells. External territories, Jervis Bay Territory and remote islands are outside this edition. The hex coastline and state borders are generalised at the grid scale.

Each entry in `cells` is `[q, r, stateIndex, terrainIndex, elevationMetres]`. Indices address the zero-based `states` and `terrains` arrays. For projected coordinates use `x = 25000 * (q + r/2)` and `y = 25000 * sqrt(3)/2 * r`. North is positive y. Hex circumradius is 25,000 / √3 metres. To place a city, project WGS84 longitude and latitude to EPSG:3577 using conventional GIS axis order.

## Elevation and terrain

Mapzen Terrarium zoom 5 pixels supply elevations in metres. The builder samples the containing pixel at each centre and at six positions 8 km away, at 60-degree intervals in projected space. It discards offshore sample positions, takes the median elevation and rounds to the nearest metre. Values in this edition span −15 to 1,555 m. Peaks smaller than the sample spacing are smoothed. Relief is the difference between the highest and lowest retained samples in a cell.

Terrain labels are cartographic interpretations. The first applicable rule wins.

| Terrain | Rule |
| --- | --- |
| Mountains | Median elevation ≥900 m |
| Desert | Centre inside a Natural Earth desert region |
| Hills | Relief ≥160 m or centre inside a mapped mountain range |
| Plains | Centre inside a mapped plain |
| Plateau | Centre inside a mapped plateau or median elevation ≥450 m |
| Lowlands | Median elevation below 100 m |
| Plains | All remaining cells |

## Sources and attribution

- Coastline, state boundaries and physical regions are adapted from Natural Earth 1:10 million vector polygons. [States and provinces](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) · [Physical vectors](https://www.naturalearthdata.com/downloads/10m-physical-vectors/) · [Public domain terms](https://www.naturalearthdata.com/about/terms-of-use/)
- Elevation derived from Mapzen Terrain Tiles. Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017, licensed under CC BY 4.0. Global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey (public domain). Global ETOPO1 terrain data from NOAA National Centers for Environmental Information (U.S. public domain). The builder samples and aggregates these source tiles. [AWS open data registry](https://registry.opendata.aws/terrain-tiles/) · [Source-specific licences and attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## Rebuild

From the repository root, in a Python environment, run

```sh
python -m pip install "shapely>=2,<3" pyproj pyshp pillow numpy
python scripts/australia/terrain.py
```

The script downloads the two source shapefile archives and the required Terrarium PNG tiles into the system temporary directory under `aus-atlas-src`. Pass `--cache PATH` to reuse an archived input set. A cached build works offline. The builder validates cell count, unique coordinates, all eight jurisdictions, all terrain categories and the elevation range before writing `public/data/australia/terrain.json`.

Natural Earth input SHA-256 digests for this edition are `efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05` (states) and `cb7b9db200284ed1551f20eacc7f3333e9b5f311c19f7cb2670694529f688682` (physical regions).
