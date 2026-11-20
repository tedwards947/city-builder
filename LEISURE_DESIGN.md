# Leisure and Tourism: Design Workshop

*Status: workshop with the owner, started 2026-11-20 (TODO k). **Nothing is decided and nothing gets built yet.** This file holds the brief, what already exists, the options, and the owner's picks as they're made, so the discussion survives across sessions. PM writes it; engine and graphics review it once the shape is settled.*

## The owner's brief (2026-11-20)
**Visitors**
1. Today they come only from the airport. Later they may also come through outside connections (highway, rail).
2. They visit shops and attractions.
3. They'll travel much further than residents to reach a destination.
4. They make traffic.
5. They spend money at attractions.
6. Residents visit attractions too, less often than visitors.

**Attractions**
1. Unique 2×2, 3×3 or odd shapes: monuments, amusement parks, big parks, beach parks, museums…
2. Visitors and residents go to them.
3. They raise land value.
4. They draw a lot of traffic.
5. Admission fee? To discuss.
6. Expensive to build and run.
7. **Event venues** run only now and then (say once a week), and on those days they draw a **massive** amount of traffic. You need far more road capacity than usual, or the city seizes up. "This should be a really fun problem to solve." Start with two: an **American football stadium** and a **concert hall**.

## What exists today (so we build on it, not around it)
- **A visitors market already exists** (#265). Homes send `tripsVisitors` (0.05 per home level) to buildings that take visitors. Only the airport does today (`takes: { visitors: 100 }`, $6 a passenger). Arrivals leave the airport for shops and jobs, and the airport lifts shop demand (×1.1).
- **Any building joins traffic with one table row** (`BALANCE.transit.buildings`: `takes`, `sends`, `incomePerTrip`, `demandMult`). An attraction can be a row and some art, with no new engine code for the steady-state part.
- **Odd shapes work.** The airport is an L (`buildingShapes.ts`), so 2×2, 3×3 and odd shapes are already possible.
- **Trips go to the nearest destination with room**, out to a travel time of `commuteMax` (48 street tiles). Overflow moves on to the next one.
- **Traffic is worked out once a game day** (`flowInterval` 8 ticks = 1 day). There's no time of day and **no week**, so an event venue needs a weekly calendar, which is new.
- **Rail stations are portals**, and road classes carry 20 / 80 / 200, so the tools for handling a crowd mostly exist already.
- **Parks** are 1×1 services that raise land value and count toward the 2×2 prime-spot rule.
- **PC:** `PC_DESIGN.md` deferred "big projects cost PC" until multi-tile buildings existed. Attractions are the obvious big projects.

## The new dynamics this introduces
1. **A second population that doesn't live here.** Visitors come and go, spend money and make traffic, but don't count as residents.
2. **Long trips.** Visitors cross the whole city, so the trunk roads and rail matter, not just local streets.
3. **A pull you build.** Attractions decide how many people come, instead of the city's size alone.
4. **Peaks.** Event days make traffic change over time for the first time, so a network that's fine on Tuesday can fail on Saturday.
5. **Tourism as income.** It's a revenue stream that doesn't come from taxes, which helps against "mid-game too easy" (TODO m) or hurts, depending on the numbers.

---

## Questions and options
*Each has options and the PM's pick. Walk through them one at a time; the owner's answer goes in the "Decided" column of the table at the end.*

### Q1. How many visitors come?
- **A. Set by gateways.** Each airport (and later highway and rail border connection) brings a fixed flow, whatever there is to see.
- **B. Set by pull, capped by gateways.** *(PM pick)* The city has a **pull** (the total appeal of its attractions, plus a little for shops). Visitors = pull, capped by what the gateways can carry. There are two levers: build attractions (more people want to come) and build gateways (more can get in). A city full of attractions and no airport gets day-trippers by highway only.
- **C. Pull only.** No gateways needed; visitors just appear at the edge. Simple, but the airport and border connections lose their point.

### Q2. Where do visitors come in?
- Now: the **airport**.
- Next: **highway border connections**. Visitors arrive by car at the map edge; day-trippers, many but short stays.
- Next: **rail border connections**. They arrive at a station and use the rail network (a reason to run rail to the edge).
- Later: the **seaport** (cruise ships)?
- PM pick: build the airport-only version first, with border connections as phase 3.

### Q3. How far do visitors travel, and which attraction do they pick?
- **A. Nearest with room** (today's rule), with a much longer reach (say 3× a resident's).
- **B. Best appeal for the distance.** *(PM pick)* Visitors weigh appeal against travel time, so a great amusement park across town beats a dull monument next door. It makes **where you put things** and **how well they're connected** both matter. A bit more engine work.

### Q4. How do attractions make money? (the owner's "admission fee? idk")
- **A. A fixed fee per type.** A museum earns $X a visit. Simple and readable.
- **B. A fee the player sets** for each attraction. Higher means fewer visitors. A real lever, but one more slider to manage.
- **C. Free entry, but visitors spend nearby.** Attractions earn nothing directly. Visitors boost shops around them (a tourism district) and pay a tourist tax.
- **D. A + C.** *(PM pick)* Ticketed attractions (museum, amusement park, stadium) earn a fixed fee; free ones (big parks, beach, monuments) earn nothing directly but send visitors on to nearby shops. The upkeep is high either way, so a free park is something you choose to pay for, and a ticketed one can pay for itself if people can get there.

### Q5. What do residents get from leisure?
- **A. A coverage service** like parks: a radius, and a happiness bonus if covered.
- **B. A reach measure.** *(PM pick)* Inspect gets a third bar, "**To leisure**", next to "To work" and "To shops": how many attractions a home can reach in reasonable time. It reuses traffic reach, so congestion matters here too.
- **What lacking it does** (WISHLIST: "no leisure doesn't *hurt* things but lack of it might impede R and C growth"): PM pick: **no penalty early on**. From level 3 (and for 2×2 towers) homes want some leisure in reach to grow. A gentle mid-game pressure, which fits TODO m.

### Q6. Event venues: how does an event day work?
Today traffic is worked out once a day, so there are two ways to do this:
- **A. The whole event day is the spike.** *(PM pick for v1)* On event day, that day's traffic pass adds the crowd. Simple, and it reuses everything. The jam shows for that day, then clears.
- **B. Before and after windows.** Extra traffic passes on event days (the crowd arriving, then leaving). More realistic, more engine work. Maybe later.

**The calendar:** add a **7-day week** to the date ("Sat 14 Mar 1903"). Each venue has fixed days: the stadium plays one day a week (Saturday); the concert hall plays two or three evenings (Thu–Sat).

**What makes it fun to solve (the core):**
- **Show it coming.** The venue's pin counts down ("Game in 2 days"), and the traffic view has a **"next event" preview** showing the forecast load before it happens, so you can plan.
- **Turnout depends on getting there.** Attendance = the fans who can reach the venue within the travel time. A jammed network means empty seats and less ticket money, and a toast ("12,000 fans stuck in traffic; only 31,000 made kick-off").
- **The jam costs the city too.** On event day, commuters and shoppers stuck behind the crowd count as a congested day for growth, as now.
- **A venue's reputation.** A string of bad event days lowers the venue's appeal (fewer visitors, then fewer events booked). Good ones raise it. It's a slow score, so one bad day isn't a disaster.
- **The tools:** avenues and highway ramps to the venue, **a rail station beside it** (stations as portals already exist; this is rail's best showcase), and spreading parking or access over several sides. Later: shuttle buses, parking lots, an "event day" traffic ordinance (PC).

**How the two venues differ:**
| | American football stadium | Concert hall |
|---|---|---|
| Size | Big, about 4×4 or 5×4, odd shape (bowl plus plaza) | 2×2 or 3×2 |
| Crowd | **Massive**, once a week | Medium, 2–3 times a week |
| Best spot | The edge of downtown, by a highway or rail | Downtown, by transit |
| Feel | One big weekly crisis to plan for | Steady pressure on the downtown network |
| Neighbours | Noisy on event days: homes nearby may object (PC nuisance rule) | Raises land value around it |

### Q7. The first set of attractions
A starting list, not final. Footprints follow `docs/SCALE.md` (1 tile = 17 m).
| Attraction | Footprint | Ticket? | Draws | Notes |
|---|---|---|---|---|
| Big park | 2×2 or 3×3 | Free | Residents mostly | Counts as a park (prime spot, land value) |
| Beach park | Odd, on the coast | Free | Visitors and residents | Needs coast, like the seaport needs water |
| Museum | 2×2 | Yes | Visitors | Downtown pick, steady |
| Monument | 1×1 to 2×2, plaza | Free | Visitors | Cheap pull, big land-value boost |
| Amusement park | 3×3 or 4×3 | Yes, high | Visitors and residents | Big pull, big traffic, all week |
| Stadium (football) | ~4×4, odd | Yes | Event day only | See Q6 |
| Concert hall | 2×2 / 3×2 | Yes | Event evenings | See Q6 |

### Q8. One of each, or as many as you like?
- **A. Landmarks are unique** (one stadium, one museum, one amusement park a city), and parks and monuments repeat. *(PM pick)* Unique ones feel special, and a second stadium would just halve the problem.
- **B. All repeat**, with appeal shared when there are several (diminishing returns, like services in PC_DESIGN).

### Q9. When do attractions become available?
- **A. All available from the start**, gated by price only.
- **B. Unlocked by population** (museum at 2k, amusement park at 5k, stadium at 10k…). *(PM pick)* This gives the mid-game new goals (TODO m) and pairs with the PC population milestones.

### Q10. Does a visitor stay the night?
- Hotels would be a new kind of building (or a shop sub-type) that visitors fill, earning a hotel tax. They tie visitors to land use and give downtown towers a job.
- PM pick: **not in v1**. Note it for later.

### Q11. How do visitors show on screen?
- Graphics' call. Ideas: tour buses, a different car colour, crowds on event days (fans walking from the station), stadium lights on event nights.

### Q12. Links to other systems
- **PC:** big attractions cost PC (the deferred "big projects"). Homes near a stadium object like they do to industry. Requests: "Residents want a museum".
- **2×2 lots:** does an attraction count as "near a park" for the prime-spot rule? PM pick: big parks and beach parks count; the others don't.
- **Pacing (TODO m):** tourism income has to be tuned with ENG3's headcount costs, so it adds a choice, not easy money.
- **Land value (TODO l):** attractions are the land-value signal the game is missing.

---

## Proposed phases (once decided)
1. **Visitors and steady attractions:** pull and gateways (Q1), appeal versus distance (Q3), fees (Q4), the "To leisure" bar (Q5), big park, museum, monument and amusement park. Engine + graphics + ENG3 (numbers).
2. **Event venues:** the week, event days, turnout, reputation, the forecast view; stadium and concert hall.
3. **Border connections:** highway and rail visitors from the edge, then maybe cruise ships.

## Decisions so far
| Q | Topic | Owner's pick |
|---|---|---|
| – | Brief | Given above (2026-11-20) |
