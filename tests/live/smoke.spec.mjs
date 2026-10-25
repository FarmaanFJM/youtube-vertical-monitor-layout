// Smoke tests against the real www.youtube.com, logged out.
//
// These are NOT deterministic (YouTube changes its DOM, A/B tests layouts, and
// may serve an anti-bot interstitial to automated browsers). They never try to
// bypass any of that: when YouTube does not serve a normal page the test is
// skipped with the reason, never reported as passed.
//
//   npm run test:live
import { test, expect } from '@playwright/test';
import { launch } from '../helpers/extension.mjs';

const PORTRAIT = { width: 1080, height: 1920 };
let browser;
test.beforeAll(async () => { browser = await launch({ viewport: PORTRAIT }); });
test.afterAll(async () => browser.close());

async function visit(path, viewport = PORTRAIT) {
  const page = await browser.context.newPage();
  await page.setViewportSize(viewport);
  await page.goto('https://www.youtube.com' + path, { waitUntil: 'domcontentloaded' });
  const blocked = await Promise.race([
    page.waitForSelector('ytd-app', { timeout: 20_000 }).then(() => false),
    page.waitForSelector('text=unusual traffic', { timeout: 20_000 }).then(() => true),
  ]).catch(() => true);
  test.skip(blocked, 'YouTube did not serve a normal page (anti-bot interstitial or network); not bypassed');
  return page;
}

const measure = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, right: r.right, bottom: r.bottom + scrollY, width: r.width, height: r.height }; }, sel);

test('regular video: real player is edge to edge, comments left / recommendations right', async () => {
  const page = await visit('/watch?v=jNQXAC9IVRw');
  await page.waitForSelector('ytd-watch-flexy #player-container-outer', { state: 'attached' }); // hidden (not absent) behind YouTube's logged-out bot wall
  await page.waitForSelector('#related ytd-watch-next-secondary-results-renderer', { timeout: 30_000 });
  const vw = await page.evaluate(() => document.documentElement.clientWidth);
  const p = await measure(page, '#player-container-outer');
  expect(p.x).toBe(0);
  expect(p.width).toBe(vw);
  expect(Math.abs(p.height - (vw * 9) / 16)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
  const related = await measure(page, '#related');
  expect(related.x).toBeGreaterThanOrEqual(vw / 2 - 1);
  // comments load lazily and may be absent logged-out in some regions
  if (await page.locator('ytd-comments#comments').count()) {
    const comments = await measure(page, 'ytd-comments#comments');
    expect(comments.right).toBeLessThanOrEqual(related.x);
  }
  await page.close();
});

test('regular video: landscape window keeps YouTube native layout', async () => {
  const page = await visit('/watch?v=jNQXAC9IVRw', { width: 1920, height: 1080 });
  await page.waitForSelector('ytd-watch-flexy #player-container-outer', { state: 'attached' }); // hidden (not absent) behind YouTube's logged-out bot wall
  expect(await page.evaluate(() => document.documentElement.classList.contains('ytvm-portrait'))).toBe(false);
  const p = await measure(page, '#player-container-outer');
  expect(p.x).toBeGreaterThan(0);
  await page.close();
});

test('home: two-column rich grid in portrait', async () => {
  const page = await visit('/');
  await page.waitForSelector('ytd-rich-item-renderer', { timeout: 30_000 }).catch(() => test.skip(true, 'home feed did not render'));
  const ys = await page.evaluate(() => [...document.querySelectorAll('ytd-rich-item-renderer')].slice(0, 6).map((e) => Math.round(e.getBoundingClientRect().y)));
  const perRow = ys.filter((y) => y === ys[0]).length;
  expect(perRow).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.close();
});

test('search: results fit the portrait viewport without horizontal overflow', async () => {
  const page = await visit('/results?search_query=lofi');
  await page.waitForSelector('ytd-video-renderer', { timeout: 30_000 }).catch(() => test.skip(true, 'search results did not render'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.close();
});

test('livestream (24/7 lofi stream): chat directly under the full-width player', async () => {
  const page = await visit('/watch?v=jfKfPfyJRdk');
  await page.waitForSelector('ytd-watch-flexy #player-container-outer', { state: 'attached' }); // hidden (not absent) behind YouTube's logged-out bot wall
  const hasChat = await page.waitForSelector('ytd-live-chat-frame#chat', { timeout: 30_000 }).then(() => true).catch(() => false);
  test.skip(!hasChat, 'stream is not live or chat did not mount for a logged-out automated browser');
  const vw = await page.evaluate(() => document.documentElement.clientWidth);
  const p = await measure(page, '#player-container-outer');
  const chat = await measure(page, 'ytd-live-chat-frame#chat');
  expect(p.width).toBe(vw);
  expect(chat.y).toBeGreaterThanOrEqual(p.bottom);
  expect(chat.y - p.bottom).toBeLessThan(60);
  expect(chat.height).toBeGreaterThanOrEqual(480);
  await page.close();
});
