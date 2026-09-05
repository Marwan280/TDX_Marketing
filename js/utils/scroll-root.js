// The one real scrolling element on the page (see #scrollRoot in
// index.html/en/index.html and reset.css) — html/body are locked with
// overflow: hidden so mobile Safari's address bar never auto-hides/shows
// mid-scroll (that behavior is tied specifically to the document scrolling,
// not a nested element), which is what kept desyncing this site's
// scroll-jacked sections from their own scroll math. Every module that used
// to listen on `window`'s scroll event or call `window.scrollTo` now goes
// through this instead.
export function getScrollRoot() {
  return document.getElementById('scrollRoot');
}
