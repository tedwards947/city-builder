// Developer-only UI (traffic numbers in the tile inspector, the tuning panel)
// is shown when the page is opened with ?debug=true.

export const DEBUG: boolean =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'true';
