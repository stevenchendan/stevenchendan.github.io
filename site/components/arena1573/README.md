# 1573 Arena — Court Atlas

## Portfolio copy

Copied from `D:/dev/Tennis-Agent/frontend` and served here at `/australian-open`.
The Astro route mounts the original React experience in the browser, with the
original CSS reset, context data, GLB models and cinema audio. The Next.js home
link is replaced with a native anchor; scene code and styling are unchanged.
Run `npm run build`, `node scripts/check-1573-solar.mjs`,
`node scripts/check-1573-rally.mjs` and `node scripts/check-ao-precinct.mjs` here.
The following notes preserve the upstream modelling history; regeneration tools
and editable Blender sources remain in Tennis-Agent.

## Upstream notes

Portfolio crowd update: `Visitors.tsx` adds 180 instanced walking visitors using
the local pedestrian network, with building/court exclusions and an illustrative
1573 entrance vestibule. Arrivals and departures turn around out of sight inside
the vestibule; this is ambient animation, not a simulation of connected interior
routes or live attendance. Event crowd starts enabled and controls both walkers
and seated spectators. Reduced-motion preferences freeze walking and limb motion.
Validate routing and animation continuity with `node scripts/check-visitors.mjs`.

Independent route: `/1573-arena`. No changes to the existing Melbourne Park page.

The header offers Classic and Ink wash themes with a saved local preference. Ink wash uses a Three.js postprocessing pass for warm paper fibres, muted mineral-colour washes, fine hatching and crisp broken pen contours inspired by the supplied landscape painting; imaginary mountain silhouettes are an artistic backdrop. Fog is reserved for the distant landscape, while local lighting values and cast shadows remain distinct. It also applies to saved PNGs. Switching themes preserves the model, camera, lighting and interaction state. Both themes use compact navigation and support English/Chinese.

`model.ts` builds metre-scale Three.js geometry: regulation court markings, a sagging net, twelve rounded seating tiers, 2,822 instanced seats, handrails, shade hoods, six lighting masts, benches and an umpire chair. Architecture, landscaping and crowds are interpretive, not surveyed. The neighbouring arenas use separate OpenStreetMap polygons; the combined city footprint is deliberately excluded to prevent overlapping roof volumes.

The four user-supplied interior photographs inform the raised seating base: an estimated 1.65 m lift, continuous pale retaining wall with a dark upper fascia, lighter blue seating and intermediate aisle treads. `dimensions.ts` shares the lift between geometry, seated cameras and sunlight samples. Court level and neighbouring building heights are unchanged; the photo-derived height is not a surveyed measurement.

The supplied Google Earth oblique view informs a second precinct pass: Margaret Court Arena has clipped copper roof bays, lower perimeter slopes, glazed walls and mullions; Rod Laver has a separate pale roof with a central opening. Batman Avenue and the elevated Tanderrum Bridge follow existing mapped paths. The Yarra water edge and planting are approximate offsets from the mapped riverside trail. These rebuilt meshes use no Google imagery or downloaded Google mesh assets. Roof elevations, bridge elevation and river width remain visual estimates; they affect the indicative sunlight comparison. The precinct camera now includes more of the river and practice courts.

`ArenaExperience.tsx` provides six camera presets, orbit/zoom/pan, day/sunset/night lighting, context and crowd toggles, clickable points of interest, a demonstration ball animation, PNG capture and fullscreen. The page works without external textures, fonts, map keys, a backend or a runtime Blender installation. WebGL 2 is required.

Regenerate the compact local context from the existing dataset with `node scripts/extract-1573-context.mjs` from `frontend`. The source data attribution is preserved in `public/data/1573-context.json`, and the UI links both the sources and the downloadable derivative. City building data: CC BY 4.0. OpenStreetMap data: ODbL 1.0. Google Maps is a visual reference only; no map imagery is redistributed.

Visual references: the user-supplied Google Maps satellite view of 1573 Arena and Tennis Australia's `ImportantlocationsAO21.pdf`. Day/sunset/night and ball movement remain illustrative presets.

Summer sun covers January and February in a separate date/time mode (05:00–22:00 AEDT, UTC+11), defaulting to 15 January 2027. `solar.ts` implements the published NOAA approximate solar-position equations at the arena coordinates, including the model's 0.142-radian rotation. Sunrise/sunset use a −0.833° horizon threshold. Directional shadows follow the calculated sun; below the horizon there is no direct sunlight. The mode works in both visual themes.

The stand comparison casts rays toward the sun from nine seated head-height samples per side (three rows × three positions). It includes modelled structural blockers and keeps the surrounding buildings visible; instanced seats, people and decorative trees are excluded from the comparison. These counts describe the approximate model, not surveyed seat availability or guaranteed real-world shade. Clicking a stand moves the camera to that side. Clouds, temporary structures and UV are not simulated.

Run `node scripts/check-1573-solar.mjs` from `frontend` to check solar directions, coordinate rotation, January/February daylight boundaries, leap years and input validation. Method: https://gml.noaa.gov/grad/solcalc/solareqns.PDF.

`TennisRally.tsx` adds two articulated, stylized players with lateral recovery, racket swings and a synchronized bouncing ball. The grey shirt/white cap and yellow shirt take visual cues from the supplied Tennis TV reference (https://www.youtube.com/watch?v=5gj4iLvsQOo). This is hand-authored choreography, not motion capture or an exact match replay. Auto orbit starts the rally; Play/Pause rally controls it independently. `node scripts/check-1573-rally.mjs` checks trajectory continuity, net clearance, bounce height and racket contact alignment.

The players now load the original Blender-authored `public/models/tennis/club-player.glb`, with a sculpted stylized face, shaped jersey/shorts, fingers, socks, shoes and a strung racket. The editable `.blend` and studio `.png` sit alongside it. Regenerate with `D:/blender/blender.exe -b --python scripts/build-tennis-player.py`. No third-party character assets are used. The model has named articulated parts, not a skinned motion-capture rig; runtime choreography positions those parts, rotates the torso and keeps the hand on the racket grip. Two jersey colors distinguish the opponents. Character loading has its own Suspense boundary so the arena stays visible while loading.

Run `npm run dev -- --port 3100`, then open `http://localhost:3100/1573-arena`. Shortcuts: 1–6 camera presets, R reset, H hotspots, Space orbit, Escape close panels.

## AO precinct expansion — September 2026

Documented before implementation in the tennisAgent Linear project:
- [AGE-277: precinct geometry](https://linear.app/agentautomation/issue/AGE-277)
- [AGE-278: navigation](https://linear.app/agentautomation/issue/AGE-278)
- [AGE-279: Blender assets](https://linear.app/agentautomation/issue/AGE-279)

The AO grounds preset (6) fits the wider site. The venue selector and clickable labels focus 1573, Margaret Court, Rod Laver, Kia, John Cain, the western/eastern courts and Grand Slam Oval. Reset or preset 1 returns to 1573. Choosing a precinct destination restores hidden surroundings. English/Chinese and Classic/Ink wash remain available.

Reference: [AO26 digital map](https://ausopen.com/digitalmap), inspected 6 September 2026. The source page describes the AO26 map, even while its surrounding website advertises AO27. Coloured washes are approximate orientation areas, **not** official event boundaries, ticket zones, surveyed geography, or a complete reproduction of the map's temporary facilities. Vendor listings and opening times remain on the official linked map. Permanent footprints and paths come from the existing attributed local data; no PAM meshes or textures are copied.

The extraction now includes 106 building tiers and 565 mapped features, extending to the eastern practice courts. John Cain uses its individual OSM outline, with overlapping city tiers removed by footprint containment. Its wall/roof opening and facade fins are interpretive. Kia's bowl is an original Blender model anchored to the first four corners of mapped court `way/1239949236`; stand dimensions are approximate. The optional Kia detail loads independently, so an asset failure leaves the mapped court and the main scene usable. It is decorative context and is not included in the coarse 1573 stand shade raycast; the Three.js context buildings are included.

Regenerate, from `frontend`:
```
node scripts/extract-1573-context.mjs
D:/blender/blender.exe -b --python scripts/build-ao-precinct.py
node scripts/check-ao-precinct.mjs
```

Editable source: `public/models/precinct/ao-precinct.blend`. Runtime: `public/models/precinct/ao-precinct.glb` (243.9 KiB, one mesh, three material primitives). The script uses metres and converts Three.js X/Y/Z to Blender X/-Z/Y before glTF's Y-up export. Source attribution for the derivative context continues to apply to the mapped placement.

Validation: precinct data/GLB checks, solar and rally checks, TypeScript, ESLint and production build; browser review of the full grounds, Kia navigation, English/Chinese and a 390 × 844 mobile viewport. The solar check harness's local `module` binding was renamed to satisfy the existing Next.js lint rule without changing the calculation.

## Rendering repair audit — AGE-280

[AGE-280](https://linear.app/agentautomation/issue/AGE-280) tracks the follow-up prompted by the broken eastern-court screenshot. The first implementation's overview checks missed geometry problems; the follow-up explicitly inspected each destination.

`precinctGeometry.ts` derives the court frame from all polygon vertices and its long edge. Eastern pitches have chamfered corners: taking only their first four vertices incorrectly shifted their centre toward an end. The renderer now uses the actual polygon for each runoff, keeps the regulation playing area unscaled, and rotates markings and fences with the footprint. Adjacent runoffs no longer overlap. Path strips are clipped outside court enclosures with half-width clearance. Context nets use simple surfaces to avoid distant wire aliasing.

The camera near plane adapts to orbit distance, retaining floor/line depth precision at distant venues. Destination cameras have individual framing. Headings identify the selected venue; the 1573 coordinate and seat-count information stays with 1573. Show labels now controls the venue labels as well. Mood shadows and night lights follow the focused venue; solar calculation and shade analysis stay anchored to 1573.

City `Bridge` classification survives extraction. Its elevation envelope is rendered as a thin raised deck and supports, rather than a solid wall. Rod Laver and John Cain now have interior floors and stepped seating bowls below their roof openings, with one court each; Rod Laver roof seams stay outside the opening. Kia's regenerated Blender asset adds rounded tiers, aisle steps, a continuous canopy and a concourse floor. These architectural details remain interpretive.

| Destination | Visual review and repair |
| --- | --- |
| 1573 Arena | Original court, seats and rally retained; closer destination framing checked |
| Margaret Court Arena | Roof and perimeter checked in day/sunset; dedicated camera and shadows |
| Rod Laver Arena | Terrain/path bleed replaced by floor and seating; roof-opening seams fixed |
| Kia Arena | Rounded Blender bowl, aisles, floor and canopy; nearby bridge no longer a wall |
| John Cain Arena | Floor and seating visible through roof; night lighting checked |
| Western courts | Footprint-aligned runoffs, fences and path clearance; group camera checked |
| Eastern courts | Every octagonal footprint centred correctly; no blue overlap striping; group camera checked |
| Grand Slam Oval | Stable coloured ground surface and mapped paths checked; still an indicative area without temporary attractions |

Additional browser checks cover eastern courts in Ink wash at 390 × 844 and context/label controls. Regression checks exercise the real Court 18 octagon centre, all eastern court dimensions, rotated footprints, path clipping (crossing, interior and exterior), bridge classification and Blender colour/material/size constraints.

### Rain preset (AGE-281)

Rain sits beside Day, Sunset and Night. It uses cool diffuse daylight, reduced direct light without directional shadows, haze, and a camera-following shower in one Three.js draw call. Both languages and visual themes are supported. Switching modes unmounts the shower; solar analysis remains exclusive. Rain motion freezes for prefers-reduced-motion. This is illustrative weather, with no forecast feed or roof/water collision simulation.

Verified production rendering at 1573 and Eastern courts, Classic and Ink wash, English/Chinese labels, 390 × 844 settings, switching Day/Rain and solar exclusivity. Lint, production build/type checking, precinct, solar and rally checks passed.

## Cross-validated precinct rebuild (AGE-282–286)

See `docs/precinct/reference-audit.md` for source comparisons, imagery-date limits and modelling decisions, and `docs/precinct/building-inventory.json` for all 107 current footprint/tier records. Regenerate the inventory with `node scripts/audit-precinct.mjs`.

The new pass corrects six clay courts, five elevated hard courts, outdoor screens/lights and western show-court seating; reconstructs arena trusses, pleats, entry pods and instanced seats; adds NTC roof cowls and Centrepiece; and distinguishes tram platforms, open bridges and peripheral stadium voids. Paving now has an original metre-scaled pattern. Roof poses, temporary oval amenities, heights and minor facades remain interpretive. No reference imagery or proprietary mesh assets are embedded.

Kia's editable seat design remains in the Blender file but is excluded from the GLB; runtime instancing keeps the shell at 857.9 KiB. The precinct asset budget is now 1 MB. There are 589 context features including mapped railways. The original 1573 model remains the close-view reference.

## Tennis on every court (AGE-287)

Cinema soundtrack (AGE-294): user-supplied `Music up.mp3` is stored unchanged at `public/audio/cinema-music.mp3`. The cinema button starts playback directly from its click gesture, from the beginning, looping at 40% volume. Exit/Escape pauses; unmount cleans up. Audio is not fetched until entry (`preload="none"`).

Spectators (AGE-292): the shared toggle now also controls MCA and Rod Laver. Their seated crowds sample actual bowl seat positions after aisle exclusions, with varied clothing/skin colours and two instanced meshes per arena. The crowd group inherits surroundings visibility; cinema mode preserves the selection.

Cinema mode (AGE-291): the Cinema mode button hides all interface panels, navigation, titles and scene labels. The scene stays mounted, preserving camera, lighting and playback. A compact Exit cinema button remains reachable on desktop/mobile; Escape exits even from a focused control. Hidden interface elements are removed from keyboard navigation through display:none. Labels restore their previous preference on exit.

Camera/paving regressions (AGE-289/290): preset transitions temporarily disable auto-rotation and residual damping, then hand control back once camera and target settle. Precinct paving rectangles are partitioned into disjoint cells to eliminate coplanar overlap beside 1573. The precinct regression script checks union area, non-overlap and stable overlap colour. Production build and browser Overview → Auto orbit (without zoom), plus overhead Sunset paving, verified.

All 31 modelled courts have two players, rackets and a moving ball. Play starts automatically; the shared rally button pauses/resumes every court. The original detailed 1573 players remain, while the other 30 rallies use six instanced draw calls and staggered rally phases. Surroundings visibility also controls the precinct players. Closed arena roofs naturally obscure indoor rallies.

`courtPlacements.ts` shares raised court elevations with the surface builder and aligns arena rallies to their model centres. `node scripts/check-precinct-rallies.mjs` verifies coverage, uniqueness, five elevated courts, clay court elevation and finite motion. The existing rally check verifies bounce, net clearance, continuity and racket contact.
