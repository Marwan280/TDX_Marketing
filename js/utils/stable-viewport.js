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
export function createStableViewport() {
  var height = window.innerHeight;
  var width = window.innerWidth;

  function refresh() {
    if (window.innerWidth !== width) {
      width = window.innerWidth;
      height = window.innerHeight;
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
