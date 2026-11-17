# Seaport: plan

*Status: designed with the owner on 2026-11-17, from the engine and graphics scoping notes. It goes public as soon as it's built (owner's call), with numbers tuned by playing and by the balance lab.*

## What it is
A **trade hub and industry boost** on open water. Any number of seaports can be built; each serves the industry within its reach.

## Owner decisions
- **Role:** industry exports goods through the port (income per truckload that arrives), and the port imports goods for shops when local industry falls short. While at least one connected port exists, it raises industrial demand **city-wide**.
- **Shops need goods:** a new rule, built as part of this work. Shops short of goods grow slower or earn less, which is what makes imports matter. It's off by its own key until the lab tunes it.
- **Shape:** a land yard (about 4×3) plus a **row of docks built out over water**, using shape part roles (`body` on land, `dock` on water).
- **Open water only:** the docks' water must connect to the **map edge**. No ports on ponds.
- **Orientation:** a rotation field (0–3) on the building, picked automatically to face the nearest open water under the pointer, with a key to cycle it. Big buildings get rotation for free (groundwork for airports).
- **Ships:** animated ships sail between the docks and the map edge, more of them when trade is busy. They're **visual only** and **pass under bridges**.
- **Downsides:** heavy truck traffic (trucks count double on the roads), noise and pollution (PC nuisance from nearby homes, felt from the yard rather than the docks, and lower land value through pollution), and expensive upkeep.

## Engine (about 5 PRs, each with auto-merge)
1. Shape part roles, a rotation field (saved), kind 12, and the placement rule (body on free land, docks on edge-connected water; reason `notOpenWater`). The edge-connected water check is one cached flood fill, redone only when terrain changes. No behaviour change.
2. Traffic refactor so markets can use building "doors" and tile lists. The existing three markets must stay bit-identical.
3. An **exports** market (industry → port), export income, truck weight, the port as an **imports** source in the goods market, and the city-wide demand multiplier. All keys off.
4. The **shops-need-goods** rule (its own key), nuisance, pollution, upkeep, and `shipRoute()` / `portTrade()` for graphics.
5. Numbers from the lab and from play.

Cost: about +1.5 ms per tick on a 160k city that has a port, and nothing without one.

## Graphics
- Stand-in yard and docks drawn over the water, a quay wall along the shore, and a placement preview (docks shown on the water, the connected open water lightly washed, "must connect to open water", nuisance rings from the yard), a toolbar entry and an inspect pane (trade income, boost, upkeep, "cut off from the sea").
- Ships following `shipRoute`, about 1 tile per second, waiting at the dock, with a wake, a cap of about 12 on screen, a dash when zoomed out, and passing under bridges.
- **[paid] art later, on the owner's OK:** about 7–10 images (the port in 2 orientations mirrored for the other two, 1–2 ship types in 2 poses, a reference image and retries).
- Polish: cranes moving while a ship is docked, trucks leaving the gate.

## Balance lab (ENGINEER 3)
Targets for ports, including a **"port farm" loophole check**: an idle port's upkeep must exceed its income, and capacity and reach must bind. Also check that fresh and generated maps have edge-connected water where a port is possible.

## Risks
- The traffic refactor touches the hottest system.
- Rotation touches the big-building code (undo, footprint lookups).
- Export income must not become free money.
- Maps with no open water need a clear "why not" from the tool.
