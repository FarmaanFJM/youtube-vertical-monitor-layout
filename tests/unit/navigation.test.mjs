import { test } from 'node:test';
import assert from 'node:assert/strict';
import { require } from './helpers.mjs';

const { watchNavigation, EVENTS } = require('../../src/content/navigation.js');

function fakeWin() {
  const make = () => {
    const m = new Map();
    return {
      m,
      addEventListener: (t, fn) => m.set(t, [...(m.get(t) || []), fn]),
      removeEventListener: (t, fn) => m.set(t, (m.get(t) || []).filter((f) => f !== fn)),
      fire: (t) => (m.get(t) || []).forEach((f) => f()),
      count: () => [...m.values()].reduce((n, a) => n + a.length, 0),
    };
  };
  const doc = make();
  const win = make();
  win.document = doc;
  return { win, doc };
}

test('subscribes to YouTube navigation events and popstate', () => {
  const { win, doc } = fakeWin();
  let calls = 0;
  watchNavigation(win, () => calls++);
  EVENTS.forEach((e) => doc.fire(e));
  win.fire('popstate');
  assert.equal(calls, EVENTS.length + 1);
});

test('disposer detaches everything (no leaked listeners)', () => {
  const { win, doc } = fakeWin();
  const dispose = watchNavigation(win, () => {});
  assert.ok(doc.count() > 0 && win.count() > 0);
  dispose();
  assert.equal(doc.count(), 0);
  assert.equal(win.count(), 0);
});
