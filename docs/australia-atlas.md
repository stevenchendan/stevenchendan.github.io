# Australia · Common Ground

[`/australia/`](https://stevenchendan.github.io/australia/) opens a single-player economic strategy campaign. The World atlas, Explorer and Field guide are available alongside the game. Astro ships the application and its data through the portfolio’s GitHub Pages deployment. Publish each verified milestone to `master`.

## Milestone 1 · Continental atlas

- [x] Generate 14,213 land hexes with 25 km between neighbouring centres in Australian Albers. Classify terrain from measured elevations and mapped physical regions.
- [x] Join the 2021 ABS Census to the hex grid. Of 14,213 centres, 14,173 fall inside an SA4 that agrees with the terrain jurisdiction. The 40 remaining cells have no census value.
- [x] Ship six map lenses, selectable tiles, pan, zoom, map labels and independently toggleable city and wonder markers.
- [x] Give the eight capital cities a signature district using the most overrepresented industry among those employing at least 5% of local workers.
- [x] Map the 18 World Heritage properties in the mainland, Tasmanian and adjacent coastal selection. Record the selection rule, source coordinates and inscription years.
- [x] Link a sortable table and configurable scatter plot to the map. The Explorer covers all 89 spatial SA4s, including 15 with no matched land hex. Other Territories has an off-grid profile.

The national population comes directly from the 2021 Census. The income lens uses median personal income per week. Regional values apply to the whole statistical area. The atlas has no per-hex GDP estimate.

## Milestone 2 · Playable regional charter

The player leads a council. Each turn commits one order from a limited treasury. An early market funds later trade routes, a workshop pays for construction, and a campus earns prosperity at the cost of a settlement’s only district slot. Victory requires four settlements in the network and 50 prosperity within twelve turns.

- [x] Start in Bendigo or choose a seat from 1,809 ABS urban centre/locality records and 15,334 suburb/locality records. Preserve same-name areas and show the source geography and population year.
- [x] Place the seat and six named neighbouring communities on a 61-hex isometric board. Search the national register to bring additional destinations into the same campaign. Routes use geographic distance from the nearest linked settlement. The tactical board spreads places apart for legibility.
- [x] Show each purchase, recurring yield and projected turn-end balance before committing. New buildings and trade routes appear on the board. Census population and local terrain influence district specialisation.
- [x] Forecast seasonal events, record orders, resolve victory or expiry, and restore completed turns on the same browser. Starting a replacement campaign prompts before overwriting an active charter.
- [x] Surface regional settlements on the continental atlas and reveal suburbs with zoom. A place listed in search can be located on the map and used as a council seat.

The catalogue includes 686 geographic records with a published population of zero. The scenario can place a hypothetical council at these locations. The surrounding communities are drawn from populated SALs. Catalogue populations refer to overlapping ABS geography types and are never added to calculate a campaign population. Coordinates, source links and coverage are in the [settlement data notes](../public/data/australia/places-readme.md).

The miniature buildings and trees are game artwork. The six [board sprites](../public/images/australia/game/) were created with the built-in image generator as sunlit isometric Australian town hall, houses, market, workshop, campus and eucalyptus illustrations.

## Upcoming milestones

| Milestone | Work | Acceptance check |
| --- | --- | --- |
| 3 · Resources and yields | Incorporate power stations, mines, ports and airports into regional trade decisions. | A player can compare two routes using their facility, source year, unit and in-game effect. |
| 4 · Regional scenarios | Add region-specific objectives and advisors informed by education, climate and industry. | The opening decision and viable strategies differ between a coastal port, an inland town and a metropolitan suburb. |

## Reproduce this edition

The checked-in JSON is ready for the site build. To refresh the geographic and census products, use a Python environment with NumPy, Pillow, pyproj, pyshp 2.x and Shapely 2.x, then run the following from the repository root.

```sh
python scripts/australia/terrain.py
python scripts/australia/regions.py
python scripts/australia/places.py
node scripts/australia/check.mjs
node scripts/australia/check-campaign.mjs
npm run build
```

The terrain script downloads and caches Natural Earth boundaries, physical regions and Mapzen elevation tiles. The census script reads the matching ABS national, regional and capital-city DataPacks and ASGS Edition 3 polygons. Run terrain first because the census join consumes its grid.

The Field guide links to the primary sources and explains coverage, attribution and licensing. The [terrain methodology](../public/data/australia/terrain-readme.md), [census metadata](../site/data/australia/regions.json) and [adapted UNESCO inventory](../site/data/australia/wonders.json) travel with the source.

The [field journal illustration](../public/images/australia/ranges.webp) was made with the built-in image generator. The brief was a panoramic 1930s Australian travel lithograph of the MacDonnell Ranges in afternoon light, with foreground eucalyptus, a red quartzite escarpment, ochre grasses and a dry creek. It is an illustration of the landscape. The mapped terrain comes from the geographic datasets.
