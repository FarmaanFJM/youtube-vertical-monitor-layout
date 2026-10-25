import { test } from 'node:test';
import assert from 'node:assert/strict';
import { require } from './helpers.mjs';

const { classify, classFor, KINDS } = require('../../src/content/pages.js');

const cases = {
  '/': 'home',
  '/watch': 'watch',
  '/live/abc123': 'watch',
  '/shorts/xyz': 'shorts',
  '/results': 'search',
  '/playlist': 'playlist',
  '/feed/subscriptions': 'feed',
  '/feed/library': 'feed',
  '/feed/history': 'feed',
  '/history': 'feed',
  '/playlists': 'feed',
  '/@someone': 'channel',
  '/@someone/videos': 'channel',
  '/channel/UC123/streams': 'channel',
  '/c/legacy': 'channel',
  '/user/legacy': 'channel',
  '/account': 'other',
  '/premium': 'other',
};

for (const [path, kind] of Object.entries(cases)) {
  test(`classify ${path} -> ${kind}`, () => assert.equal(classify(path), kind));
}

test('every kind returned is a known kind and has a class name', () => {
  for (const kind of Object.values(cases)) assert.ok(KINDS.includes(kind));
  assert.equal(classFor('watch'), 'ytvm-page-watch');
});

test('empty path falls back to home', () => assert.equal(classify(''), 'home'));
