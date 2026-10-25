import { test, expect } from '@playwright/test';
import { launch } from '../helpers/extension.mjs';
import { serveFixture, open, rect, pageMetrics } from '../helpers/fixture.mjs';

const PORTRAIT = { width: 1080, height: 1920 };
const LANDSCAPE = { width: 1920, height: 1080 };

let browser;
test.beforeAll(async () => {
  browser = await launch();
  await serveFixture(browser.context);
});
test.afterAll(async () => browser.close());

test('control: without the extension the fixture is NOT edge to edge (the assertions can fail)', async () => {
  const bare = await launch({ extension: false });
  await serveFixture(bare.context);
  const page = await open(bare.context, '/watch?v=abc', PORTRAIT);
  const p = await rect(page, '#player-container-outer');
  expect(p.width).toBeLessThan(1080);
  expect((await pageMetrics(page)).classes).not.toContain('ytvm-portrait');
  await bare.close();
});

test.describe('native components are preserved and interactive', () => {
  test('player, chat iframe and comment/recommendation controls work in portrait', async () => {
    const page = await open(browser.context, '/watch?v=live', PORTRAIT);
    // the one real <video> and <iframe> are still mounted; nothing was cloned
    expect(await page.locator('video').count()).toBe(1);
    expect(await page.locator('iframe#chatframe').count()).toBe(1);
    expect(await page.locator('ytd-comments').count()).toBe(1);
    // comments: like + reply + native input
    await page.locator('ytd-comment-thread-renderer .like').first().click();
    await expect(page.locator('ytd-comment-thread-renderer .like').first()).toHaveClass(/liked/);
    await page.locator('ytd-comment-thread-renderer .reply-btn').first().click();
    await expect(page.locator('ytd-comment-thread-renderer .replies').first()).toBeVisible();
    await page.locator('#comment-input').fill('hello');
    expect(await page.locator('#comment-input').inputValue()).toBe('hello');
    // recommendations: native item menu opens and is not clipped to its card
    await page.locator('#related .rec-menu').first().click();
    const pop = page.locator('#related .popup-inline').first();
    await expect(pop).toBeVisible();
    // native chat toggle control works
    await page.locator('.chat-toggle').click();
    await expect(page.locator('ytd-live-chat-frame#chat')).toHaveAttribute('collapsed', '');
    await page.close();
  });

  test('livestream chat is scrollable and new messages do not rearrange the page', async () => {
    const page = await open(browser.context, '/watch?v=live', PORTRAIT);
    const frame = page.frameLocator('#chatframe');
    await expect(frame.locator('#items > div').first()).toBeVisible();
    const scrollable = await page.frames()[1].evaluate(() => {
      const el = document.getElementById('items');
      return el.scrollHeight > el.clientHeight;
    });
    expect(scrollable).toBe(true);
    const before = { player: await rect(page, '#player-container-outer'), chat: await rect(page, '#chat'), meta: await rect(page, 'ytd-watch-metadata'), height: await page.evaluate(() => document.documentElement.scrollHeight), classes: (await pageMetrics(page)).classes };
    // a burst of live messages
    await page.frames()[1].evaluate(() => { for (let i = 0; i < 200; i++) window.addMessage(); });
    await page.waitForTimeout(300);
    const after = { player: await rect(page, '#player-container-outer'), chat: await rect(page, '#chat'), meta: await rect(page, 'ytd-watch-metadata'), height: await page.evaluate(() => document.documentElement.scrollHeight), classes: (await pageMetrics(page)).classes };
    expect(after).toEqual(before);
    expect(await page.evaluate(() => window.__fixture.chatLoads)).toBe(1);
    await page.close();
  });
});

test.describe('resizing portrait <-> landscape', () => {
  test('layout flips, native layout returns, playback and chat session survive', async () => {
    const page = await open(browser.context, '/watch?v=live', PORTRAIT);
    await page.waitForFunction(() => { const v = document.getElementById('fixture-video'); return v && v.currentTime > 0.3 && !v.paused; });
    const snap = () => page.evaluate(() => {
      const v = document.getElementById('fixture-video');
      return { uid: v.uid, t: v.currentTime, paused: v.paused, events: [...window.__fixture.videoEvents], chatLoads: window.__fixture.chatLoads, iframeSame: document.getElementById('chatframe') === window.__iframeRef };
    });
    await page.evaluate(() => { window.__iframeRef = document.getElementById('chatframe'); });
    const a = await snap();

    // → landscape
    await page.setViewportSize(LANDSCAPE);
    await page.waitForFunction(() => !document.documentElement.classList.contains('ytvm-portrait'));
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#columns')).display)).toBe('flex');
    const land = await rect(page, '#player-container-outer');
    expect(land.width).toBeLessThan(LANDSCAPE.width);
    expect((await rect(page, '#related')).x).toBeGreaterThanOrEqual(land.right);
    // no leftover inline positioning from the extension
    expect(await page.evaluate(() => document.querySelectorAll('[style*="ytvm"], .ytvm-moved').length)).toBe(0);
    const b = await snap();

    // → portrait again
    await page.setViewportSize(PORTRAIT);
    await page.waitForFunction(() => document.documentElement.classList.contains('ytvm-portrait'));
    const p = await rect(page, '#player-container-outer');
    expect(p.x).toBe(0);
    expect(p.width).toBe(1080);
    expect((await rect(page, '#chat')).y).toBeGreaterThanOrEqual(p.bottom);
    const c = await snap();

    for (const s of [b, c]) {
      expect(s.uid).toBe(a.uid);            // the same <video> element
      expect(s.chatLoads).toBe(1);          // chat iframe never re-created
      expect(s.iframeSame).toBe(true);
      expect(s.events).toEqual(a.events);   // no loadstart/emptied/seeking: video not reloaded
    }
    expect(c.t).toBeGreaterThan(a.t);       // playback position kept advancing
    expect(c.paused).toBe(false);
    await page.close();
  });

  test('repeated resizing does not accumulate classes or listeners', async () => {
    const page = await open(browser.context, '/watch?v=abc', PORTRAIT);
    for (let i = 0; i < 6; i++) {
      await page.setViewportSize(i % 2 ? PORTRAIT : LANDSCAPE);
      await page.waitForFunction((want) => document.documentElement.classList.contains('ytvm-portrait') === want, i % 2 === 1);
    }
    const classes = (await pageMetrics(page)).classes.split(/\s+/).filter((c) => c.startsWith('ytvm-'));
    expect(classes.sort()).toEqual(['ytvm-page-watch', 'ytvm-portrait']);
    await page.close();
  });
});

test.describe('SPA navigation, header and Back/Forward', () => {
  test('logo, hamburger, search, recommendation click, Back, notifications, profile', async () => {
    const page = await open(browser.context, '/watch?v=abc', PORTRAIT);
    await page.evaluate(() => { window.__marker = 'same-document'; }); // detects full reloads

    // hamburger opens an overlay and never narrows the player
    const before = await rect(page, '#player-container-outer');
    await page.click('#guide-button');
    await expect(page.locator('tp-yt-app-drawer#guide')).toHaveAttribute('opened', '');
    const drawer = await rect(page, 'tp-yt-app-drawer#guide');
    expect(drawer.width).toBeGreaterThan(0);
    expect(await rect(page, '#player-container-outer')).toEqual(before);
    await page.click('#guide-button');

    // header is above the video, not beside it
    const header = await rect(page, '#masthead-container');
    expect(header.bottom).toBeLessThanOrEqual(before.y);

    // notifications and profile menus
    await page.click('#notifications-button');
    await expect(page.locator('#notifications-popup')).toBeVisible();
    await page.click('#notifications-button');
    await page.click('#avatar-btn');
    await expect(page.locator('#account-popup')).toBeVisible();
    await page.click('#avatar-btn');

    // original search → results page gets the search classes
    await page.fill('#search', 'cats');
    await page.press('#search', 'Enter');
    await page.waitForURL(/\/results\?search_query=cats/);
    await expect(page.locator('html')).toHaveClass(/ytvm-page-search/);
    await expect(page.locator('html')).not.toHaveClass(/ytvm-page-watch/);

    // logo → home
    await page.click('#logo');
    await page.waitForURL('https://www.youtube.com/');
    await expect(page.locator('html')).toHaveClass(/ytvm-page-home/);

    // home → video
    await page.click('ytd-rich-item-renderer a.title');
    await page.waitForURL(/\/watch\?v=v0/);
    await expect(page.locator('html')).toHaveClass(/ytvm-page-watch/);
    let p = await rect(page, '#player-container-outer');
    expect(p.x).toBe(0);
    expect(p.width).toBe(1080);

    // recommendation → another video (watch → watch)
    await page.click('#related a.rec-title >> nth=2');
    await page.waitForURL(/\/watch\?v=rec2/);
    p = await rect(page, '#player-container-outer');
    expect(p.width).toBe(1080);

    // Back returns to the previous video with the layout reapplied
    await page.goBack();
    await page.waitForURL(/\/watch\?v=v0/);
    p = await rect(page, '#player-container-outer');
    expect(p.width).toBe(1080);
    await page.goBack(); // home
    await expect(page.locator('html')).toHaveClass(/ytvm-page-home/);
    await page.goBack(); // search
    await expect(page.locator('html')).toHaveClass(/ytvm-page-search/);
    await page.goBack(); // original video
    await expect(page.locator('html')).toHaveClass(/ytvm-page-watch/);
    expect(await page.evaluate(() => window.__marker)).toBe('same-document'); // never reloaded
    // exactly one page-kind class at any time
    const kinds = (await pageMetrics(page)).classes.split(/\s+/).filter((c) => c.startsWith('ytvm-page-'));
    expect(kinds).toEqual(['ytvm-page-watch']);
    await page.close();
  });

  test('switching between a regular video and a livestream re-flows without reload', async () => {
    const page = await open(browser.context, '/watch?v=abc', PORTRAIT);
    expect(await page.locator('ytd-live-chat-frame').count()).toBe(0);
    await page.evaluate(() => window.__fixtureNavigate('/watch?v=live'));
    await expect(page.locator('ytd-live-chat-frame#chat')).toBeVisible();
    const player = await rect(page, '#player-container-outer');
    const chat = await rect(page, '#chat');
    expect(player.width).toBe(1080);
    expect(chat.y).toBeGreaterThanOrEqual(player.bottom);
    await page.evaluate(() => window.__fixtureNavigate('/watch?v=abc'));
    await expect(page.locator('ytd-live-chat-frame')).toHaveCount(0);
    const related = await rect(page, '#related');
    const comments = await rect(page, '#comments');
    expect(comments.right).toBeLessThanOrEqual(related.x);
    await page.close();
  });
});

test.describe('fullscreen', () => {
  test('native video fullscreen is not altered by the portrait layout', async () => {
    const page = await open(browser.context, '/watch?v=abc', PORTRAIT);
    await page.click('.ytp-fullscreen-button');
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.waitForSelector('ytd-watch-flexy[fullscreen]', { state: 'attached' }); // YouTube reflects fullscreen on the element
    const info = await page.evaluate(() => ({
      fsId: document.fullscreenElement.id,
      attr: document.querySelector('ytd-watch-flexy').hasAttribute('fullscreen'),
      columns: getComputedStyle(document.querySelector('#columns')).display, // YouTube's own rule hides it
      fsRect: (() => { const r = document.fullscreenElement.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })(),
    }));
    expect(info.fsId).toBe('movie_player');
    expect(info.attr).toBe(true);
    expect(info.columns).toBe('none');
    expect(info.fsRect[0]).toBe(0);
    expect(info.fsRect[1]).toBe(0);
    expect(info.fsRect[2]).toBe(1080);
    // chat/comments/recommendations are not part of the fullscreen element
    expect(await page.evaluate(() => document.fullscreenElement.contains(document.querySelector('#related')))).toBe(false);
    expect(info.fsRect[3]).toBe(1920);
    // the native fullscreen player is the whole video, uncropped: the video element fills it
    const vr = await rect(page, '#fixture-video');
    expect(vr.width).toBe(1080);
    await page.click('.ytp-fullscreen-button'); // YouTube's own button toggles back out
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.waitForSelector('ytd-watch-flexy:not([fullscreen])');
    // layout is restored afterwards
    const p = await rect(page, '#player-container-outer');
    expect(p.width).toBe(1080);
    await page.close();
  });

  test('F11-style fullscreen window (taller/larger portrait viewport) keeps the layout', async () => {
    // Browser F11 only changes the viewport size; emulate a full 1440x2560 viewport.
    const page = await open(browser.context, '/watch?v=live', { width: 1440, height: 2560 });
    const p = await rect(page, '#player-container-outer');
    expect(p.width).toBe(1440);
    expect(p.height).toBeCloseTo(810, 0);
    await page.close();
  });
});

test.describe('theater mode', () => {
  test('theater keeps the player edge to edge with no min-height gap', async () => {
    for (const vp of [PORTRAIT, { width: 720, height: 1280 }]) {
      const page = await open(browser.context, '/watch?v=abc', vp);
      await page.evaluate(() => window.__fixtureSetTheater(true));
      const p = await rect(page, '#player-container-outer');
      expect(p.x).toBe(0);
      expect(p.width).toBe(vp.width);
      expect(Math.abs(p.height - (vp.width * 9) / 16)).toBeLessThanOrEqual(1);
      expect(p.y).toBe(56);
      const meta = await rect(page, 'ytd-watch-metadata');
      expect(meta.y - p.bottom).toBeLessThan(40); // no empty band under the player
      const m = await pageMetrics(page);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      await page.close();
    }
  });
});

test.describe('other page families', () => {
  test('home: two-column grid, no reserved guide width', async () => {
    const page = await open(browser.context, '/', PORTRAIT);
    const items = await page.evaluate(() => [...document.querySelectorAll('ytd-rich-item-renderer')].slice(0, 4).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width)]; }));
    expect(new Set(items.map((i) => i[1])).size).toBe(2);             // 2 per row
    expect(items[0][0]).toBeLessThan(40);                             // starts at the left edge (mini guide margin removed)
    expect(items[0][2] + items[1][2]).toBeGreaterThan(1080 * 0.9);
    expect((await pageMetrics(page)).scrollWidth).toBeLessThanOrEqual(1080);
    await page.close();
  });

  test('home: single column on very narrow windows', async () => {
    const page = await open(browser.context, '/', { width: 480, height: 900 });
    const ys = await page.evaluate(() => [...document.querySelectorAll('ytd-rich-item-renderer')].slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().y)));
    expect(new Set(ys).size).toBe(3);
    expect((await pageMetrics(page)).scrollWidth).toBeLessThanOrEqual(480);
    await page.close();
  });

  test('search results: two columns of stacked cards inside the viewport', async () => {
    const page = await open(browser.context, '/results?search_query=x', PORTRAIT);
    const cards = await page.evaluate(() => [...document.querySelectorAll('ytd-video-renderer')].slice(0, 4).map((e) => { const r = e.getBoundingClientRect(); const t = e.querySelector('.thumb').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), tw: Math.round(t.width), right: Math.round(r.right) }; }));
    expect(cards[0].y).toBe(cards[1].y);
    expect(cards[0].x).toBeLessThan(cards[1].x);
    expect(cards[0].tw).toBe(cards[0].w); // thumbnail fills the card
    expect(Math.max(...cards.map((c) => c.right))).toBeLessThanOrEqual(1080);
    await page.close();
  });

  for (const [name, url] of [['subscriptions', '/feed/subscriptions'], ['channel', '/@channel']]) {
    test(`${name}: rich grid in two columns`, async () => {
      const page = await open(browser.context, url, PORTRAIT);
      const ys = await page.evaluate(() => [...document.querySelectorAll('ytd-rich-item-renderer')].slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().y)));
      expect(new Set(ys).size).toBe(2);
      expect((await pageMetrics(page)).scrollWidth).toBeLessThanOrEqual(1080);
      await page.close();
    });
  }

  for (const [name, url] of [['playlist', '/playlist?list=PL1'], ['history', '/feed/history']]) {
    test(`${name}: stacked layout with no horizontal overflow`, async () => {
      const page = await open(browser.context, url, PORTRAIT);
      const m = await pageMetrics(page);
      expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
      const first = await rect(page, 'ytd-video-renderer');
      expect(first.x).toBeLessThan(40);
      expect(first.width).toBeGreaterThan(400);
      await page.close();
    });
  }

  test('shorts: vertical player keeps its 9:16 ratio and is not forced to 16:9', async () => {
    const page = await open(browser.context, '/shorts/abc', PORTRAIT);
    const p = await rect(page, '#shorts-player');
    expect(Math.abs(p.width / p.height - 9 / 16)).toBeLessThan(0.01);
    expect((await pageMetrics(page)).classes).toContain('ytvm-page-shorts');
    await page.close();
  });
});
