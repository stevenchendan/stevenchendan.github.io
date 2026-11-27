# Australian city and locality footprints

This dataset matches 2021 Australian Bureau of Statistics areas to the campaign's 25 km Australian Albers terrain grid. Each index addresses the zero-based `cells` array in `terrain.json`. Rebuild the footprints after changing that array or its order.

| Object | Key | Value |
| --- | --- | --- |
| `cells` | GCCSA capital code or U/S-prefixed place ID | Sorted indices of terrain cells representing that area |
| `anchors` | Place ID with no overlapping same-jurisdiction hex | Index of a nearby land cell for approximate board placement |
| `membership` | Every S-prefixed suburb/locality ID | Two entries: the UCL ID and the capital GCCSA code covering its representative point. Each can be null. |

IDs follow [the place catalogue](places-readme.md). Capital IDs are the original five-character ABS codes. Canberra uses the Australian Capital Territory GCCSA. Cross-border settlements retain the ABS state parts.

## How the footprint is chosen

The builder projects each full-resolution GDA94 polygon to Australian Albers (EPSG:3577). It selects terrain hexes in the same state or territory whose centres are covered by the polygon. When no centre qualifies, it calculates the polygon's intersection area with each intersecting same-state hex and keeps the single hex with the greatest positive overlap. Adjacent small suburbs can therefore occupy the same cell. A hex covers about 541 km². Use the resulting selections for national-scale game territory.

If there is no positive overlap, the builder records a separate anchor only when the nearest same-state terrain centre lies within 25 km of the area's representative point. An ID absent from both dictionaries has no board position at this resolution. Its published place record remains available.

Suburb membership uses a separate operation at full polygon resolution. Each suburb's interior representative point is tested against the urban centre/locality and capital-region polygons in its state. A suburb can straddle the edge of either geography, so membership describes the point. It is unsuitable for aggregating suburb populations into official city totals.

## Measured coverage

| Geography | Centre-covered hexes | Greatest-overlap hex only | Nearby anchor only | Off grid |
| --- | ---: | ---: | ---: | ---: |
| Capital regions | 8 | 0 | 0 | 0 |
| Urban centres and localities | 51 | 1,583 | 147 | 28 |
| Suburbs and localities | 2,982 | 11,539 | 737 | 76 |

Counts in the table are numbers of areas. Across the 15,334 suburb representatives tested, 3,894 fall in a named UCL and 3,382 fall in a capital region. The terrain input has 14,213 cells and SHA-256 digest `1eb1cae4de0cc516844d729c546c0366131db337d1d747db057a876d8073807d`.

## Sources and reproduction

Based on Australian Bureau of Statistics data. ABS data used with permission from the Australian Bureau of Statistics. Footprints and memberships are derived from the 2021 ASGS Edition 3 GCCSA, UCL and SAL boundaries. ABS SAL boundaries approximate Geoscape locality data. [Digital boundary files](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files) · [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) · [Terrain grid and attribution](terrain-readme.md)

Run `python scripts/australia/footprints.py` after generating terrain, regional profiles and places. The script uses NumPy, pyproj, pyshp 2.x and Shapely 2.x. It checks every input ID, jurisdiction and capital footprint, verifies membership uniqueness and reports counts for each method.
