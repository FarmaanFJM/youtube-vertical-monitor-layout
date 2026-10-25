/*
 * YouTube is a single-page application. Rather than observing the DOM, we use
 * the navigation events YouTube dispatches on `document`, plus popstate for
 * Back/Forward. No polling and no MutationObserver is involved.
 */
(function (root) {
  'use strict';

  const EVENTS = ['yt-navigate-start', 'yt-navigate-finish', 'yt-page-data-updated', 'yt-page-type-changed'];

  /** Calls onNavigate() for every navigation signal. Returns a disposer. */
  function watchNavigation(win, onNavigate) {
    const doc = win.document;
    const handler = () => onNavigate();
    EVENTS.forEach((name) => doc.addEventListener(name, handler, true));
    win.addEventListener('popstate', handler);
    return function dispose() {
      EVENTS.forEach((name) => doc.removeEventListener(name, handler, true));
      win.removeEventListener('popstate', handler);
    };
  }

  const api = { EVENTS, watchNavigation };
  root.YTVM = Object.assign(root.YTVM || {}, { navigation: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
