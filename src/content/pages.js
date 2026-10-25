/*
 * Page classification. Only the URL decides the page kind; everything that
 * depends on live DOM state (livestream, theater mode, fullscreen, playlist)
 * is expressed in CSS through YouTube's own attributes on <ytd-watch-flexy>.
 *
 * Class names written to <html>:  ytvm-page-<kind>
 */
(function (root) {
  'use strict';

  const KINDS = ['watch', 'shorts', 'home', 'search', 'playlist', 'feed', 'channel', 'other'];

  const FEED_PATHS = /^\/(feed\/[^/]+|history|playlists|gaming|podcasts)\/?$/;
  const CHANNEL_PATHS = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)(\/.*)?$/;

  function classify(pathname) {
    const p = pathname || '/';
    if (p === '/' || p === '') return 'home';
    if (p === '/watch' || p.startsWith('/live/')) return 'watch';
    if (p.startsWith('/shorts/')) return 'shorts';
    if (p === '/results') return 'search';
    if (p === '/playlist') return 'playlist';
    if (FEED_PATHS.test(p)) return 'feed';
    if (CHANNEL_PATHS.test(p)) return 'channel';
    return 'other';
  }

  function classFor(kind) {
    return 'ytvm-page-' + kind;
  }

  const api = { KINDS, classify, classFor };
  root.YTVM = Object.assign(root.YTVM || {}, { pages: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
