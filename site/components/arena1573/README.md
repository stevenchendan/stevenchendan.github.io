# 1573 Arena — Court Atlas

## Interactive experience

The summer sun controls play 05:00 through 22:00 AEDT in about 11.5 seconds at the default 4× pace. Each colour represents nine seated-head positions across a bay and the date, clock and roof controls also drive the view from the seat. The local sunlight asset stores open-sky directions sampled against the reconstructed stadium and surrounding structures, including the parked roof leaves. Example: `?arena=rla&section=6&date=2027-01-17&time=09:00`. Select Night or move the solar clock past dusk to see fixed floodlighting on all 31 courts.

The park surface, riverbanks and two peripheral stadium textures use a reprojected crop of the City of Melbourne’s May 2020 orthophoto. The ground crop masks court surfaces, mapped roofs and the later eastern construction. Canopy positions are derived from visible foliage and the close-up foliage and spectator textures are original generated assets. The tournament overlay uses the 2026 event map, and the seating plan represents the 2027 opening-day session. The scene includes approximate heights and temporary installations. [City of Melbourne aerial imagery](https://discover.data.vic.gov.au/dataset/2020-aerial-imagery), [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/), [MCG light towers](https://www.mcg.org.au/about/stadium-operations/light-towers).

The home view at `/ao/` (with `/australian-open/` redirecting to it) opens above Rod Laver Arena at sunset. The rendered aerial, seating guide and venue list are available before the 3D viewer loads. Exploring the aerial, using the scene controls or selecting a venue starts 3D. A shared seating link opens its arena directly. The viewer builds venues separately, keeps completed venues for subsequent camera changes and reports loading progress over the aerial.

The six-shot film visits the precinct, the Margaret Court roof, a high baseline view inside Rod Laver and a closer 1573 rally. Rain closes the John Cain roof in shot five. The finale pulls back across the grounds as the courts light up at night. The film clock drives both weather cues and pauses while a venue loads. Previous and Next replay the cues independently of the visitor’s atlas weather. Reduced motion starts the film paused. From a ticket section, dragging changes the direction of the gaze while keeping the eye at the seat. The western and eastern groups and Practice Village have individual court selectors. A visit to `?arena=rla&section=6` restores that section. A court selector opens an elevated overview of the selected court.

The illustrated seating guide references Ticketmaster's 17 January 2027 day-session plans. It maps 54 Rod Laver, 41 Margaret Court and 80 John Cain bays, with the official plans and booking links in the guide. Three-dimensional sightlines are approximate. The Rod Laver interior has two distinct seating banks above the sunken court, section-aligned aisles, fascia, hanging screens and roof catwalks, reconstructed using match-day photographs and Tennis Australia's venue account. Live sales, assigned rows and seat inventory are managed by Ticketmaster.

Rain drives a reversible, accelerated roof motor at the three retractable-roof venues. The falling rain follows the opening and stops at the fixed canopy or moving roof leaf. Reduced motion changes to the resulting roof position immediately. The autograph guide links to the official practice schedule, shows the Practice Village in the model, and distinguishes public viewing opportunities from event-specific signing arrangements.

Each court has a four-point match built from service, return, baseline and net-play patterns. A seeded cast and kits stay consistent in the ticket-seat view and the precinct. All courts have seated spectators, ball crew, a chair umpire and two player benches. The bench guide links the relevant AO25 floor drawing when one is available. It labels approximate placements on the other courts.

Each athlete has an independent skinned skeleton. The captured strokes, calibrated racket release and Quaternius running animation share a single ball and footwork timeline. Recovery changes from short shuffles to crossover runs as the distance increases. World-space foot contacts constrain the stance foot during a stride. All 31 courts have individual court links. For example, `?arena=east&court=19` opens the elevated overview of Court 19. Nearby players switch to full skinned meshes as the user zooms, including while paused. Distant courts sample the same motion and keep the same court-specific uniforms. Both detailed players have fitted five-finger hands and per-shoe contact shadows. Sources and redistribution notices are in `public/models/tennis/motion-credits.txt`.

Run `npm run build` and the `scripts/check-*.mjs` checks. To regenerate athlete assets, use the Blender modelling script and `pack-rally-athlete.mjs` with the Tennis-Agent frontend checkout, then `node scripts/pack-precinct-motion.mjs`.

The ticket-section sunlight lookup uses a two-degree sky grid and nine seated-head positions per bay. Its centre is the same eye used by the 3D camera. The other samples span front, middle and rear rows and the width of the bay. The bake casts through the reconstructed precinct with all three roofs parked open. A closed roof or a sun below the horizon gives zero direct-sun samples. Regenerate the data after changes to the seating geometry, ticket regions or roofs with `node scripts/bake-seat-sun.mjs`. Use `node scripts/bake-seat-sun.mjs --check` to compare the saved file with fresh rays on four summer dates.

## AO26 event grounds

The Central Terrace around Kia Arena uses original charcoal and pale stone paving, planted seating berms, tree grilles and pedestrian lights. Its landscape and the two-storey CENTREPIECE frontage follow published architectural photographs. The Grand Slam Oval lounges use grass, curved seating and round tables based on the event supplier’s AO26 gallery. The 2020 photograph supplies the surrounding transport and parkland context. [ASPECT Studios landscape photographs](https://www.aspect-studios.com/projects/melbourne-park), [CENTREPIECE design account](https://centrepiecemelbourne.com/news/how-centrepiece-achieved-design-excellence/), [Valiant AO26 event furniture](https://valiant.com.au/events-gallery-australian-open-2026-grand-slam-oval).

The summer clock sits below the four lighting presets and follows the visitor across camera views. Entering a Melbourne time, moving the slider or pressing play switches the scene to that date and time. The compact camera strip scrolls horizontally on a phone. The Court Atlas wordmark returns to the opening aerial.

The grounds selector includes the three Birrarung Marr areas, Garden Square, Rod Laver Arena Terrace, the Court 6 Courtside Bar, the Practice Village and Grand Slam Oval. The 2026 transport map supplies their relationships. An event-day aerial informs the placement of temporary structures. Slides, decks, stage equipment, screens and market buildings are original approximate reconstructions. The event-day reference is not distributed with the model. The comparison uses [Tennis Australia's transport map](https://ausopen.com/sites/default/files/2026-01/ao26_transport-map.pdf), [sensory map](https://ausopen.com/sites/default/files/2026-01/ao26-sensory-map.pdf), [guide to the event areas](https://ausopen.com/articles/news/ao-2026-your-guide-worlds-melbourne-park), [2026 venue changes](https://ausopen.com/articles/news/ao-2026-takes-fan-experience-new-heights), and [Lensaloft's event-day tour](https://www.lensaloft.com.au/Interactive_tour/AustralianOpen/AO).

Run `node scripts/check-event-layout.mjs` to check the event structures against mapped buildings, court enclosures and pedestrian routes.

## Historical upstream notes

The following entries describe earlier iterations of the Tennis-Agent source. Current behaviour is documented above.

Portfolio event-ground update: `eventLayout.ts` places original food, coffee,
shaded viewing and lawn pockets in clear concourse space. Layout checks reserve
clearance around mapped buildings, playing enclosures, pedestrian routes and
the existing oval facilities. `EventFacilities.ts` adds counters, queue rails,
pergolas, tables, low planting, signs and markings at existing road/footpath
intersections. These are illustrative facilities inspired by the 2026 view in
https://www.lensaloft.com.au/Interactive_tour/AustralianOpen/AO, not a surveyed
reproduction or a current vendor directory. No reference imagery is used as
textures; the ground remains tree-free. All dressing follows Surroundings.
Validate with `node scripts/check-event-layout.mjs`.

Portfolio crowd update: `Visitors.tsx` adds instanced walking visitors using
the local pedestrian network, with building/court exclusions. Visitors turn
around on these outdoor paths; this is ambient animation, not a simulation of
connected interior routes or live attendance. Event crowd starts enabled and controls both walkers
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
Margaret Court Arena has a lower seating bank and a raised upper bank. The section numbering follows the [Ticketmaster session plan](https://s1.ticketm.net/tmimages/venue/maps/au2/97091s.gif). The [Tennis Australia seating map](https://www.tennis.com.au/doc/ao-mca-map) provides a second plan reference, and the [Australian Steel Institute redevelopment case study](https://steel.org.au/what-we-do/case-studies/margaret-court-arena,-melbourne/) describes the additional seating tiers at concourse level. The 13 lower and nine upper model rows, aisle width and elevations are visual estimates. Both the seat geometry and the section viewpoints use `mcaProfile.ts`.

