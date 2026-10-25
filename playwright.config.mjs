import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  projects: [
    // Deterministic: real extension + real Chromium against tests/fixtures/youtube.html. Runs in CI.
    { name: 'fixtures', testDir: './tests/e2e' },
    // Smoke tests against the real www.youtube.com. Network-dependent; not run in CI.
    { name: 'live', testDir: './tests/live', timeout: 120_000 },
  ],
});
