// Economy number sets for the ?debug=true Economy panel's picker. Each is a
// partial BALANCE tree applied over the shipped numbers. From ENGINEER 3's
// economy dry run (2026-11-16, measured with free zoning).

export interface EconPreset {
  id: string;
  name: string;
  /** One line for the panel. */
  desc: string;
  values: Record<string, unknown>;
}

export const ECON_PRESETS: readonly EconPreset[] = [
  { id: 'shipped', name: 'Shipped', desc: "Today's numbers: services eat a young city's income.", values: {} },
  {
    id: 'tight', name: 'Tight',
    desc: 'A lean start: a short spell in debt early on, slower growth.',
    values: { maintenance: { serviceMult: 0.75 }, tax: { landValueFloor: 0.25 } },
  },
  {
    id: 'recommended', name: 'Recommended',
    desc: 'Halves service upkeep; homes on cheap land still pay. Tight but survivable.',
    values: { maintenance: { serviceMult: 0.5 }, tax: { landValueFloor: 0.25 } },
  },
  {
    id: 'generous', name: 'Generous',
    desc: 'Easy money: the city is rich within a year (deliberately too much).',
    values: { maintenance: { serviceMult: 0.5 }, tax: { landValueFloor: 0.5 } },
  },
];
