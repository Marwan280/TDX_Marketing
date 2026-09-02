import { clamp01, easeInOut } from '../utils/easing.js';
import { createStableViewport } from '../utils/stable-viewport.js';

/**
 * Section 9 ("خلّني أعرّفك على ربعنا" — crew/partner logos): a plain,
 * un-pinned section, so unlike work-stories.js/services-stack.js this
 * doesn't need to drive a pinned timeline — just the same scroll-linked
 * mask reveal used for every other section's intro (see services-stack.js's
 * updateIntro), plus a one-shot toggle for the logo marquee (see
 * work-stories.js's initLogoWall). The marquee's own motion is pure CSS
 * (always-on, not scroll-tied) — this only ever toggles whether it's
 * visible.
 */
export function initPartnersReveal() {
  // See js/utils/stable-viewport.js — avoids a mobile address-bar
  // hide/show mid-scroll moving this section's own progress fraction.
  var viewport = createStableViewport();
  var intro = document.getElementById('partnersIntro');
  var heading = intro ? intro.querySelector('.partners-heading') : null;
  var subheading = intro ? intro.querySelector('.partners-subheading') : null;

  function updateIntro() {
    if (!intro) return;
    // Unlike services-stack.js's updateIntro (which measures to the
    // section's CENTER, because that section is followed by a pinned
    // stack that needs the heading fully settled first), this section is
    // the last thing on the page with no extra scroll room reserved below
    // it — measuring to the center would need more scroll distance than
    // the document actually has, so the heading could get stuck mid-reveal.
    // Measuring to the section's own TOP edge (like work-stories.js's
    // updateIntro) finishes as soon as the section has fully scrolled into
    // view, which is always reachable.
    var vh = viewport.height;
    var rect = intro.getBoundingClientRect();
    var t = clamp01(1 - rect.top / vh);

    var headingT = easeInOut(clamp01(t / 0.6));
    if (heading) heading.style.transform = 'translateY(' + (1 - headingT) * 100 + '%)';

    var subT = easeInOut(clamp01((t - 0.1) / 0.6));
    if (subheading) subheading.style.transform = 'translateY(' + (1 - subT) * 100 + '%)';
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
          updateIntro();
        } finally {
          ticking = false;
        }
      });
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateIntro);
  window.addEventListener('load', updateIntro);
  updateIntro();

  var marquee = document.getElementById('partnersMarquee');
  if (marquee && 'IntersectionObserver' in window) {
    var marqueeObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          marquee.classList.toggle('is-visible', entry.isIntersecting);
        });
      },
      { threshold: 0.2 }
    );
    marqueeObserver.observe(marquee);
  } else if (marquee) {
    marquee.classList.add('is-visible');
  }
}
