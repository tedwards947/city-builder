// Words and numbers for service capacity (schools have seats, hospitals have
// beds). Pure, so it can be tested. The numbers come from sim/serviceCapacity.ts.

import { BUILDING_FIRE, BUILDING_HOSPITAL, BUILDING_POLICE } from '../sim/constants';
import type { BuildingSeats, HomeSeat } from '../sim/serviceCapacity';

/** The i18n group for a kind's words: beds for a hospital, cover for police and fire, seats otherwise. */
export function seatWords(kind: number): string {
  return kind === BUILDING_HOSPITAL ? 'ui.capacity.bed' : kind === BUILDING_POLICE ? 'ui.capacity.police' : kind === BUILDING_FIRE ? 'ui.capacity.fire' : 'ui.capacity.seat';
}

export interface SeatsView {
  /** "1,640 / 2,000" */
  figure: string;
  /** How full the bar is, 0–1. */
  fill: number;
  full: boolean;
  /** Places still free (a few may be left when full: too few for the next home). */
  free: number;
  /** Residents in reach with no place, when full. */
  leftOut: number;
}

/** A capacity-limited building's numbers for the inspect pane and the map bar; null if the kind has no limit. */
export function seatsView(s: BuildingSeats): SeatsView | null {
  if (s.capacity <= 0) return null;
  const seated = Math.min(Math.round(s.seated), s.capacity);
  // Homes are seated whole, so a building can turn a home away with a few places left: that is full too.
  const full = seated >= s.capacity || s.inReachUnseated > 0;
  return {
    figure: seated.toLocaleString('en-US') + ' / ' + s.capacity.toLocaleString('en-US'),
    fill: Math.max(0, Math.min(1, seated / s.capacity)),
    full,
    free: Math.max(0, s.capacity - seated),
    leftOut: Math.round(s.inReachUnseated),
  };
}

/** Which of the three states a home is in for one service: the key under the kind's words. */
export function homeSeatState(h: HomeSeat): 'has' | 'full' | 'outOfReach' {
  return h.seatedAt ? 'has' : h.reason === 'full' ? 'full' : 'outOfReach';
}
