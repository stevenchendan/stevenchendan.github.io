# Australian Civilization Atlas

The atlas lives at [`/australia/`](https://stevenchendan.github.io/australia/). Astro builds the route into the portfolio’s GitHub Pages deployment. The browser reads bundled data and requires no API keys. Publish each verified milestone to `master`.

## Milestone 1 · Continental atlas

- [x] Generate 14,213 land hexes with 25 km between neighbouring centres in Australian Albers. Classify terrain from measured elevations and mapped physical regions.
- [x] Join the 2021 ABS Census to the hex grid. Of 14,213 centres, 14,173 fall inside an SA4 that agrees with the terrain jurisdiction. The 40 remaining cells have no census value.
- [x] Ship six map lenses, selectable tiles, pan, zoom, map labels and independently toggleable city and wonder markers.
- [x] Give the eight capital cities a signature district using the most overrepresented industry among those employing at least 5% of local workers.
- [x] Map the 18 World Heritage properties in the mainland, Tasmanian and adjacent coastal selection. Record the selection rule, source coordinates and inscription years.
- [x] Link a sortable table and configurable scatter plot to the map. The Explorer covers all 89 spatial SA4s, including 15 with no matched land hex. Other Territories has an off-grid profile.

The national population comes directly from the 2021 Census. The income lens uses median personal income per week. Regional values apply to the whole statistical area. The atlas has no per-hex GDP estimate.

## Upcoming milestones

| Milestone | Work | Acceptance check |
| --- | --- | --- |
| 2 · Resources and yields | Incorporate power stations, mines, ports and airports. Define production and trade yields from published quantities. | Selecting a resource shows its source, reference year, original unit and yield calculation. Point allocations reconcile to the source inventory. |
| 3 · Settlements and advisors | Extend city coverage beyond the capitals. Add education, climate and disaster lenses and advisors that explain regional comparisons. | Districts and explanations can be reproduced from the displayed geographic unit, numerator and denominator. |
| 4 · Playable scenarios | Add an optional turn-based scenario using the atlas as its starting state. | A player can complete a scenario and distinguish simulated changes from the source observations. |

## Reproduce this edition

The checked-in JSON is ready for the site build. To refresh the geographic and census products, use a Python environment with NumPy, Pillow, pyproj, pyshp 2.x and Shapely 2.x, then run the following from the repository root.

```sh
python scripts/australia/terrain.py
python scripts/australia/regions.py
node scripts/australia/check.mjs
npm run build
```

The terrain script downloads and caches Natural Earth boundaries, physical regions and Mapzen elevation tiles. The census script reads the matching ABS national, regional and capital-city DataPacks and ASGS Edition 3 polygons. Run terrain first because the census join consumes its grid.

The Field guide links to the primary sources and explains coverage, attribution and licensing. The [terrain methodology](../public/data/australia/terrain-readme.md), [census metadata](../site/data/australia/regions.json) and [adapted UNESCO inventory](../site/data/australia/wonders.json) travel with the source.

The [field journal illustration](../public/images/australia/ranges.webp) was made with the built-in image generator. The brief was a panoramic 1930s Australian travel lithograph of the MacDonnell Ranges in afternoon light, with foreground eucalyptus, a red quartzite escarpment, ochre grasses and a dry creek. It is an illustration of the landscape. The mapped terrain comes from the geographic datasets.
