import { clamp01, easeInOut } from '../utils/easing.js';
import { createStableViewport } from '../utils/stable-viewport.js';

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
    // Same "arrival" shape as the cards below: 0 while still off-screen,
    // ramping to 1 as its center crosses into view — the panel itself is
    // exactly one viewport tall, so there's no internal scroll room to
    // measure a hold/progress fraction from, only its entrance.
    var t = clamp01(1 - (rect.top + rect.height / 2) / vh);
    var headingT = easeInOut(clamp01(t / 0.7));
    if (introHeading) introHeading.style.transform = 'translateY(' + (1 - headingT) * 100 + '%)';
    var subT = easeInOut(clamp01((t - 0.2) / 0.7));
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

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  window.addEventListener('load', update);
  update();
}
