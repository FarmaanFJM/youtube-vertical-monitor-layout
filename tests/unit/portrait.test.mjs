import { test } from 'node:test';
import assert from 'node:assert/strict';
import { require } from './helpers.mjs';

const { isPortrait, watchPortrait } = require('../../src/content/portrait.js');

test('isPortrait: taller than wide only', () => {
  assert.equal(isPortrait(1080, 1920), true);
  assert.equal(isPortrait(720, 1280), true);
  assert.equal(isPortrait(1920, 1080), false);
  assert.equal(isPortrait(1280, 720), false);
  assert.equal(isPortrait(1000, 1000), false); // square is not portrait
  assert.equal(isPortrait(1000, 1001), true);
});

function fakeWindow(width, height) {
  const listeners = new Map();
  let rafQueue = [];
  const win = {
    innerWidth: width,
    innerHeight: height,
    document: { documentElement: { clientWidth: width } },
    addEventListener: (t, fn) => listeners.set(t, [...(listeners.get(t) || []), fn]),
    removeEventListener: (t, fn) => listeners.set(t, (listeners.get(t) || []).filter((f) => f !== fn)),
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: () => { rafQueue = []; },
    count: (t) => (listeners.get(t) || []).length,
    resize(w, h) { win.innerWidth = w; win.innerHeight = h; win.document.documentElement.clientWidth = w; (listeners.get('resize') || []).forEach((f) => f()); },
    flush() { const q = rafQueue; rafQueue = []; q.forEach((f) => f()); },
  };
  return win;
}

test('watchPortrait: reports initial state and only real flips', () => {
  const win = fakeWindow(1080, 1920);
  const seen = [];
  const dispose = watchPortrait(win, (p) => seen.push(p));
  assert.deepEqual(seen, [true]);
  win.resize(1000, 1900); win.flush();         // still portrait: no callback
  assert.deepEqual(seen, [true]);
  win.resize(1920, 1080); win.flush();
  assert.deepEqual(seen, [true, false]);
  win.resize(1080, 1920); win.flush();
  assert.deepEqual(seen, [true, false, true]);
  dispose();
});

test('watchPortrait: bursts of resize events are coalesced into one frame check', () => {
  const win = fakeWindow(1080, 1920);
  const seen = [];
  watchPortrait(win, (p) => seen.push(p));
  for (let i = 0; i < 50; i++) win.resize(1920, 1080);
  win.flush();
  assert.deepEqual(seen, [true, false]);
});

test('watchPortrait: disposer removes every listener', () => {
  const win = fakeWindow(1080, 1920);
  const dispose = watchPortrait(win, () => {});
  assert.equal(win.count('resize'), 1);
  assert.equal(win.count('orientationchange'), 1);
  dispose();
  assert.equal(win.count('resize'), 0);
  assert.equal(win.count('orientationchange'), 0);
});
