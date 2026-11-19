// Line icons for the toolbar, drawn on a 24×24 grid and stroked in the
// button's text colour. To add one, add a path here and name it in Toolbar.ts.

const p = (d: string) => `<path d="${d}"/>`;

const ICONS = {
  view: p('M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3'),
  inspect: '<circle cx="10.5" cy="10.5" r="6.5"/>' + p('M15.5 15.5L21 21M10.5 8v.1M10.5 10.5v3'),
  bulldoze: p('M4 17h10M5 17v-4h8l1 4M7 13V8h4l1 5M14 15h3M17 11v8h3M3 20h12'),
  street: p('M2 8h20M2 16h20M4 12h3M10.5 12h3M17 12h3'),
  avenue: p('M2 5h20M2 19h20M2 12h20M4 8.5h3M10.5 8.5h3M17 8.5h3M4 15.5h3M10.5 15.5h3M17 15.5h3'),
  highway: p('M2 4h20M2 20h20M2 11h20M2 13h20M4 7.5h3M10.5 7.5h3M17 7.5h3M4 16.5h3M10.5 16.5h3M17 16.5h3'),
  res: p('M3 11l9-7 9 7M6 9.5V20h12V9.5M10 20v-5h4v5'),
  com: p('M5 21V4h9v17M14 9h5v12M3 21h18M8 8h3M8 12h3M8 16h3'),
  ind: p('M3 21V11l5 3v-3l5 3V4h4v17zM3 21h18'),
  power: p('M7 21c2-6 2-10 0-16h10c-2 6-2 10 0 16zM4 21h16M10 2c-1 1 1 1 0 2M14 2c-1 1 1 1 0 2'),
  water: p('M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z'),
  sewage: p('M3 7h8v6h10M3 11h4v6h14M17 20c0-1 1-1.5 1-2.5'),
  police: p('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8.5l1 2.2 2.4.2-1.8 1.6.6 2.3-2.2-1.3-2.2 1.3.6-2.3-1.8-1.6 2.4-.2z'),
  fire: p('M12 3c1 4 5 6 5 11a5 5 0 01-10 0c0-2 1-3.5 2-4.5 0 2 .8 3 1.8 3C11 9 10 7 12 3z'),
  school: p('M2 9l10-5 10 5-10 5zM6 11.5V16c3 3 9 3 12 0v-4.5M22 9v6'),
  hospital: p('M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'),
  // An anchor.
  port: p('M12 8v13M12 21c-4 0-7-3-7-7h3M12 21c4 0 7-3 7-7h-3M9 12h6') + '<circle cx="12" cy="5.5" r="2.5"/>',
  // A plane seen from above.
  // Rail: two rails on sleepers; a station hall with its platform track; the corner station's bend.
  track: p('M8 2v20M16 2v20M5 5h14M5 9.5h14M5 14h14M5 18.5h14'),
  station: p('M3 10l9-6 9 6M5 10v6h14v-6M10 16v-4h4v4M2 20h20'),
  trackElevated: p('M3 7h18M3 11h18M6 11v9M18 11v9M5 20h3M16 20h3'),
  trackSubway: p('M3 20v-8a9 9 0 0 1 18 0v8M8 20v-7M16 20v-7M8 15h8M8 18h8'),
  rampUp: p('M2 19h5l10-8h5M2 19v2h20v-10M7 19l10-8'),
  portal: p('M2 20V9h20v11M6 20v-6a6 6 0 0 1 12 0v6M2 13h4M18 13h4'),
  subway: p('M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM8 16V8l4 5 4-5v8'),
  underground: p('M2 9h20M2 9l3-4h14l3 4M4 13h16M6 17h12M9 21h6'),
  stationL: p('M4 21V13a9 9 0 0 1 9-9h8M8 21v-8a5 5 0 0 1 5-5h8'),
  plane: p('M12 2.5c1 0 1.6 1 1.6 2.4V9l7.4 4.4v2.2l-7.4-2.3v4.4l2.2 1.7v1.9L12 20.4l-3.8.9v-1.9l2.2-1.7v-4.4L3 15.6v-2.2L10.4 9V4.9c0-1.4.6-2.4 1.6-2.4z'),
  // A conifer, and drops with a plus or a minus (the Landscape tools).
  tree: p('M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5'),
  addWater: p('M10 4c3 4 5 6.5 5 9.5a5 5 0 01-10 0c0-3 2-5.5 5-9.5zM19 13v6M16 16h6'),
  removeWater: p('M10 4c3 4 5 6.5 5 9.5a5 5 0 01-10 0c0-3 2-5.5 5-9.5zM16 16h6'),
  // A park bench: two back slats, the seat, legs.
  park: p('M4 5h16M4 9h16M6 5v8M18 5v8M2 13h20v3H2zM5 16v5M19 16v5'),
  layers: p('M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5'),
  traffic: p('M5 16v-3l2-5h10l2 5v3zM6 13h12M7 16v2M17 16v2'),
  crime: p('M3 9c6-3 12-3 18 0 0 5-3 7-6 7-1.5 0-2-2-3-2s-1.5 2-3 2c-3 0-6-2-6-7zM7.5 11.5h2M14.5 11.5h2'),
  vibe: p('M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4'),
  ordinances: p('M7 4h11a2 2 0 012 2v1h-4M7 4a2 2 0 00-2 2v12a2 2 0 002 2h9a2 2 0 002-2V7M7 4a2 2 0 012 2M9 10h6M9 14h6'),
  requests: p('M9 6h11M9 12h11M9 18h11M4.5 6h.1M4.5 12h.1M4.5 18h.1'),
  budget: '<circle cx="12" cy="12" r="9"/>' + p('M14.6 9.3c-.5-1-1.5-1.5-2.6-1.5-1.5 0-2.6.8-2.6 2s1 1.8 2.6 2.1 2.6.9 2.6 2.1-1.1 2-2.6 2c-1.2 0-2.2-.6-2.7-1.6M12 6v12'),
  undo: p('M9 6L4 11l5 5M4 11h10a5 5 0 010 10h-3'),
  redo: p('M15 6l5 5-5 5M20 11H10a5 5 0 000 10h3'),
  menu: p('M4 6h16M4 12h16M4 18h16'),
  newCity: p('M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6'),
  save: p('M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7'),
  load: p('M3 6h6l2 3h10v11H3z'),
  // A question mark in a circle.
  tutorial: '<circle cx="12" cy="12" r="9"/>' + p('M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.6v.7M12 17v.1'),
} as const;

export type IconName = keyof typeof ICONS;

export function iconSvg(name: IconName): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}
