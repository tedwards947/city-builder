# TEAM.md

How the owner's team of agent sessions is set up, and how to rebuild it after a restart. **The PM reads this on a restart; other sessions only need AGENT.md and their own `TODO.md` section.**

## The team

Session ids (the `ListAgents` names) change on every restart, so go by role. Models are defaults; the owner may change them.

| Role | Does | Owns | Default model | Folder (port) |
|---|---|---|---|---|
| **PM** (research/PM) | Research, design docs, coordinating the others, relaying to the owner. Writes no game code. | `*_DESIGN.md`, `TODO.md` DESIGN section, this file | Opus | a temporary docs worktree |
| **ENGINE** | Simulation, scheduler, traffic, frame loop, render performance | `src/sim/**`, `src/bench/**`, the golden test | Fable | `.claude/worktrees/engine` (5199) |
| **GRAPHICS** | Art, UI, mocks with feedback forms | `src/render/**`, `src/ui/**`, `art/**` | Sonnet | `../city-builder-graphics` (**5174, the owner plays on it**) |
| **ENGINEER 2** | Parallel engine work, cleanup, CI | as handed out (built `src/gen/**`, CI workflows) | Opus | `../city-builder-eng2-*`, `../city-builder-play` |
| **ENGINEER 3** | Balance lab, tuner, numbers | `src/balance/**`, `scripts/balance*.mjs` | Sonnet | `../city-builder-eng3-*` |
| **SOUND** | Music and sound effects | `src/audio/**` | Opus | own worktree |
| **HAIKU1** | Cheap helper: status checks, small doc edits, re-running scripts, nightly summaries | nothing | Haiku | any |

The main checkout (`city-builder`, branch `vibecheck`) is stale: nobody touches it without the owner's say-so.

## Restarting

1. **Start the PM first.** Opening prompt: *"You are the PM. Read TEAM.md, then restart the team."*
2. **The PM finds the state** (all on GitHub, so nothing depends on old sessions):
   - `TODO.md`: each area's ranked list and what's in progress;
   - `gh pr list`: open PRs; `gh run list --workflow nightly-balance.yml --limit 1`: the latest nightly;
   - `git worktree list`, then `git -C <tree> status` per tree: unmerged or uncommitted work.
3. **The PM tells the owner which sessions to start.** Only roles with real work (see AGENT.md "Saving tokens"). For each one, it gives a one-line opening prompt:
   *"You are <ROLE> on <model>. Read AGENT.md and TEAM.md, check your folder for unfinished work, pick up your TODO.md section, then message the PM."*
4. **Each session** checks its own folder (`git status`, open PRs on its branch), finishes or reports half-done work, and messages the PM once.
5. **The owner restarts the play server** in `../city-builder-graphics` (`npx vite --port 5174 --strictPort`) if it's down.
6. **The PM re-creates what a restart loses**:
   - scheduled reminders (e.g. pinging the owner with the nightly result after 07:17 UTC);
   - comment watches on the review pages below.
   
   The nightly CI job, the live site and auto-merges keep running on their own.

## Keeping this rebuildable

- **Every session updates its own `TODO.md` section whenever one of its PRs merges** (what's done, what's next, what's waiting on whom). State that only lives in a session's head is lost on a restart.
- Decisions go in the design docs; rules for everyone go in AGENT.md; team setup goes here.

## Standing permissions and process

- **Merging:** sessions open and merge their own PRs with `gh pr merge <n> --auto --merge --delete-branch` (AGENT.md has the conditions). Still ask the owner first for: CI, settings or secrets changes; paid nanobanana images; deleting anything that isn't your own merged branch; force-pushes.
- **No permission laundering:** never hand another session (e.g. HAIKU1) a job you were refused permission for.
- **Fast-forwards of play trees** go through the PM: when a play-test round's PRs are on main, the PM asks the tree's owner (GRAPHICS for 5174, ENGINE for 5199) to `git fetch && git merge --ff-only origin/main`, clean tree only, no vite restart. A reload interrupts the owner's game, so ask the owner before fast-forwarding mid-session.
- **Browser checks are muted:** Chrome with `--mute-audio`, page with `?music=off`.
- **Debug tools stay public** (`?debug=true`, cheat buttons). "Games often have cheatcodes."
- **"Send it":** no merge gates beyond CI while the owner is the only player; revert a merge straight away if it breaks the live game.

## The owner's preferences

- **Difficulty should be fun to resolve, not removed.** Traffic jams and shortages are part of the game. Relax a rule only when it's unfair, invisible or tedious. (Also at the top of `src/balance/targets.ts`.)
- **PC stays one simple number**, a second currency next to money.
- **Mocks come with a feedback form**, with options to pick between (A1, A2, …).
- **Art taste:** brutalist and modern buildings, especially for level-3 towers; the clay look; compact, dense tree crowns.
- **Sound taste:** the clay feel (wood, felt, kalimba).
- **Keep messages short** and bring the owner decisions and finished work, not every step.

## Links

- Live game: https://city-builder-dmz.pages.dev/ (every merge to `main` deploys; PRs get preview URLs)
- Balance Lab dashboard: https://claude.ai/artifact/CcWbLonbasJipVhCp4aRm3. Refresh by downloading the nightly's `balance-report` artifact (`gh run download <id> -n balance-report`), flattening `latest.json` into rows and pointing the `datasets/results` doc at the new upload.
- Music review page: https://claude.ai/artifact/Es2qtLaHzboiLQkhGnKChx (rebuild with `scripts/build-music-review.mjs`)
- Sound effects review page: https://claude.ai/artifact/216x1ZdWFF8hGL8dkphMuL
