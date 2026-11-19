# Save fixtures: one city per save version

`saveFixtures.test.ts` loads every file here on every PR. Each must upgrade to the current `SAVE_VERSION`, come out as the same city, and play. See "Save compatibility" in AGENT.md.

**Never regenerate or edit an existing file.** A fixture is only worth something because it was written by (or as) an older version. If a fixture stops loading, the upgrade code is wrong, not the file.

## When you bump `SAVE_VERSION`
Add `vN.citysave.json` for the new version: load the newest fixture with the new code, save it to a file (`encodeSaveFile(meta, serialize(world))`), and commit it. The test fails until a file exists for every version.

## What they hold
A 24×24 all-land city: a street along y = 8, homes north of it, shops and industry south, a power plant at (19, 7), a water tower, a sewage plant, a police station and a park. Treasury 12,345, tick 500.

- **v9:** the same city with rail: a straight and a curved train station on one line, and a subway station.
- **v1 to v8 are reconstructed**, not saves from builds of the time (none were kept): the base city saved by today's code with each upgrade step taken back in turn (the fields and layers that step adds removed, the building lists split as they were before v7). v1 has no police station or park (version 1 had no service buildings). They exercise every upgrade step on a real city, but they cannot show a quirk of an old build that the upgrade code does not know about.
