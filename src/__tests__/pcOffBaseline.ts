// Import this first in a test file that exercises a Political Capital
// mechanism with its own numbers: it switches every PC effect off (PC_OFF,
// the debug panel's Off preset) for that file, so the test starts from a
// neutral base (cap 100, nothing charged or paid, no requests, ordinances
// hidden) whatever the shipped numbers are. Vitest loads each test file's
// modules separately, so other files still see the shipped numbers. The
// shipped numbers themselves are covered by goldenCity, pcPresets and the
// Balance Lab.

import { BALANCE } from '../data/balance';
import { PC_OFF } from '../data/pcOff';
import { applyValues } from '../ui/pcPresets';

applyValues(BALANCE.politicalCapital as never, structuredClone(PC_OFF) as never);
