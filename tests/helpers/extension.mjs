import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const EXTENSION_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Launches Chromium with the unpacked extension loaded (new headless mode is
 * required for extensions). Returns { context, close }.
 * Pass `extension: false` to get a pristine browser for before/after comparisons.
 */
export async function launch({ extension = true, viewport = { width: 1080, height: 1920 } } = {}) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'ytvm-'));
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (extension) args.push(`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport,
    locale: 'en-US',
    args,
  });
  return {
    context,
    async close() {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}
