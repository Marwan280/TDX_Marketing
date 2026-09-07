import { getScrollRoot } from './scroll-root.js';

// Attempts to autoplay a muted/playsinline video and, if the browser blocks
// it (mobile Safari in particular can still refuse an unattended .play()
// call in some contexts — Low Power Mode, a page restored from bfcache,
// etc. — even though muted+playsinline is normally enough to be allowed),
// silently retries once on the very first real interaction anywhere on the
// page (touch, scroll, or click) instead of leaving the video stuck on its
// poster frame forever.
export function attemptAutoplay(video) {
  if (!video) return;

  function tryPlay() {
    var playResult = video.play();
    if (playResult && typeof playResult.then === 'function') {
      return playResult;
    }
    return Promise.resolve();
  }

  tryPlay().catch(function () {
    var retry = function () {
      tryPlay().catch(function () {});
    };
    document.addEventListener('touchstart', retry, { once: true, passive: true });
    document.addEventListener('click', retry, { once: true, passive: true });
    // html/body never scroll here (see reset.css) — #scrollRoot is the
    // element that actually does, so that's what needs the listener, not
    // document/window (which would never fire at all).
    var scrollRoot = getScrollRoot();
    if (scrollRoot) scrollRoot.addEventListener('scroll', retry, { once: true, passive: true });
  });
}
