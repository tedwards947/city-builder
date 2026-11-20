# Scale

One metre for every asset. Draft 1 (2026-11-19); the owner's picks from the review page will be added here.

Review page: `node art/clay-set/scale/build.mjs out.html` builds it (sprites inlined), from `art/clay-set/scale/template.html` and `audit.json`. `art/clay-set/scale/measure.html` (open it on the dev server) measures every clay sprite.

## The anchor

A highway tile holds four lanes. At 3.1 m a lane plus verges, **one tile is 17 m**. The road code agrees: highway lane centres are 0.18 tile apart (`LANES` in `src/render/clay/roads.ts`), a street is 0.5 tile wide (8.5 m) and an avenue 0.84 (14 m).

## Numbers

| | value |
|---|---|
| One tile | 17 m |
| Across, in the game | 0.0588 tile per metre (1/17) |
| Across, in a 128 px clay sprite | the plot is 101 px wide (x 13–113), so 5.9 px per metre |
| Depth (ground, into the screen) | drawn 0.905 of the width in the sprite (`PLOT_ASPECT`); the game stretches it back to a square tile |
| Height, in a 128 px sprite | 11 px per 3 m floor (3.7 px per metre) |
| Height, in the game | 0.12 tile of screen per floor (0.04 tile per metre) |

The floor height was measured from the art the owner says looks right: the level 1–2 houses and the window rows of today's level 3 towers all land at about 11 px a floor at 128 px. Heights are drawn about 0.68 of what the camera angle would give; that is the house style and the new art keeps it.

## Target sizes

| Thing | Real size | Tiles | 128 px sprite |
|---|---|---|---|
| Car | 4.5 × 1.8 m | 0.26 × 0.11 | 27 × 11 px |
| Van | 5.5 × 2.0 m | 0.32 × 0.12 | 33 × 12 px |
| Truck (rigid) | 9 × 2.5 m | 0.53 × 0.15 | 53 × 15 px |
| Bus | 12 × 2.55 m | 0.71 × 0.15 | 71 × 15 px |
| Train car | 20 × 3.0 m (metro 18 m) | 1.18 × 0.18 | 119 × 18 px |
| Plane | 38 m long, 36 m span | 2.2 | (2-tile sprite today) |
| Ship | 70–140 m | 4–8 | owner's call |
| Garden tree | canopy 6–8 m, 10–15 m tall | 0.35–0.45 across | 36–47 px |
| Forest tree | 15–20 m tall | about 0.9 tall | |
| Person | 1.75 m | 0.07 on screen | under 4 px at most zooms: not drawn |
| Floor | 3 m (shop ground floor 4 m, industrial bay 6–8 m) | 0.12 on screen | 11 px |

## Footprints and heights

| Lot | Footprint | Height |
|---|---|---|
| Level 1 house | 8–10 m (0.5–0.6 tile) | 1–2 floors |
| Level 2 house, terrace | terrace about 14 m wide | 2–3 floors |
| Level 3 home, 1×1 | block 12–14 m (0.7–0.8 tile) | 3–5 floors |
| Level 1–2 shop | 10–14 m | 1–2 floors |
| Level 3 shop, 1×1 | most of the lot | 2–4 floors, mixed use |
| Industry, 1×1 | sheds to a works filling the lot | 8–15 m |
| Tower, 2×2 | 20–25 m (1.2–1.5 tiles) on a 34 m lot, podium optional | owner to pick: floors, and true / 75% / 50% height |

Real towers come only from 2×2 lots (owner, 2026-11-19). A true-height 20-floor tower rises 2.4 tiles on screen above its front edge, so it hides the tiles behind it; hover-to-hide (also on mobile) is planned with TODO h.

## Audit (2026-11-19)

| Asset | Now | Target | Verdict | Fix |
|---|---|---|---|---|
| Road lanes | lane 3.1 m; street 8.5 m, avenue 14 m | same | OK | the anchor |
| Road car | 4.3 × 2.6 m (0.25 × 0.15 tile) | 4.5 × 1.8 m | too wide | code: `bakeCar` in roads.ts |
| Van | 5.1 × 2.6 m | 5.5 × 2.0 m | too wide | code |
| Truck | 6.8 × 2.9 m | 9 × 2.5 m | too short | code; needs two traffic slots (`SLOT_SPACING` is 0.36 tile, 6.1 m) |
| Bus | none | 12 × 2.55 m | owner's call | code |
| Parked car (lot dressing) | 2.5 × 1.1 m, bays 1.7 m | 4.5 × 1.8 m, bays 2.5 m | too small | code: `addParking` in lotDressing.ts |
| Garden trees (lot props) | canopy 3.4 m | 6–8 m | too small | code: the prop table in lotDressing.ts |
| Wild trees | about 15 m tall | 12–20 m | OK | |
| Train car | 12.8 × 3.4 m (`CAR_LEN` 0.75) | 20 × 3.0 m | too short | code: trainNet.ts; check station platforms |
| Plane | 34 m | 38 m | OK | |
| Ship | 38 m (`SHIP_LENGTH` 2.25) | 70–140 m | owner's call | bigger seaport and new art |
| Level 1–2 homes, shops, industry | | | OK | |
| Level 3 homes (13 designs) | 6–8 floors, about 5 m wide | 1×1 mid-rise; towers to 2×2 | too thin, squeezed into the square frame | redraw (paid images: ask first) |
| Level 3 shops (13 designs) | 6–9 floors, about 5 m wide | 1×1 2–4 floors; towers to 2×2 | as above | redraw |
| Level 3 industry | works filling the lot | same | OK | |
| Police, fire, school, hospital | 1–2 floors | same | OK | |
| Big utilities, airport, seaport, stations | 128 px a tile | same | OK | checked by eye |

Why today's towers look small: a 1×1 sprite is a square 128 px frame and the plot fills most of it, so a building can rise only about 8 floors before it leaves the frame. The level 3 towers already touch the top edge, and to fit they were drawn about 5 m wide.
