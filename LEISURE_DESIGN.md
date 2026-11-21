# Leisure and Tourism: Design Workshop

*Status: workshopped with the owner on 2026-11-20 (TODO k); **the owner approved building the first version the same day.** The owner's picks are in "Decisions" at the end; they override the PM picks in the option lists above them. PM keeps this file; changes to the decisions need the owner.*

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

### Q6b. What happens when fans can't get there? (owner wasn't keen on turnout loss and reputation alone)
- **A. Nothing extra.** The jam is the cost: commuters and shops suffer that day, as with any congestion.
- **B. Empty seats.** Ticket money only from the fans who arrive. No lasting effect.
- **C. Residents stuck in it complain (PC).** A bad event day costs PC from the homes whose trips got jammed by the crowd. This is the owner's "objections mostly because of traffic": the cost follows the jam you allowed, not a fixed radius, so fixing access fixes it.
- **D. The team threatens to leave.** After several bad days, a request-style countdown: "Fix access within 30 days or the Bulldogs move." Fix it and it's a PC win; fail and the stadium sits empty for a season.
- PM pick: **B + C now, D later** as the dramatic version.

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
- **How they could work:** visitors who fly or take the train in from far away stay the night; day-trippers by highway don't. Overnight visitors need beds, so beds become a third cap: overnight visitors = the smallest of pull, gateway capacity and beds. A hotel earns per night (a tourist tax).
  - **H1. A hotel you place**, like any building.
  - **H2. Hotels grow on their own**: shop lots near attractions or the airport turn into hotels when visitors want beds, and 2×2 shop towers can be hotel towers. No new tool, and it gives downtown towers a job.
- PM pick: **H2, but not in v1.** Note it for later.

### Q11. How do visitors show on screen?
- Graphics' call. Ideas: tour buses, a different car colour, crowds on event days (fans walking from the station), stadium lights on event nights.

### Q12. Links to other systems
- **PC:** big attractions cost PC (the deferred "big projects"). Homes near a stadium object like they do to industry. Requests: "Residents want a museum".
- **2×2 lots:** does an attraction count as "near a park" for the prime-spot rule? PM pick: big parks and beach parks count; the others don't.
- **Pacing (TODO m):** tourism income has to be tuned with ENG3's headcount costs, so it adds a choice, not easy money.
- **Land value (TODO l):** attractions are the land-value signal the game is missing.

---

## Build plan (first version, owner approved 2026-11-20)
**In:** big park, beach park (+ umbrellas), plaza/monument, the existing park moved into *Parks and leisure*; museum and football stadium in *Unique buildings*. **Next round:** concert hall, amusement park. **After the core:** hotels (H2), the team threatening to leave (Q6b D), border connections.

| Who | What |
|---|---|
| **Engine** | The simulation: attraction kinds and footprints (odd shapes), pull capped by gateways, the appeal head start in the visitors map, resident leisure trips on that same map and the "To leisure" reach, the level-3 growth need, tickets and nearby shop spending, land value, the 2×2 prime-spot link, one-per-city and population unlocks, PC and money costs, the no-gateway soft warning, saving. Then event days: the stadium's Saturday crowd, turnout and empty seats, PC from stuck residents, distress that builds up across event days, the countdown pin's data. Times the traffic pass on golden-1 before and after. Ships numbers at a neutral or placeholder level until ENG3 sets them. |
| **ENGINEER 2** (Sonnet) | Small, well-specified pieces: the 7-day week (a pure calendar helper and the weekday in the HUD date), then UI pieces engine hands over (warning toasts, Inspect lines, strings). |
| **Graphics** | Art for the six attractions within SCALE.md, the stadium's event-day animation (trucks setting up, then lights and spotlights), beach umbrellas, the two toolbar categories, the countdown pin, how visitors look. Paid images need the owner's OK, as usual. |
| **ENGINEER 3** | The numbers, after the pacing work: pull and appeal, gateway caps, ticket prices, upkeep, unlock populations, PC costs, crowd size, how many bad event days drop a home a level. Lab targets for tourism. |
| **HAIKU1** | Read-only legwork for engine on request (inventories, checks). |
| **PM** | This file, and relaying. |

## Phases
1. **Visitors and steady attractions:** pull and gateways (Q1), appeal versus distance (Q3), fees (Q4), the "To leisure" bar (Q5), big park, museum, monument and amusement park. Engine + graphics + ENG3 (numbers).
2. **Event venues:** the week, event days, turnout, reputation, the forecast view; stadium and concert hall.
3. **Border connections:** highway and rail visitors from the edge, then maybe cruise ships.

## Decisions so far
| Q | Topic | Owner's pick |
|---|---|---|
| – | Brief | Given above (2026-11-20) |
| Q1 | How many visitors | **B: pull, capped by gateways.** Placing a big attraction with no outside connection (no airport yet; later no border connection) gives a **soft warning**: attendance is limited to residents. |
| Q6 | Showing an event | **The building itself shows it.** Before: trucks pulling up, set-up. During: lights, animation, maybe spotlights. (Graphics.) **A countdown pin** on the venue ("Game in 2 days"). **No forecast preview**: working out the traffic is the fun (owner). |
| Q6a | Event day in the sim | **A: the whole event day is the spike** (one traffic pass with the crowd added). B (arrival and departure windows) maybe later, depending on balance and playtesting. A **7-day week** in the date; stadium on Saturdays, concert hall Thu–Sat evenings. **It must have real teeth** (owner): homes whose trips are jammed by the crowd take distress that builds up across event days, so a few bad event days in a row make them drop a level (or worse), not just a one-day dip. ENG3 tunes how many. |
| Q8 | One or many | **Two new toolbar categories:** **Parks and leisure** (repeatable: parks, big parks, beach parks, plazas…) and **Unique buildings** (one a city: stadiums, museums…). |
| Q9 | Unlocks | **Yes, probably by population.** Numbers to come. |
| Q5 | Residents' leisure | **B: a "To leisure" reach bar** in Inspect, beside To work and To shops. It hurts homes from **level 3** (and 2×2 towers) up: they need some leisure in reach to keep growing; nothing earlier. **Performance requirement (engine):** resident leisure shares the visitors travel-time map (no new sweep), and Q3's appeal is a head start in that sweep (still one sweep a day). Engine times the traffic pass on golden-1 before and after. |
| Q12 | PC and stadiums | **Yes, homes object to a stadium, mostly because of its traffic.** |
| Q6b | Fans who can't get there | **B + C:** empty seats (tickets only from fans who arrive), and residents stuck in the event jam cost PC. **D (team threatens to leave) maybe later.** |
| Q3 | Choosing an attraction | **B: appeal weighed against travel time.** Star attractions draw from across the map, small ones mostly locals, and jams on the way make a place less attractive. |
| Q4 | Money | **D: fixed ticket price per type** for museums, amusement parks, stadiums and concert halls; **free** parks, beach parks and monuments earn nothing directly, but their visitors spend money in nearby shops. Upkeep is high for all. |
| Q7 | First attractions | **List approved.** Parks and leisure: park (existing 1×1, moves here), big park (2×2/3×3), beach park (odd, on the coast), plaza/monument. Unique: museum (2×2), amusement park (3×3/4×3), concert hall (2×2/3×2), football stadium (~4×4, odd). **First version:** the four parks-and-leisure items + museum + stadium; concert hall and amusement park next round. Later ideas: zoo, aquarium, botanical garden, marina, convention centre. **Cute detail (owner):** a beach park spawns little beach umbrellas on the beach near it. |
| Q7b | Concert hall | **Waits for the second round** (owner OK). |
| Q12 | Links | **Unique buildings cost a lot of PC and a lot of money** (owner). Big parks and beach parks count as "near a park" for the 2×2 prime spot; the others don't. Attractions raise land value nearby (plaza/monument most; the stadium only a little). "Residents want a big park" requests: later. Tourism income is tuned together with ENG3's headcount costs (TODO m). Gateways: the airport first, highway and rail border connections in phase 3. |
| Eng | Engine's plan (owner OK 2026-11-20) | 4 PRs: P1 buildings, P2 leisure traffic, P3 level-3 leisure need, P4 event days. Today's "visitors" market is residents flying out and stays; tourists and resident leisure trips are a **new leisure market (one extra flood a day)**, timed on golden-1. P3: the 1×1 park counts as a little leisure, and lacking leisure **slows** growth past level 3 (×0.5 placeholder), it doesn't stop it. |
| Q6c | Event timing (owner, 2026-11-20, replaces Saturdays) | A one-day event was 4 s at 1×, far too short. **Events are untied from the calendar: about 5 real minutes at 1×** (≈1 min build-up, 3 peak, 1 drain, the crowd ramping smoothly, not on/off), **then a random gap of 7–20 min** (≈10 typical). Faster speeds scale it (3× → a third). Long enough to fix the jam *during* the event: damage builds while it lasts, and the level-drop rule counts events, not days. "A game, not a simulation": fun and challenging over correct. The weekday stays in the date as flavour. |
| Q6d | Event gap (owner playtest, 2026-11-20) | "A bit more infrequent": the gap is now **12–30 min at 1×** (#444). |
| T1 | Level drop (owner, 2026-11-20, #444) | Homes drop a level after **2 bad events**, as shipped: a city ends about 1–8% down on residents and regrows in the gaps. After 1 event (13–46% down) was too harsh. |
| T2 | Leisure need (owner, 2026-11-20) | **Keep it simple for now:** a home has leisure with a park within about 8 tiles of drive (`leisure.need.minReach` 0.45). The 20–40% share is not a target, since it depends on how many parks a city has. **Deferred:** parks with a capacity (each serves N homes, like school seats), together with the service-range tuning (TODO DESIGN c). ENGINEER 3 checks whether the beach park and lido reach too far. |
| T2b | Leisure need follows park coverage (owner, 2026-11-20, replaces T2's 8 tiles of drive) | A home has leisure when a park covers it (park coverage over every park kind: 1×1 6, 2×2 9, big park / beach park / lido 12 road steps), not by the leisure market's appeal reach. Beaches still draw trips and tourists from far away; only a covering park counts for growth. ENGINEER 3 kept the ranges: cities built with parks 17–26% lacking (golden-1, smallercity, new_city2, testcity1), the park-poor gen-s1 45%. |
| T5 | Stadium toned down (owner, 2026-11-20; replaces Q6's "real teeth" and T4) | The avenue-everywhere fix made cities ugly. A third of the crowd; an ordinary well-built network with a station at the stadium copes; no level drops (`dropAfter` 0); a jammed event costs a little PC (only the crowd's own jam counts: `jam.eventShare` 1); a smooth event earns 5% of the PC cap back (`smooth`, reason `eventSmooth`, up to the cap; ENGINEER 3 built it); tickets, tourists and the look kept; money about break-even to slightly positive. |
| T3 | Park upkeep (owner, 2026-11-20) | **High, as first decided:** back to about 30 / 15 / 14 a tick (big park, plaza, 2×2 park). No payback target: parks earn their keep in growth, happiness and land value, not cash. This also helps the mid-game money problem (TODO m). |
| T4 | Compact-city stadium (owner, 2026-11-20) | Accepted for now: on smallercity, avenues alone save only 46%, because the stuck homes are close. **The lab must show it can be solved:** a "prepared with rail" plan (a line with a station at the stadium) on at least one test city. |
| Q10 | Hotels | **H2 (hotels grow on shop lots near attractions and the airport), after the core is built.** |
