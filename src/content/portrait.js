/* Portrait detection. Uses the real viewport, not the monitor orientation. */
(function (root) {
  'use strict';

  /** A viewport is portrait when it is taller than it is wide. */
  function isPortrait(width, height) {
    return height > width;
  }

  function viewportSize(win) {
    const de = win.document.documentElement;
    // Prefer the layout viewport (excludes scrollbars); fall back to window size.
    return {
      width: de && de.clientWidth ? de.clientWidth : win.innerWidth,
      height: win.innerHeight,
    };
  }

  /**
   * Calls onChange(isPortrait) once initially and whenever the orientation of
   * the viewport flips. Resize events are coalesced to one check per frame.
   * Returns a disposer that removes every listener.
   */
  function watchPortrait(win, onChange) {
    let current = null;
    let frame = 0;

    function check() {
      frame = 0;
      const { width, height } = viewportSize(win);
      const next = isPortrait(width, height);
      if (next !== current) {
        current = next;
        onChange(next);
      }
    }
    function schedule() {
      if (!frame) frame = win.requestAnimationFrame(check);
    }

    win.addEventListener('resize', schedule, { passive: true });
    win.addEventListener('orientationchange', schedule, { passive: true });
    check();

    return function dispose() {
      win.removeEventListener('resize', schedule);
      win.removeEventListener('orientationchange', schedule);
      if (frame) win.cancelAnimationFrame(frame);
    };
  }

  const api = { isPortrait, viewportSize, watchPortrait };
  root.YTVM = Object.assign(root.YTVM || {}, { portrait: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
