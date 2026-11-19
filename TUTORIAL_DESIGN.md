# Tutorial: Design

*Status: owner picked the shape on 2026-11-19 (guided first city, basics only, small hand-made map). Engine/UI review next. Copy is a first draft; the owner workshops it.*

## Shape (owner's picks)
- **Guided first city.** An optional *Tutorial* city started from the title screen. A small card gives one goal at a time and points at the toolbar button for it. The player can skip a step or leave at any time.
- **Basics only, about 10 minutes:** camera, roads, zones, power, water, sewage, growth and demand, jobs, inspecting, one service request, budget and taxes, overlays. Rail, ports, landscape, ordinances and Political Capital (PC) are left for players to find.
- **Small hand-made map.** It's always the same map, so every step works out the same way each time.

## Principles
1. **Goals, not scripts.** Each step is met by the **state of the city** ("12 home tiles zoned"), not by one exact click. Any way of reaching it counts, and so does an undo-and-redo. Steps already met (the player ran ahead) are passed straight away.
2. **Never block.** Every tool stays usable. Highlights point the way; they don't lock anything.
3. **The city can't fail.** Money has a generous floor and PC is held full, so nothing is refused for PC (PC isn't taught). No random disasters during the tutorial. Requests are off apart from the one scripted request.
4. **The city is yours afterwards.** After the last step, the card goes away and the same city keeps going as a normal game. Any rules that only applied during the tutorial (money floor, PC hold, requests off) end there.
5. **One sentence per card.** Short, friendly, no jargon. Rule 3 doesn't get explained; it's just how the tutorial behaves.

## Steps (draft)
| # | Card (draft copy) | Points at | Done when |
|---|---|---|---|
| 1 | "Welcome to Concretta! Drag to look around, scroll to zoom." | – | The camera has panned and zoomed |
| 2 | "Every city starts with a road. Draw a street from the highway." | Roads → Street; a ghost path from the highway stub | ≥ 10 street tiles connected to the highway |
| 3 | "People need homes. Paint homes along your street." | Zones → Homes | ≥ 12 home tiles zoned beside a road |
| 4 | "Homes only grow beside roads. Draw more streets to give your town room." | Roads → Street | ≥ 20 street tiles connected to the highway (10 more than step 2) |
| 5 | "Homes need power. Build a power plant a little way off." | Utilities → Power; a suggested spot | A power plant reaches the homes |
| 6 | "And water, and somewhere for it to go." | Utilities → Water, Sewage | The homes have water and sewage |
| 7 | "Speed things up and watch your town move in." | Speed buttons; the demand bars | Population ≥ 40 |
| 8 | "People need jobs. Add shops, and industry away from homes." | Zones → Shops, Industry | ≥ 8 shop tiles and ≥ 8 industry tiles zoned |
| 9 | "Click a home to see how it's doing." | Inspect | A home inspected |
| 10 | *Scripted request:* "Families on {street} want a park nearby." | Services → Park; the request pin | That request met |
| 11 | "Services cost upkeep. Check your budget and taxes." | Budget | The budget panel opened |
| 12 | "Views show what's going on. Try the traffic view." | Views → Traffic | An overlay switched on |
| 13 | "That's the basics. The city is yours now. Have fun!" | – | The card is closed |

Every card has **Skip step** and **Leave tutorial**. Leaving asks once ("Keep playing this city without the tutorial?") and then continues the city as a normal game.

## The map
- About 48×48: a highway stub on one edge, a river with a bridge spot, some coast and trees, plus open land near the highway for the first streets.
- Saved as `public/tutorial/tutorial.citysave.json`, the same way as the showcase. Population 0, generous money (say 100k).
- Who builds it: the owner by hand (like concretta1), or an engineer as a script plus a hand-checked save. Either way, Focus markers can mark the suggested spots (power plant spot, park area) so steps can point at them.

## How it plugs in
- **Start:** a *Tutorial* button on the title screen, next to Continue / New city / Load, and in the Menu. On the first ever launch (no saves yet), the button is highlighted.
- **Step engine (engine or ENGINEER 2):** a small pure module (`src/tutorial/steps.ts`) with a list of steps, each with `done(world, uiState) → boolean`. It runs a few times a second, not every frame. Tutorial-only rules reuse the showcase keeper's guards (money floor, PC hold) plus a "requests off except scripted" switch.
- **Card and highlights (graphics):** one card (bottom-centre on desktop, full width on a phone), with progress "3 / 12" and the two buttons. A soft pulse on the toolbar button for the step, and a ghost path or outline on the map where a step has one. No new art style.
- **Saving:** an additive `world.tutorial = { step }` field that defaults to "not in tutorial", so no SAVE_VERSION bump (AGENT.md save rule). A tutorial city that gets saved and reloaded picks up at its step.
- **Done flag:** `localStorage` `concretta.tutorialDone`, wrapped in try/catch. It only changes the first-launch highlight. The button is always there.
- **Strings:** `ui.tutorial.*` in `en.ts`.
- **Tests:** unit tests for each step's `done`, plus one scripted run that plays the tutorial map from step 1 to 12 through the normal commands and finishes inside a time budget.

## Later (not in v1)
- Short tips the first time a later system shows up (first jam, first rail station, first PC refusal).
- A "Political Capital" mini-lesson, if players turn out to miss it.

## Open questions
1. Who builds the map: the owner by hand, or an engineer?
2. Copy tone: the drafts above are plain and warm. The owner to workshop them.
3. Should steps 6+ allow the fastest speed, or cap it so the cards don't fly past?
