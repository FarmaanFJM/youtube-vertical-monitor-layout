import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HTML = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/youtube.html'), 'utf8');

/** Serves the fixture for every document request to www.youtube.com. */
export async function serveFixture(context) {
  await context.route('https://www.youtube.com/**', (route) => {
    if (route.request().resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML });
    }
    return route.fulfill({ status: 204, body: '' });
  });
}

export async function open(context, pathAndQuery, viewport) {
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  await page.goto('https://www.youtube.com' + pathAndQuery);
  await page.waitForSelector('ytd-page-manager > *');
  return page;
}

/** Bounding rectangle of the first match, rounded to 0.1px, or null. */
export function rect(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const f = (n) => Math.round(n * 10) / 10;
    return { x: f(r.x), y: f(r.y + window.scrollY), right: f(r.right), bottom: f(r.bottom + window.scrollY), width: f(r.width), height: f(r.height) };
  }, selector);
}

export function pageMetrics(page) {
  return page.evaluate(() => ({
    inner: [window.innerWidth, window.innerHeight],
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    classes: document.documentElement.className,
  }));
}
