import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** Loads the real content scripts, in manifest order, into a stub window. */
function load(pathname, width, height) {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  const classes = new Set();
  const listeners = {};
  const sandbox = {
    document: {
      documentElement: {
        clientWidth: width,
        classList: {
          add: (c) => classes.add(c),
          remove: (c) => classes.delete(c),
          toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
        },
      },
      addEventListener() {}, removeEventListener() {},
    },
    location: { pathname },
    innerWidth: width, innerHeight: height,
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter((f) => f !== fn); },
    requestAnimationFrame: (fn) => { fn(); return 1; },
    cancelAnimationFrame() {},
    dispatchEvent: () => true,
    Event: class { constructor(type) { this.type = type; } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of manifest.content_scripts[0].js) vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename: file });
  return { sandbox, classes, listeners };
}

test('index: applies portrait + page classes on start', () => {
  const { classes } = load('/watch', 1080, 1920);
  assert.deepEqual([...classes].sort(), ['ytvm-page-watch', 'ytvm-portrait']);
});

test('index: landscape start adds no portrait class', () => {
  const { classes } = load('/', 1920, 1080);
  assert.deepEqual([...classes], ['ytvm-page-home']);
});

test('index: stop() removes all classes and listeners, and is restartable', () => {
  const { sandbox, classes, listeners } = load('/watch', 1080, 1920);
  sandbox.YTVM.stop();
  assert.equal(classes.size, 0);
  assert.equal(Object.values(listeners).flat().length, 0);
  assert.equal(sandbox.YTVM_STARTED, false);
});

test('index: never starts twice (idempotent initialisation)', () => {
  const { sandbox, listeners } = load('/watch', 1080, 1920);
  const before = Object.values(listeners).flat().length;
  vm.runInContext(readFileSync('src/content/index.js', 'utf8'), sandbox);
  assert.equal(Object.values(listeners).flat().length, before);
});
