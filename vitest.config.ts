import { defineConfig, configDefaults } from 'vitest/config';

// Keep vitest's own defaults, and skip other checkouts' copies of the tests:
// agent worktrees under .claude/ and the built site under dist/.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/.claude/**', '**/dist/**'],
  },
});
