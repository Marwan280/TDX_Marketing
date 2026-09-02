import { clamp01, easeInOut, smoothstep } from '../utils/easing.js';
import { createStableViewport } from '../utils/stable-viewport.js';

/**
 * Section 8 (work / case studies): ONE pinned block (.work-pin) holding all
 * 3 case studies stacked on top of each other — moving between them is a
 * pure crossfade, nothing ever slides vertically. The pin's own scroll
 * range (.work-pin-outer's height) splits into 3 equal thirds, one per
 * case study; each third further splits into 3 beats (challenge -> action
 * -> result), exactly like before, just re-anchored to a shared progress
 * number instead of each card's own rect. The client-mark cluster on the
 * side reshuffles in lockstep: whichever case study is active gets the
 * front slot, the other two recede to mid/back — a small deck of cards.
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
    var beats = Array.prototype.slice.call(slide.querySelectorAll('.work-beat'));
    var dots = Array.prototype.slice.call(slide.querySelectorAll('.work-beat-dot'));
    var statEls = Array.prototype.slice.call(slide.querySelectorAll('.work-stat-number'));
    return {
      el: slide,
      beats: beats,
      dots: dots,
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
      var slideO = bandOpacity(p, si, slideCount, 0.025);
      slide.el.style.opacity = String(slideO);
      slide.el.style.filter = 'blur(' + (1 - slideO) * 5 + 'px)';
      slide.el.style.pointerEvents = si === activeIndex ? 'auto' : 'none';

      // Local progress within this slide's own third, used for its beats —
      // only meaningful while it's the active (or crossfading) slide.
      var localP = clamp01(p * slideCount - si);
      var beatCount = slide.beats.length || 1;

      slide.beats.forEach(function (beatEl, bi) {
        var o = bandOpacity(localP, bi, beatCount, 0.08);
        beatEl.style.opacity = String(o);
        beatEl.style.transform = 'translateY(' + (1 - o) * 16 + 'px)';
        beatEl.style.filter = 'blur(' + (1 - o) * 4 + 'px)';
      });

      var activeBeat = Math.min(beatCount - 1, Math.floor(localP * beatCount));
      slide.dots.forEach(function (dot, di) {
        dot.classList.toggle('is-active', di === activeBeat);
      });

      var lastSeg = (beatCount - 1) / beatCount;
      var statsP = easeInOut(clamp01((localP - lastSeg) / (1 / beatCount)));
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
  update();
}
