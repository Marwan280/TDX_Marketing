// Caches window.innerHeight/innerWidth and only refreshes them on a genuine
// resize. Mobile browsers (Safari and Chrome both) resize the *height* of
// window.innerHeight on their own mid-scroll, as the address bar/toolbar
// hides on scroll-down and reappears on scroll-up — the width never changes
// from that. Every scroll-driven module on this site computes "how far
// through this phase am I" from window.innerHeight (directly, or via
// section.offsetHeight - window.innerHeight); reading that live on every
// scroll tick means the denominator of that fraction is a moving target
// during a single real scroll gesture, and the whole phase sequence visibly
// jumps/overlaps as a result — this is what the mobile "sections stacking on
// top of each other" reports traced back to. Treating only a WIDTH change as
// a real resize (orientation change, actual window resize, devtools) filters
// that out, since a toolbar hide/show never changes the width.
// Also published as --vh100 (1% of this same frozen height, in px) so CSS
// that drives actual scroll DISTANCE — .hero's 1265vh total — can be
// expressed as calc(var(--vh100) * 1265) instead of plain vh. Plain vh on
// iOS Safari doesn't stay put the way this module's own `height` doesn't:
// the very same address-bar hide/show that .hero-pin's 100svh already
// works around also nudges .hero's OWN total scrollable height as the
// toolbar comes and goes, which desyncs anything computed as a fraction of
// hero.offsetHeight (the TDX logo's color-reveal clip-path chief among
// them) from where the video/scroll position actually is. Routing the
// height through this same frozen value keeps every fraction of it
// (JS-side and CSS-side) locked to the one number for the life of the
// gesture, exactly like `height` below already is.
function publish(height) {
  document.documentElement.style.setProperty('--vh100', height / 100 + 'px');
}

export function createStableViewport() {
  var height = window.innerHeight;
  var width = window.innerWidth;
  publish(height);

  function refresh() {
    if (window.innerWidth !== width) {
      width = window.innerWidth;
      height = window.innerHeight;
      publish(height);
      return true;
    }
    return false;
  }

  window.addEventListener('resize', refresh, { passive: true });

  return {
    get height() {
      return height;
    },
    get width() {
      return width;
    },
    refresh: refresh,
  };
}
