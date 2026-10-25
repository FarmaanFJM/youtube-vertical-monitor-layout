// Captures the README screenshots into docs/screenshots/.
//
//   node scripts/capture-screenshots.mjs live      # real www.youtube.com (logged out)
//   node scripts/capture-screenshots.mjs fixture   # tests/fixtures/youtube.html (simulated page)
//   node scripts/capture-screenshots.mjs install   # chrome://extensions with the extension loaded
//
// Live captures never try to get past YouTube's bot checks: if YouTube does not
// serve a normal page, the shot is skipped and reported. Fixture captures are
// named *-fixture so they cannot be mistaken for the real site.
import { launch } from '../tests/helpers/extension.mjs';
import { serveFixture } from '../tests/helpers/fixture.mjs';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/screenshots';
const PORTRAIT = { width: 1080, height: 1920 };
const LANDSCAPE = { width: 1920, height: 1080 };
const VIDEO = '/watch?v=jNQXAC9IVRw'; // the first YouTube video; stable and public
mkdirSync(OUT, { recursive: true });

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82 });

async function settle(page, ready) {
  await Promise.all(ready.map((sel) => page.waitForSelector(sel, { state: 'attached', timeout: 30_000 }).catch(() => {})));
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(3000); // thumbnails and comments finish painting
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function live() {
  const pages = [
    { path: VIDEO, ready: ['ytd-watch-flexy', '#related ytd-compact-video-renderer, #related yt-lockup-view-model', 'ytd-comment-thread-renderer'], names: { before: 'watch-before', after: 'watch-after' }, viewport: PORTRAIT },
    { path: '/results?search_query=lofi+hip+hop', ready: ['ytd-video-renderer'], names: { before: 'search-before', after: 'search-after' }, viewport: PORTRAIT },
    { path: VIDEO, ready: ['ytd-watch-flexy', '#related'], names: { after: 'landscape-restored' }, viewport: LANDSCAPE },
  ];
  for (const { path, ready, names, viewport } of pages) {
    for (const [variant, name] of Object.entries(names)) {
      const b = await launch({ extension: variant === 'after', viewport });
      const page = await b.context.newPage();
      await page.goto('https://www.youtube.com' + path, { waitUntil: 'domcontentloaded' });
      const ok = await page.waitForSelector('ytd-app', { timeout: 20_000 }).then(() => true).catch(() => false);
      if (!ok) { console.log(`SKIPPED ${name}: YouTube did not serve a normal page`); await b.close(); continue; }
      await settle(page, ready);
      const info = await page.evaluate(() => ({ portrait: document.documentElement.classList.contains('ytvm-portrait'), w: innerWidth, h: innerHeight, dpr: devicePixelRatio, botWall: /confirm you.re not a bot/i.test(document.body.innerText) }));
      await shot(page, name);
      console.log(`CAPTURED ${name} (${variant}, extension ${variant === 'after' ? 'on' : 'off'})`, JSON.stringify(info));
      await b.close();
    }
  }
}

async function fixture() {
  const jobs = [
    { path: '/watch?v=live', variant: 'before', name: 'livestream-before-fixture', video: true },
    { path: '/watch?v=live', variant: 'after', name: 'livestream-after-fixture', video: true },
    { path: '/', variant: 'after', name: 'home-after-fixture' },
  ];
  for (const { path, variant, name, video } of jobs) {
    const b = await launch({ extension: variant === 'after', viewport: PORTRAIT });
    await serveFixture(b.context);
    const page = await b.context.newPage();
    await page.goto('https://www.youtube.com' + path);
    await page.waitForSelector('ytd-page-manager > *');
    if (video) await page.waitForFunction(() => { const v = document.getElementById('fixture-video'); return v && v.currentTime > 0.5; });
    await page.waitForTimeout(500);
    await shot(page, name);
    console.log(`CAPTURED ${name} (fixture, extension ${variant === 'after' ? 'on' : 'off'})`);
    await b.close();
  }
}

async function install() {
  const b = await launch({ viewport: { width: 1200, height: 520 } });
  const page = await b.context.newPage();
  await page.goto('chrome://extensions');
  await page.evaluate(() => {
    const toolbar = document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar');
    toolbar.shadowRoot.querySelector('#devMode').click();
  }).catch((e) => console.log('dev mode toggle failed:', e.message));
  await page.waitForTimeout(1000);
  await shot(page, 'extension-installation');
  console.log('CAPTURED extension-installation (chrome://extensions)');
  await b.close();
}

const mode = process.argv[2];
if (mode === 'live') await live();
else if (mode === 'fixture') await fixture();
else if (mode === 'install') await install();
else { console.error('usage: capture-screenshots.mjs live|fixture|install'); process.exit(1); }
