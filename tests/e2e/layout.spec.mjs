import { test, expect } from '@playwright/test';
import { launch } from '../helpers/extension.mjs';
import { serveFixture, open, rect, pageMetrics } from '../helpers/fixture.mjs';

const PORTRAIT = [
  { name: '1080x1920 primary', width: 1080, height: 1920 },
  { name: '1440x2560 high-res', width: 1440, height: 2560 },
  { name: '1200x1920 alternative', width: 1200, height: 1920 },
  { name: '720x1280 narrow', width: 720, height: 1280 },
];
const LANDSCAPE = [
  { name: '1920x1080 landscape', width: 1920, height: 1080 },
  { name: '1280x720 small landscape', width: 1280, height: 720 },
];

let browser;
test.beforeAll(async () => {
  browser = await launch();
  await serveFixture(browser.context);
});
test.afterAll(async () => browser.close());

for (const vp of PORTRAIT) {
  test.describe(`portrait ${vp.name}`, () => {
    test('regular video: player is edge to edge with its native aspect ratio', async () => {
      const page = await open(browser.context, '/watch?v=abc', vp);
      const m = await pageMetrics(page);
      expect(m.classes).toContain('ytvm-portrait');
      expect(m.classes).toContain('ytvm-page-watch');
      const p = await rect(page, '#player-container-outer');
      expect(p.x).toBe(0);
      expect(p.width).toBe(m.clientWidth);
      expect(p.right).toBe(m.clientWidth);
      expect(Math.abs(p.height - (m.clientWidth * 9) / 16)).toBeLessThanOrEqual(1);
      // directly below the masthead, never beside anything
      expect(p.y).toBe(56);
      // the actual <video> fills the player: no letterboxing introduced by the extension
      const v = await rect(page, '#fixture-video');
      expect(v.width).toBe(p.width);
      expect(v.height).toBe(p.height);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      await page.close();
    });

    test('regular video: info below, comments left, recommendations right', async () => {
      const page = await open(browser.context, '/watch?v=abc', vp);
      const m = await pageMetrics(page);
      const player = await rect(page, '#player-container-outer');
      const meta = await rect(page, 'ytd-watch-metadata');
      const comments = await rect(page, 'ytd-comments#comments');
      const related = await rect(page, '#related');
      expect(meta.y).toBeGreaterThanOrEqual(player.bottom);
      expect(comments.y).toBeGreaterThanOrEqual(meta.bottom);
      expect(related.y).toBeGreaterThanOrEqual(meta.bottom);
      expect(comments.right).toBeLessThanOrEqual(related.x);
      expect(comments.x).toBeLessThan(m.clientWidth / 2);
      expect(related.x).toBeGreaterThanOrEqual(m.clientWidth / 2 - 1);
      // roughly equal halves
      for (const col of [comments, related]) {
        expect(col.width).toBeGreaterThan(m.clientWidth * 0.4);
        expect(col.width).toBeLessThanOrEqual(m.clientWidth / 2);
      }
      expect(Math.abs(comments.width - related.width)).toBeLessThanOrEqual(2);
      // thumbnails stay inside the recommendations column
      const overflow = await page.evaluate(() => {
        const col = document.querySelector('#related').getBoundingClientRect();
        return [...document.querySelectorAll('#related .thumb, #related .details')].filter((e) => e.getBoundingClientRect().right > col.right + 0.5).length;
      });
      expect(overflow).toBe(0);
      // page scrolls vertically, not horizontally
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(vp.height);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      await page.close();
    });

    test('livestream: full-width player, native chat directly below, metadata after chat', async () => {
      const page = await open(browser.context, '/watch?v=live', vp);
      const m = await pageMetrics(page);
      const player = await rect(page, '#player-container-outer');
      const chat = await rect(page, 'ytd-live-chat-frame#chat');
      const meta = await rect(page, 'ytd-watch-metadata');
      expect(player.x).toBe(0);
      expect(player.width).toBe(m.clientWidth);
      expect(Math.abs(player.height - (m.clientWidth * 9) / 16)).toBeLessThanOrEqual(1);
      expect(chat.y).toBeGreaterThanOrEqual(player.bottom);
      expect(chat.y - player.bottom).toBeLessThan(40); // "directly" below
      expect(chat.height).toBeGreaterThanOrEqual(480);
      // chat takes the majority of the remaining viewport height
      const remaining = vp.height - player.bottom;
      expect(chat.height).toBeGreaterThanOrEqual(Math.min(remaining, 480) * 0.9);
      if (vp.height >= 1920) expect(chat.height).toBeGreaterThan(remaining * 0.8);
      expect(meta.y).toBeGreaterThanOrEqual(chat.bottom);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      await page.close();
    });
  });
}

for (const vp of LANDSCAPE) {
  test(`landscape ${vp.name}: YouTube's native layout is untouched`, async () => {
    const page = await open(browser.context, '/watch?v=abc', vp);
    const m = await pageMetrics(page);
    expect(m.classes).not.toContain('ytvm-portrait');
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector('#columns')).display);
    expect(cols).toBe('flex');
    const player = await rect(page, '#player-container-outer');
    const related = await rect(page, '#related');
    expect(player.width).toBeLessThan(m.clientWidth); // native margins and sidebar remain
    expect(player.x).toBeGreaterThan(0);
    expect(related.x).toBeGreaterThanOrEqual(player.right); // recommendations in the sidebar beside the player
    await page.close();
  });
}
