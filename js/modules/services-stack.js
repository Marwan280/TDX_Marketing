import { clamp01, easeInOut } from '../utils/easing.js';
import { createStableViewport } from '../utils/stable-viewport.js';
import { getScrollRoot } from '../utils/scroll-root.js';
import { attemptAutoplay } from '../utils/autoplay.js';

/**
 * Section 7 (services): an independent "stacking cards" sequence, separate
 * from the hero's own pin. Cards are pure-CSS sticky (see services.css for
 * the negative-margin overlap trick) — this module only drives the content
 * PER CARD: how far the incoming card has settled into place, how much the
 * outgoing one has shrunk/dimmed under it, plus the fixed progress rail.
 */
export function initServicesStack() {
  var section = document.getElementById('services');
  if (!section) return;

  // See js/utils/stable-viewport.js — avoids a mobile address-bar
  // hide/show mid-scroll moving each card's own progress fraction.
  var viewport = createStableViewport();

  var intro = document.getElementById('servicesIntro');
  var introHeading = intro ? intro.querySelector('.services-heading') : null;
  var introSubheading = intro ? intro.querySelector('.services-subheading') : null;

  var stack = document.getElementById('servicesStack');
  var cardEls = stack ? Array.prototype.slice.call(stack.querySelectorAll('.service-card')) : [];
  var cardCount = cardEls.length;

  var cards = cardEls.map(function (card) {
    return {
      el: card,
      pin: card.querySelector('.service-card-pin'),
      content: card.querySelector('.service-card-content'),
    };
  });

  var progressWrap = document.getElementById('servicesProgress');
  var progressFill = document.getElementById('servicesProgressFill');
  var progressCurrent = document.getElementById('servicesProgressCurrent');

  // How much of the card's own arrival window (rect.top going from vh to 0)
  // stays fully static/held before it starts visibly moving — keeps the
  // reveal from starting the instant the card's box first peeks on screen.
  var ARRIVE_HOLD = 0.35;

  function updateIntro() {
    if (!intro) return;
    var vh = viewport.height;
    var rect = intro.getBoundingClientRect();
    // Measured off the panel's TOP edge (0 as it peeks in, 1 once it has
    // fully arrived) and finished early: the heading is completely in by
    // the time the panel is ~40% on screen and the subheading right behind
    // it, so both are already sitting there, readable, while the user is
    // still scrolling in — before the tear video (which waits for the whole
    // panel) starts. It used to measure to the panel's CENTER, which only
    // reached 1 once the panel had scrolled half-way back OUT again.
    var t = clamp01(1 - rect.top / vh);
    var headingT = easeInOut(clamp01(t / 0.4));
    if (introHeading) introHeading.style.transform = 'translateY(' + (1 - headingT) * 100 + '%)';
    var subT = easeInOut(clamp01((t - 0.05) / 0.4));
    if (introSubheading) introSubheading.style.transform = 'translateY(' + (1 - subT) * 100 + '%)';
  }

  function updateCards() {
    if (!cardCount) return;
    var vh = viewport.height;
    var activeIndex = 0;
    var stackVisible = false;

    cards.forEach(function (card, i) {
      var rect = card.el.getBoundingClientRect();

      // arriveT: 0 while the card is still below the fold, ramps to 1 as it
      // settles into its sticky resting spot — drives THIS card's own
      // content entrance (fade/slide/blur in).
      var arriveT = easeInOut(clamp01((1 - rect.top / vh - ARRIVE_HOLD) / (1 - ARRIVE_HOLD)));

      if (card.content) {
        card.content.style.opacity = String(arriveT);
        card.content.style.transform = 'translateY(' + (1 - arriveT) * 46 + 'px)';
        card.content.style.filter = 'blur(' + (1 - arriveT) * 6 + 'px)';
      }

      // The PREVIOUS card recedes (shrinks/dims) in exact lockstep with
      // THIS card's own arrival — the two are tied to the same number, so
      // the outgoing card only ever moves because the incoming one is
      // actually covering it, never on its own.
      var prev = cards[i - 1];
      if (prev && prev.pin) {
        prev.pin.style.transform = 'scale(' + (1 - arriveT * 0.1) + ')';
        prev.pin.style.filter = 'brightness(' + (1 - arriveT * 0.4) + ')';
      }

      if (rect.top < vh && rect.bottom > 0) stackVisible = true;
      if (rect.top <= vh * 0.5) activeIndex = i;
    });

    if (progressWrap) progressWrap.classList.toggle('is-visible', stackVisible);
    if (progressFill) progressFill.style.height = ((activeIndex + 1) / cardCount) * 100 + '%';
    if (progressCurrent) progressCurrent.textContent = String(activeIndex + 1).padStart(2, '0');
  }

  function update() {
    updateIntro();
    updateCards();
  }

  // Tear-through-the-wall clip behind the heading: nothing is fetched until
  // the panel is within a screen of view (preload="none" + the device-
  // specific <source> main.js injects), starts as soon as the panel is
  // ~40% on screen (the heading is fully in by then), plays once, holds on its last frame (the hand
  // with the dessert), and rewinds once it's fully off-screen so it replays
  // next time. The clips themselves are pre-trimmed to begin right at the
  // tear, so there's no blank lead-in to sit through.
  function initIntroVideo() {
    var video = document.getElementById('servicesIntroVideo');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!video || !intro || reduced || !('IntersectionObserver' in window)) return;

    var warmed = false;
    var played = false;
    new IntersectionObserver(
      function (entries) {
        if (warmed || !entries[0].isIntersecting) return;
        warmed = true;
        video.preload = 'auto';
        video.load();
        // Prime decoding with a throwaway muted play/pause — iOS Safari
        // won't buffer a video that has never played, so without this the
        // first real play() had to fetch from cold and the tear started late.
        var primed = video.play();
        if (primed && typeof primed.then === 'function') {
          primed
            .then(function () {
              if (!played) {
                video.pause();
                video.currentTime = 0;
              }
            })
            .catch(function () {});
        }
      },
      { rootMargin: '100% 0px 100% 0px' }
    ).observe(intro);

    new IntersectionObserver(
      function (entries) {
        var entry = entries[entries.length - 1];
        if (entry.intersectionRatio >= 0.4) {
          if (!played) {
            played = true;
            video.currentTime = 0;
            attemptAutoplay(video);
          }
        } else if (!entry.isIntersecting) {
          played = false;
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: [0, 0.4] }
    ).observe(intro);
  }

  initIntroVideo();

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
          update();
        } finally {
          ticking = false;
        }
      });
    }
  }

  getScrollRoot().addEventListener('scroll', onScroll, { passive: true });
  getScrollRoot().addEventListener('touchmove', onScroll, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  update();
}
