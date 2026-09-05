import { getScrollRoot } from './scroll-root.js';

// Approximates the "toolbar tints to match the page" effect iOS Safari does
// on its own for a plain, natively-scrolling page — something it can no
// longer do here now that html/body are locked and #scrollRoot does the
// real scrolling instead (see reset.css). Each major section/zone is tagged
// data-bar="light"|"dark" by hand (index.html/en/index.html); this walks up
// from whatever's actually rendered at the very bottom edge of the screen
// to the nearest tagged ancestor and flips <meta name="theme-color"> to
// match. Only a light/dark swap, not a live pixel-for-pixel color blend —
// but it keeps the bar from reading as a flat, unrelated black strip over a
// light section (or vice versa).
var LIGHT = '#ffffff';
var DARK = '#0b0d10';

export function initThemeColorSync() {
  var metaEl = document.querySelector('meta[name="theme-color"]');
  if (!metaEl) return;

  var current = null;
  function apply(isLight) {
    var value = isLight ? LIGHT : DARK;
    if (value === current) return;
    current = value;
    metaEl.setAttribute('content', value);
  }

  function sync() {
    var x = Math.floor(window.innerWidth / 2);
    var y = window.innerHeight - 2;
    var node = document.elementFromPoint(x, y);
    while (node && node !== document.documentElement) {
      var bar = node.getAttribute && node.getAttribute('data-bar');
      if (bar) {
        apply(bar === 'light');
        return;
      }
      node = node.parentElement;
    }
  }

  var ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        // See the equivalent guard in scroll-story.js: without try/finally,
        // an exception here would leave `ticking` stuck true and silently
        // freeze this sync for the rest of the page's life.
        try {
          sync();
        } finally {
          ticking = false;
        }
      });
    }
  }

  var scrollRoot = getScrollRoot();
  if (scrollRoot) scrollRoot.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', sync);
  window.addEventListener('load', sync);
  sync();
}
