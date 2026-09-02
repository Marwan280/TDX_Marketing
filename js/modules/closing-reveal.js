import { clamp01, easeInOut } from '../utils/easing.js';
import { createVideoScrubber } from '../utils/video-scrub.js';
import { createStableViewport } from '../utils/stable-viewport.js';

/**
 * Closing/footer CTA: the last section on the page, so — same reasoning as
 * partners-reveal.js — the heading mask uses the section's own top edge for
 * its scroll progress, not its center, since there's no extra scroll room
 * reserved below it. The divider and social row are each a simple one-shot
 * IntersectionObserver toggle (draws in / staggers up via --i set inline in
 * the HTML) — the media container gets that same one-shot fade+zoom, but the
 * blinds video inside it is continuously scroll-scrubbed off the heading's
 * own `t` (see updateClosingVideo()), open on the way down, closed again on
 * the way back up.
 */
export function initClosingReveal() {
  // See js/utils/stable-viewport.js — avoids a mobile address-bar
  // hide/show mid-scroll moving this section's own progress fraction.
  var viewport = createStableViewport();
  var content = document.getElementById('closing');
  var heading = content ? content.querySelector('.closing-heading') : null;
  var subheading = content ? content.querySelector('.closing-subheading') : null;
  var closingVideo = document.getElementById('closingVideo');
  var reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Shared scrubber (see js/utils/video-scrub.js) — same seek-collision and
  // WebKit-freeze guards as the three hero-pin videos.
  var scrubClosingVideo = closingVideo ? createVideoScrubber(closingVideo) : null;

  // Bidirectional, unlike the hero videos: this section isn't pinned, so
  // there's no one-way "scroll past it" — scrolling down opens the blinds
  // and brings the cup out, scrolling back up closes them again, both
  // directly off the same `t` the heading mask-reveal already uses (0 as
  // the section's top reaches the viewport bottom, 1 once it reaches the
  // viewport top), so the video and the text arrive together either way.
  function updateClosingVideo(t) {
    if (!scrubClosingVideo || reducedMotion || !closingVideo.duration) return;
    scrubClosingVideo(clamp01(t) * closingVideo.duration);
  }

  function updateHeading() {
    if (!content) return;
    var vh = viewport.height;
    var rect = content.getBoundingClientRect();
    var t = clamp01(1 - rect.top / vh);

    var headingT = easeInOut(clamp01(t / 0.6));
    if (heading) heading.style.transform = 'translateY(' + (1 - headingT) * 100 + '%)';

    var subT = easeInOut(clamp01((t - 0.1) / 0.6));
    if (subheading) subheading.style.transform = 'translateY(' + (1 - subT) * 100 + '%)';

    updateClosingVideo(t);
  }

  var ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        // See the equivalent guard in scroll-story.js: without try/finally,
        // an exception here would leave `ticking` stuck true and silently
        // freeze this section's scroll updates for the rest of the page's
        // life.
        try {
          updateHeading();
        } finally {
          ticking = false;
        }
      });
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateHeading);
  window.addEventListener('load', updateHeading);
  updateHeading();

  var revealTargets = [
    document.getElementById('closingMedia'),
    document.getElementById('closingDivider'),
    document.getElementById('closingSocials'),
  ].filter(Boolean);

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }
}
