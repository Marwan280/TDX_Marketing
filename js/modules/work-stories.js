import { clamp01, easeInOut, smoothstep } from '../utils/easing.js';
import { createStableViewport } from '../utils/stable-viewport.js';
import { getScrollRoot } from '../utils/scroll-root.js';

/**
 * Section 8 (work / case studies): ONE pinned block (.work-pin) holding all
 * 3 case studies stacked on top of each other — moving between them is a
 * pure crossfade, nothing ever slides vertically. The pin's own scroll
 * range (.work-pin-outer's height) splits into 3 equal thirds, one per case
 * study. Each case study's own challenge/action/result now render together
 * (see .work-beats in work.css) instead of the old sequential per-beat
 * reveal — that was 3 scroll-triggered beats times 3 companies, which read
 * as a long slog. Scroll now only drives the crossfade FROM ONE COMPANY TO
 * THE NEXT. The client-mark cluster on the side reshuffles in lockstep:
 * whichever case study is active gets the front slot, the other two recede
 * to mid/back — a small deck of cards.
 */
export function initWorkStories() {
  var section = document.getElementById('work');
  if (!section) return;

  // See js/utils/stable-viewport.js — avoids a mobile address-bar
  // hide/show mid-scroll moving this pin's own progress fraction.
  var viewport = createStableViewport();

  var intro = document.getElementById('workIntro');
  var introEls = intro
    ? [intro.querySelector('.work-heading'), intro.querySelector('.work-subheading')]
    : [];

  var pinOuter = document.getElementById('workPinOuter');
  var slidesWrap = document.getElementById('workSlides');
  var slideEls = slidesWrap ? Array.prototype.slice.call(slidesWrap.querySelectorAll('.work-slide')) : [];
  var markEls = Array.prototype.slice.call(section.querySelectorAll('.work-mark[data-mark]'));

  var slides = slideEls.map(function (slide) {
    var statEls = Array.prototype.slice.call(slide.querySelectorAll('.work-stat-number'));
    return {
      el: slide,
      stats: statEls.map(function (el) {
        return {
          el: el,
          prefix: el.getAttribute('data-prefix') || '',
          suffix: el.getAttribute('data-suffix') || '',
          target: parseFloat(el.getAttribute('data-value')) || 0,
        };
      }),
    };
  });

  var slideCount = slides.length || 1;

  function updateIntro() {
    if (!intro) return;
    var vh = viewport.height;
    var rect = intro.getBoundingClientRect();
    // Triggers off the top edge entering the viewport (not the center), so
    // the heading starts revealing as soon as the section comes into view
    // instead of waiting until it's scrolled halfway up.
    var t = clamp01(1 - rect.top / vh);
    introEls.forEach(function (el, i) {
      if (!el) return;
      var start = i * 0.18;
      var localT = easeInOut(clamp01((t - start) / 0.65));
      el.style.transform = 'translateY(' + (1 - localT) * 100 + '%)';
    });
  }

  // Same crossfade shape used for the beats within a slide, reused here one
  // level up for the slides themselves: first slide starts already visible,
  // last slide never fades back out, middle ones bump in then out.
  function bandOpacity(p, index, total, blend) {
    var segStart = index / total;
    var segEnd = (index + 1) / total;
    var fadeIn = index === 0 ? 1 : smoothstep(segStart - blend, segStart + blend, p);
    var fadeOut = index === total - 1 ? 1 : 1 - smoothstep(segEnd - blend, segEnd + blend, p);
    return fadeIn * fadeOut;
  }

  function getPinProgress() {
    if (!pinOuter) return 0;
    var rect = pinOuter.getBoundingClientRect();
    var total = pinOuter.offsetHeight - viewport.height;
    return total > 0 ? clamp01(-rect.top / total) : 0;
  }

  function updatePin() {
    if (!pinOuter) return;
    var p = getPinProgress();
    var activeIndex = Math.min(slideCount - 1, Math.floor(p * slideCount));

    slides.forEach(function (slide, si) {
      // 0.06 (was 0.025): each crossfade used to complete in ~2.5% of the
      // whole 300vh pin (~7.5vh) — an almost instant snap sandwiched between
      // a ~92.5vh hold where nothing moved, which read as "stuck, then
      // sudden" next to the hero pin's continuously eased reveals. Widened
      // so the crossfade itself takes a visible, proportionate share of the
      // scroll instead of feeling like a jump-cut.
      var slideO = bandOpacity(p, si, slideCount, 0.06);
      slide.el.style.opacity = String(slideO);
      slide.el.style.filter = 'blur(' + (1 - slideO) * 5 + 'px)';
      slide.el.style.pointerEvents = si === activeIndex ? 'auto' : 'none';

      // Stats count up together as this slide settles into view — all 3
      // beats (challenge/action/result) are already visible together (see
      // .work-beats in work.css), so there's no more "result beat's own
      // turn" to wait for; slideO itself (how faded-in this card is) is
      // the only progress signal left to drive them from.
      var statsP = easeInOut(clamp01((slideO - 0.4) / 0.6));
      var step = slide.stats.length ? 1 / slide.stats.length : 1;
      slide.stats.forEach(function (stat, i2) {
        var raw = clamp01((statsP - i2 * step * 0.4) / (1 - i2 * step * 0.4));
        stat.el.textContent = stat.prefix + Math.round(stat.target * raw) + stat.suffix;
      });
    });

    // Deck shuffle: active mark to the front, the next one back to mid, the
    // one after that further back — a fixed 3-slot cycle since there are
    // exactly 3 case studies.
    markEls.forEach(function (mark) {
      var mi = parseInt(mark.getAttribute('data-mark'), 10) || 0;
      var offset = (mi - activeIndex + slideCount) % slideCount;
      mark.classList.remove('is-front', 'is-mid', 'is-back');
      mark.classList.add(offset === 0 ? 'is-front' : offset === 1 ? 'is-mid' : 'is-back');
    });
  }

  function update() {
    updateIntro();
    updatePin();
  }

  // Phones/small tablets: scale the whole case-study block down whenever it
  // would still be taller than the screen (see the max-width: 900px block at
  // the end of work.css). Measured from the row's own layout height (a CSS
  // transform never changes offsetHeight), so it is exact for every language
  // and device; capped at 0.68 so text never gets unreadably small.
  var fitPin = document.querySelector('.work-pin');
  var fitRow = fitPin ? fitPin.querySelector('.work-pin-row') : null;
  function fitWorkRow() {
    if (!fitPin || !fitRow) return;
    fitRow.style.setProperty('--work-fit', '1');
    if (!window.matchMedia('(max-width: 900px)').matches) return;
    var avail = fitPin.clientHeight - parseFloat(getComputedStyle(fitPin).paddingTop) - 14;
    var natural = fitRow.offsetHeight;
    var k = natural > avail ? Math.max(0.68, avail / natural) : 1;
    fitRow.style.setProperty('--work-fit', String(k));
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

  getScrollRoot().addEventListener('scroll', onScroll, { passive: true });
  getScrollRoot().addEventListener('touchmove', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    fitWorkRow();
    update();
  });
  window.addEventListener('load', function () {
    fitWorkRow();
    update();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWorkRow);

  // Client logo wall: a plain scroll-into-view reveal, not tied to the
  // pinned timeline above — each tile's own --i (set inline in the HTML)
  // staggers its transition-delay in CSS.
  var logoWall = document.querySelector('.work-logos');
  if (logoWall && 'IntersectionObserver' in window) {
    var wallObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          logoWall.classList.toggle('is-visible', entry.isIntersecting);
        });
      },
      { threshold: 0.15 }
    );
    wallObserver.observe(logoWall);
  } else if (logoWall) {
    logoWall.classList.add('is-visible');
  }
  fitWorkRow();
  update();
}
