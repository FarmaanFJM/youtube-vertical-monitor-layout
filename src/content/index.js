/*
 * Entry point. Maintains three kinds of state on <html>, nothing else:
 *   ytvm-portrait        viewport is portrait-shaped (all layout CSS is gated on it)
 *   ytvm-page-<kind>     which family of pages we are on (from the URL)
 * All layout is done by the stylesheets; this script never moves YouTube's DOM.
 */
(function (root) {
  'use strict';
  if (!root.document || root.YTVM_STARTED) return;
  root.YTVM_STARTED = true;

  const { portrait, pages, navigation } = root.YTVM;
  const html = root.document.documentElement;
  let disposers = [];

  function applyPage() {
    const next = pages.classFor(pages.classify(root.location.pathname));
    pages.KINDS.forEach((kind) => {
      const cls = pages.classFor(kind);
      if (cls !== next) html.classList.remove(cls);
    });
    html.classList.add(next);
  }

  /*
   * YouTube's player measures its container with a ResizeObserver, but the
   * page's two-column/single-column mode is driven by `window.resize`. Nudge
   * it once after the layout flips so both settle on the new geometry. This
   * does not reload or seek the video.
   */
  function settle() {
    root.requestAnimationFrame(() => root.dispatchEvent(new Event('resize')));
  }

  function applyPortrait(isPortrait) {
    html.classList.toggle('ytvm-portrait', isPortrait);
    settle();
  }

  function start() {
    applyPage();
    disposers = [
      portrait.watchPortrait(root, applyPortrait),
      navigation.watchNavigation(root, applyPage),
    ];
  }

  /** Removes every class and listener; used by tests and on teardown. */
  function stop() {
    disposers.forEach((d) => d());
    disposers = [];
    html.classList.remove('ytvm-portrait');
    pages.KINDS.forEach((kind) => html.classList.remove(pages.classFor(kind)));
    root.YTVM_STARTED = false;
  }

  root.YTVM.stop = stop;
  start();
})(typeof globalThis !== 'undefined' ? globalThis : this);
