import { clamp01, easeInOut, easeOutBack, smoothstep } from '../utils/easing.js';
import { createVideoScrubber } from '../utils/video-scrub.js';
import { createStableViewport } from '../utils/stable-viewport.js';
import { getScrollRoot } from '../utils/scroll-root.js';
import { attemptAutoplay } from '../utils/autoplay.js';

/**
 * Drives the single continuous pinned scroll sequence: hero intro -> TDX logo
 * grows in at center -> coffee-break copy -> zoom into the "about" story ->
 * wipe into the process section's intro. All of it shares ONE pin (see
 * .hero-pin in css/sections/hero.css), so every phase's progress fraction is
 * computed from the same scroll range and this stays one module.
 */
export function initScrollStory() {
  // See js/utils/stable-viewport.js — every getSectionProgress()-style
  // fraction below is computed against this instead of window.innerHeight
  // directly, so a mobile address-bar hide/show mid-scroll can't move the
  // goalposts on the whole pin's phase math.
  var viewport = createStableViewport();
  var scrollRoot = getScrollRoot();
  var siteHeader = document.querySelector('.site-header');
  var hero = document.getElementById('hero');
  var heroMedia = hero.querySelector('.hero-media');
  var heroVideo = document.getElementById('heroVideo');
  var coffeeManVideo = document.getElementById('coffeeManVideo');
  var heroCoffeeOverlay = document.getElementById('heroCoffeeOverlay');
  var heroBadge = hero.querySelector('.hero-badge');
  var introBlock = document.getElementById('introBlock');
  var finalRow = document.getElementById('finalRow');
  var finalAr = finalRow.querySelector('.final-ar');
  var ctaBtn = document.getElementById('ctaBtn');
  var tdxWrap = document.getElementById('tdxWrap');
  var tdxLogoLight = document.getElementById('tdxLogoLight');
  var tdxLogoColor = document.getElementById('tdxLogoColor');
  var logoStartDelta = { x: 0, y: 0 };

  var heroCoffeeText = document.getElementById('heroCoffeeText');
  var coffeeBtn = heroCoffeeText ? heroCoffeeText.querySelector('.coffee-btn') : null;
  var heroCoffeeEls = heroCoffeeText
    ? [heroCoffeeText.querySelector('.coffee-title'), heroCoffeeText.querySelector('.coffee-subtitle'), coffeeBtn]
    : [];

  var wipePanel = document.getElementById('wipePanel');
  var wipeCards = wipePanel ? Array.prototype.slice.call(wipePanel.querySelectorAll('.process-card')) : [];
  var isRTL = document.documentElement.dir === 'rtl';
  var cardsFinalized = false;

  var valuesPanel = document.getElementById('valuesPanel');
  var valuesTrack = document.getElementById('valuesTrack');
  var valuesStrip = document.getElementById('valuesStrip');
  var valueCards = valuesStrip ? Array.prototype.slice.call(valuesStrip.querySelectorAll('.value-card')) : [];
  var valuesEyebrow = valuesPanel ? valuesPanel.querySelector('.values-eyebrow') : null;
  var valuesHeadingEl = valuesPanel ? valuesPanel.querySelector('.values-heading') : null;
  // Both lines split into one word each, in reading order, so card 1's
  // entrance can blur them one at a time as it slides in (see updateValues()).
  var valuesHeadingWords = [].concat(wrapWords(valuesEyebrow), wrapWords(valuesHeadingEl));

  var trustPanel = document.getElementById('trustPanel');
  var trustHeadingEl = trustPanel ? trustPanel.querySelector('.trust-heading') : null;
  var trustSubheadingEl = trustPanel ? trustPanel.querySelector('.trust-subheading') : null;
  var trustStats = document.getElementById('trustStats');
  var trustStatEls = trustStats ? Array.prototype.slice.call(trustStats.querySelectorAll('.trust-stat')) : [];
  var trustStatRefs = trustStatEls.map(function (el) {
    var numberEl = el.querySelector('.trust-stat-number');
    return {
      el: el,
      numberEl: numberEl,
      target: numberEl ? parseFloat(numberEl.getAttribute('data-value')) || 0 : 0,
      suffix: numberEl ? numberEl.getAttribute('data-suffix') || '' : '',
    };
  });

  var storySection = document.getElementById('about');
  var zoomFrame = document.getElementById('zoomFrame');
  var officeVideo = document.getElementById('officeVideo');
  var aboutOverlay = document.getElementById('aboutOverlay');
  var aboutKicker = document.getElementById('aboutKicker');
  var aboutGroups = storySection
    ? [
        {
          lines: Array.prototype.slice.call(
            document.getElementById('aboutGroupRight').querySelectorAll('.about-line')
          ),
        },
        {
          lines: Array.prototype.slice.call(
            document.getElementById('aboutGroupLeft').querySelectorAll('.about-line')
          ),
        },
      ]
    : [];

  // Hero phases (as fractions of the whole pinned scroll range). Every
  // fraction from HEADER_SHOW_THRESHOLD through TDX_FADE_END is pinned to
  // the EXACT same real scroll distance (vh) it always was, now re-expressed
  // against HERO_SCROLL_VH=280 instead of the old 325 (old*325/280) — see
  // the note below TDX_FADE_END for why that total shrank.
  // Header appears as the curtain starts lifting away from the opening photo
  // (matches SHRINK_START below) — that's the first visual cue of leaving the
  // opening shot, rather than waiting for the whole intro cinematic to finish.
  var HEADER_SHOW_THRESHOLD = 0.416;
  var INTRO_END = 0.1337;
  // The instant "The Destinations Experts" is gone, the real logo takes its
  // place — small, faint and roughly where the headline sat — then grows,
  // strengthens to full white and glides to dead-center all together, ending
  // at rest exactly where it stays for the remainder of the hero.
  var LOGO_START = INTRO_END;
  var LOGO_END = 0.312;
  var LOGO_SCALE_START = 0.32;
  var FINAL_START = 0.26;
  var FINAL_END = 0.3863;
  var TEXT_OUT_START = 0.4011;
  var TEXT_OUT_END = 0.4234;
  var SHRINK_START = 0.416;
  var SHRINK_END = 0.6686;
  // Fade starts late and finishes just before the coffee video/text take
  // over — same real scroll distance as always, just re-expressed against
  // the smaller 280vh total (see below).
  var TDX_FADE_START = 0.6314;
  var TDX_FADE_END = 0.7057;
  // Between TDX_FADE_END and COFFEE_TEXT_START nothing scroll-linked
  // actually changes — the coffee-man video plays on its own timeline
  // (startCoffeeVideo(), triggered once, not scrubbed), not tied to scroll
  // position at all. That gap used to be 0.196 of HERO_SCROLL_VH (~64vh):
  // real scroll input the user had to provide with zero visible feedback in
  // return, which is exactly what read as "stuck/heavy" here. Narrowed to a
  // ~20vh beat (just enough for the coffee-man to visibly settle before his
  // text pops up) and HERO_SCROLL_VH cut from 325 to 280 to actually remove
  // that scroll distance rather than just handing it to the next phase —
  // every fraction above was rescaled to keep its own real vh exactly what
  // it was before, and COFFEE_TEXT's own span below is preserved too
  // (~62vh, was ~64vh) — only the dead gap between them got smaller.
  var COFFEE_TEXT_START = 0.7771;
  // The coffee text/button reveal itself is still scroll-driven — only the
  // video's own playback (see initCoffeeVideo() below) no longer is.
  var COFFEE_TEXT_END = 1;

  // Hero, story and the wipe-to-process handoff all share ONE continuous pin.
  // These vh weights split that single scroll range between the phases below,
  // so each keeps an absolute vh-length independent of how many others exist.
  // HERO_SCROLL_VH is 325 (was 175, then 260 for a slower letter reveal, now
  // +65 more for the coffee-man video's own scrub window — see the fraction
  // rescale comment above).
  var HERO_SCROLL_VH = 280;
  // Was 320 — nearly as long as the whole multi-beat HERO phase above (intro
  // fade + logo grow + welcome text + curtain lift + coffee video + text
  // reveal, 7+ beats) despite covering far less: one photo zoom-in, one
  // overlay fade, then the about text. That mismatch is what made this
  // specific phase feel like it dragged on forever relative to everything
  // around it — cut down to sit close to WIPE/VALUES/TRUST below so the
  // whole pinned sequence advances at a consistent rate. All of this
  // phase's internal beats (ZOOM_GROW_END, OVERLAY_END, the text-line
  // stagger) are fractions of this number, so they all speed up together,
  // proportionally — nothing about their relative timing changed.
  var STORY_SCROLL_VH = 230;
  var WIPE_SCROLL_VH = 200;
  var VALUES_SCROLL_VH = 200;
  var TRUST_SCROLL_VH = 220;
  var TOTAL_SCROLL_VH = HERO_SCROLL_VH + STORY_SCROLL_VH + WIPE_SCROLL_VH + VALUES_SCROLL_VH + TRUST_SCROLL_VH;
  var HERO_FRACTION = HERO_SCROLL_VH / TOTAL_SCROLL_VH;
  var STORY_FRACTION = STORY_SCROLL_VH / TOTAL_SCROLL_VH;
  var WIPE_FRACTION = WIPE_SCROLL_VH / TOTAL_SCROLL_VH;
  var VALUES_FRACTION = VALUES_SCROLL_VH / TOTAL_SCROLL_VH;
  var TRUST_FRACTION = TRUST_SCROLL_VH / TOTAL_SCROLL_VH;

  // Story phases (grow to fullscreen -> about text). No hold: growth starts on the
  // very next scroll tick after the coffee text/thumbnail are fully shown.
  var ZOOM_HOLD_END = 0;
  var ZOOM_GROW_END = 0.16;
  var OVERLAY_END = 0.26;

  function measure() {
    if (tdxWrap && introBlock) {
      tdxWrap.style.transform = 'none';
      var tdxRect = tdxWrap.getBoundingClientRect();
      var tdxCx = tdxRect.left + tdxRect.width / 2;
      var tdxCy = tdxRect.top + tdxRect.height / 2;

      var introRect = introBlock.getBoundingClientRect();
      var introCx = introRect.left + introRect.width / 2;
      var introCy = introRect.top + introRect.height / 2;

      // tdxWrap already rests dead-center (see .final-wrap), so the offset
      // needed to make it START at the old headline's spot is simply the
      // vector from tdxWrap's own resting center to the headline's center.
      logoStartDelta.x = introCx - tdxCx;
      logoStartDelta.y = introCy - tdxCy;
    }
  }

  // Hero video: plays on its own (autoplay + loop, see the `loop` attribute
  // in the HTML), independent of scroll — no longer scrubbed frame-by-frame
  // against scroll position the way the coffee-man/office videos still are.
  var reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initHeroVideo() {
    // Reduced motion: leave the video on its poster frame, untouched — same
    // "skip the motion" treatment the rest of the site already gives
    // .intro-letter/.partners-track.
    if (!heroVideo || reducedMotion) return;
    // See js/utils/autoplay.js — retries once on first touch/scroll/click if
    // the initial autoplay attempt is blocked, instead of leaving it stuck
    // on the poster frame.
    attemptAutoplay(heroVideo);
  }

  // Coffee-man video: hidden behind .hero-coffee-overlay (mirrors the TDX
  // logo's own opacity every tick below, so they fade out in perfect
  // lockstep) — starts playing on its own, independent of scroll, the
  // instant the TDX logo has fully faded out (scrolled crosses
  // TDX_FADE_END, see the one-shot trigger in update() below), then runs
  // from frame 0 up to the "holding the dallah, looking at camera" frame
  // (COFFEE_VIDEO_TARGET_TIME, picked by eye off the source clip), pausing
  // itself there via the timeupdate listener below. Clicking .coffee-btn
  // then hands it off to native playback (see coffeeVideoReleased below)
  // so it carries on to the actual pour.
  var COFFEE_VIDEO_TARGET_TIME = 8.5;
  var coffeeVideoReleased = false;
  var coffeeVideoStarted = false;

  function initCoffeeVideo() {
    if (!coffeeManVideo || reducedMotion) return;
    coffeeManVideo.addEventListener('timeupdate', function () {
      if (coffeeVideoReleased) return;
      if (coffeeManVideo.currentTime >= COFFEE_VIDEO_TARGET_TIME) {
        coffeeManVideo.pause();
        coffeeManVideo.currentTime = COFFEE_VIDEO_TARGET_TIME;
      }
    });
  }

  function startCoffeeVideo() {
    if (!coffeeManVideo || reducedMotion || coffeeVideoStarted) return;
    coffeeVideoStarted = true;
    attemptAutoplay(coffeeManVideo);
  }

  if (coffeeBtn) {
    coffeeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!coffeeManVideo) return;
      // From here the timeupdate listener above stops re-pausing it at
      // COFFEE_VIDEO_TARGET_TIME (its own guard checks coffeeVideoReleased)
      // — it plays itself out to the real pour. Every click —
      // first or repeated, mid-pour or after it's finished — replays from
      // the same paused frame rather than resuming from wherever it
      // currently is, so the button always shows the same pour from the
      // same start, on demand.
      coffeeVideoReleased = true;
      coffeeManVideo.currentTime = COFFEE_VIDEO_TARGET_TIME;
      coffeeManVideo.play();
    });
  }

  // Splits a text node into one <span class="vh-word"> per word so each can
  // carry its own blur — the words stay in source order (bidi still renders
  // the Arabic correctly), just chunked for independent animation.
  function wrapWords(el) {
    if (!el) return [];
    var text = el.textContent;
    el.textContent = '';
    var words = text.split(/\s+/).filter(Boolean);
    words.forEach(function (word, i) {
      var span = document.createElement('span');
      span.className = 'vh-word';
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return Array.prototype.slice.call(el.querySelectorAll('.vh-word'));
  }

  // Blurs every word together, all at the same rate — no stagger, so the
  // whole sentence reads as one gentle sharpen-to-blur rather than a
  // one-by-one cascade. Opacity fades out in lockstep, reaching 0 exactly
  // as the blur maxes out — otherwise a still-blurred-but-visible ghost of
  // the text would show through the gap between cards once the filmstrip
  // is under way (every gap only ever appears after card 1 has already
  // fully settled, i.e. after t has already reached 1).
  function applyWordBlurIn(words, t, maxBlurPx) {
    var blurPx = t * maxBlurPx;
    var opacity = 1 - t;
    words.forEach(function (word) {
      word.style.filter = 'blur(' + blurPx + 'px)';
      word.style.opacity = String(opacity);
    });
  }

  function getSectionProgress(section) {
    var rect = section.getBoundingClientRect();
    var total = section.offsetHeight - viewport.height;
    if (total <= 0) return 1;
    return clamp01(-rect.top / total);
  }

  function getProgress() {
    return clamp01(getSectionProgress(hero) / HERO_FRACTION);
  }

  function getStoryProgress() {
    return clamp01((getSectionProgress(hero) - HERO_FRACTION) / STORY_FRACTION);
  }

  function getWipeProgress() {
    return clamp01((getSectionProgress(hero) - HERO_FRACTION - STORY_FRACTION) / WIPE_FRACTION);
  }

  function getValuesProgress() {
    return clamp01((getSectionProgress(hero) - HERO_FRACTION - STORY_FRACTION - WIPE_FRACTION) / VALUES_FRACTION);
  }

  function getTrustProgress() {
    return clamp01(
      (getSectionProgress(hero) - HERO_FRACTION - STORY_FRACTION - WIPE_FRACTION - VALUES_FRACTION) / TRUST_FRACTION
    );
  }

  // Office video: plays on its own (autoplay + loop), independent of
  // scroll — same treatment as the hero video now.
  function initOfficeVideo() {
    if (!officeVideo || reducedMotion) return;
    attemptAutoplay(officeVideo);
  }

  function updateStory() {
    if (!storySection) return;
    var p = getStoryProgress();

    // Zoom frame: stays fully hidden through the coffee text and only fades
    // in as it grows to fullscreen — no separate "appear" beat beforehand.
    var zoomP = easeInOut(clamp01((p - ZOOM_HOLD_END) / (ZOOM_GROW_END - ZOOM_HOLD_END)));

    var startWidth = 170;
    var startHeight = 150;
    var startLeft = 52;
    var startTop = 86;
    var startRadius = 16;

    var width = startWidth + (viewport.width - startWidth) * zoomP;
    var height = startHeight + (viewport.height - startHeight) * zoomP;
    var left = startLeft + (50 - startLeft) * zoomP;
    var top = startTop + (50 - startTop) * zoomP;
    var radius = startRadius * (1 - zoomP);

    zoomFrame.style.opacity = String(zoomP);
    zoomFrame.style.width = width + 'px';
    zoomFrame.style.height = height + 'px';
    zoomFrame.style.left = left + '%';
    zoomFrame.style.top = top + '%';
    zoomFrame.style.borderRadius = radius + 'px';

    // Dark overlay fades in once the frame is fullscreen, so the about text reads clearly
    var overlayP = clamp01((p - ZOOM_GROW_END) / (OVERLAY_END - ZOOM_GROW_END));
    aboutOverlay.style.opacity = String(overlayP);

    // About text: kicker + grouped lines, mapped to the remaining scroll range
    var textP = clamp01((p - OVERLAY_END) / (1 - OVERLAY_END));

    var kickerP = easeInOut(clamp01(textP / 0.08));
    aboutKicker.style.opacity = String(kickerP);
    aboutKicker.style.transform = 'translateY(' + ((1 - kickerP) * 20) + 'px)';

    var linesStart = 0.06;
    var linesEnd = 0.92;
    var local = clamp01((textP - linesStart) / (linesEnd - linesStart));
    var groupCount = aboutGroups.length;
    var groupSpan = 1 / groupCount;

    aboutGroups.forEach(function (group, g) {
      var groupStart = g * groupSpan;
      var groupLocal = clamp01((local - groupStart) / groupSpan);

      var fadeIn = smoothstep(0, 0.12, groupLocal);
      var isLast = g === groupCount - 1;
      var fadeOut = isLast ? 1 : 1 - smoothstep(0.88, 1, groupLocal);
      var groupVis = fadeIn * fadeOut;

      var n = group.lines.length;
      var step = 0.78 / n;

      group.lines.forEach(function (line, i) {
        var t = easeInOut(clamp01((groupLocal - i * step) / step));
        line.style.opacity = String(t * groupVis);
        line.style.transform = 'translateY(' + (1 - t) * 22 + 'px)';
      });
    });
  }

  function update() {
    var scrolled = getProgress();

    if (siteHeader) {
      // Header is invisible on the hero itself, fading in (with the blurred
      // gray background) the instant the user starts scrolling at all —
      // deliberately independent of the hero's own phase timing.
      siteHeader.classList.toggle('is-scrolled', scrolled >= HEADER_SHOW_THRESHOLD);
    }

    var introP = easeInOut(clamp01(scrolled / INTRO_END));
    introBlock.style.opacity = String(1 - introP);
    introBlock.style.transform = 'translateY(' + (-introP * 30) + 'px)';

    var finalP = easeInOut(clamp01((scrolled - FINAL_START) / (FINAL_END - FINAL_START)));

    // Outro: the welcome text/badge disappear fast, then the whole photo gets pulled straight up
    // and off the screen like a curtain — shrinking a little as it goes — while the coffee-man
    // rises up from below the screen in the same motion, slower than the curtain, and holds once
    // he arrives. TDX flips from white to black the instant the image's own edge (computed from
    // its real transform, not a guessed number) rises past the center line — then fades away.
    // Once the man is settled, the coffee text and button appear right where they are, still in
    // this same pinned view.
    var textOut = 1 - smoothstep(TEXT_OUT_START, TEXT_OUT_END, scrolled);
    finalAr.style.opacity = String(finalP * textOut);
    finalAr.style.transform = 'translateY(' + ((1 - finalP) * 22) + 'px)';
    ctaBtn.style.opacity = String(finalP * textOut);
    ctaBtn.style.transform = 'translateY(' + ((1 - finalP) * 18) + 'px)';
    if (heroBadge) heroBadge.style.opacity = String(textOut);

    var scale = 1;
    var liftY = 0;
    if (heroMedia) {
      var shrinkP = easeInOut(clamp01((scrolled - SHRINK_START) / (SHRINK_END - SHRINK_START)));
      scale = 1 - shrinkP * 0.3;
      liftY = shrinkP * -102;
      heroMedia.style.transform = 'translateY(' + liftY + 'vh) scale(' + scale + ')';
    }

    if (tdxWrap) {
      // Logo grows small -> large, faint -> full white, and glides from the old
      // headline spot to dead-center — all three happening together, driven by
      // one progress value, so it reads as a single continuous arrival.
      var logoP = easeInOut(clamp01((scrolled - LOGO_START) / (LOGO_END - LOGO_START)));
      var logoScale = LOGO_SCALE_START + (1 - LOGO_SCALE_START) * logoP;
      var lx = logoStartDelta.x * (1 - logoP);
      var ly = logoStartDelta.y * (1 - logoP);
      var tdxFadeP = 1 - smoothstep(TDX_FADE_START, TDX_FADE_END, scrolled);

      tdxWrap.style.transform = 'translate(' + lx + 'px,' + ly + 'px) scale(' + logoScale + ')';
      var tdxOpacity = logoP * tdxFadeP;
      tdxWrap.style.opacity = String(tdxOpacity);
      // Mirrors the logo's own computed opacity exactly (not a separate
      // fade) so the overlay can never drift out of sync with it — see
      // .hero-coffee-overlay in hero.css.
      if (heroCoffeeOverlay) heroCoffeeOverlay.style.opacity = String(tdxOpacity);

      // The logo has fully faded out once scrolled reaches TDX_FADE_END —
      // startCoffeeVideo()'s own coffeeVideoStarted guard makes this a
      // one-shot trigger, not a re-check every tick past that point.
      if (scrolled >= TDX_FADE_END) startCoffeeVideo();

      // Image's own bottom edge in real viewport px. Read directly off
      // heroMedia's own live layout (set just above, same tick) instead of
      // reconstructing it from scale/liftY/viewport.height — that math
      // assumed viewport.height (frozen at load, see stable-viewport.js)
      // always matches the real current viewport, which mobile Safari's own
      // toolbar quirks can throw off enough to visibly desync the reveal
      // from where the image actually is. getBoundingClientRect() is always
      // exactly right regardless of any of that. The color copy is clipped
      // to reveal only below that line — no shadow/halo bleeding from the
      // layer beneath.
      if (tdxLogoColor) {
        var imageBottomPx = heroMedia ? heroMedia.getBoundingClientRect().bottom : 0;
        var colorRect = tdxLogoColor.getBoundingClientRect();
        var revealFromTop = imageBottomPx - colorRect.top;
        var revealPct = colorRect.height > 0 ? clamp01(revealFromTop / colorRect.height) * 100 : 0;
        tdxLogoColor.style.clipPath = revealPct <= 0 ? 'none' : 'inset(' + revealPct + '% 0 0 0)';
        // The white layer's drop-shadow filter isn't bound by its own shape, so
        // without this it keeps casting a soft ghost through/around the color
        // layer even once fully covered — clip it back to match how far the
        // color layer has actually taken over.
        if (tdxLogoLight) {
          tdxLogoLight.style.clipPath = revealPct >= 100 ? 'none' : 'inset(0 0 ' + (100 - revealPct) + '% 0)';
        }
      }
    }

    // Coffee text: appears right after the man settles, staggered, still in the same pinned hero
    var coffeeTextLocal = clamp01((scrolled - COFFEE_TEXT_START) / (COFFEE_TEXT_END - COFFEE_TEXT_START));
    var coffeeCount = heroCoffeeEls.length;
    var coffeeStep = 0.8 / coffeeCount;

    heroCoffeeEls.forEach(function (el, i) {
      if (!el) return;
      var t = easeInOut(clamp01((coffeeTextLocal - i * coffeeStep) / coffeeStep));
      el.style.opacity = String(t);
      el.style.transform = 'translateY(' + (1 - t) * 26 + 'px)';
    });

    // The card itself (including its mobile-only frosted background — see
    // hero.css) has fill of its own before any of its text does, and must
    // fade back out once the zoom-frame below is fullscreen (ZOOM_GROW_END
    // of the story phase) — otherwise it's left sitting there, background
    // and all, opaque forever after, showing through the about/story
    // content above it whenever the zoom-frame's own video hasn't rendered
    // a frame yet.
    if (heroCoffeeText) {
      var coffeeCardIn = easeInOut(coffeeTextLocal);
      var coffeeCardOut = 1 - easeInOut(clamp01(getStoryProgress() / ZOOM_GROW_END));
      var coffeeCardOpacity = coffeeCardIn * coffeeCardOut;
      heroCoffeeText.style.opacity = String(coffeeCardOpacity);
      heroCoffeeText.style.pointerEvents = coffeeCardOpacity > 0.05 ? 'auto' : 'none';
    }

    updateStory();
    updateWipe();
    updateValues();
    updateTrust();
  }

  function updateWipe() {
    if (!wipePanel) return;
    // Wipe starts only once the story phase (about text) is fully done — same
    // pin, so there's no scroll-past gap and nothing gets covered mid-reveal.
    var wipeP = getWipeProgress();
    var reveal = easeInOut(wipeP);
    wipePanel.style.setProperty('--reveal', reveal * 100 + '%');

    // Cards live inside the same wipe panel as the heading, so everything
    // arrives on ONE screen together — no separate scroll segment needed to
    // reach them. Their own fade/slide stagger must follow the SAME order the
    // clip-path sweep uncovers them in, or the two fight each other: the sweep
    // physically reveals the last DOM card (04, at the far edge the wipe grows
    // toward) first in both directions, so the opacity stagger mirrors that —
    // last card first, first card last — instead of plain DOM order.
    var cardsCount = wipeCards.length;
    if (cardsCount) {
      // getSectionProgress() itself is clamp01'd (Math.min), so it lands on an
      // exact 1 once scrolled past — checking wipeP directly can miss by a
      // floating-point hair after the subtract/divide and never finalize.
      if (getSectionProgress(hero) >= 1) {
        // Fully revealed: hand transform back to CSS (:hover lift) instead of
        // pinning it to translateX(0px) on every future scroll tick, which
        // would otherwise fight the hover effect once this pin is long past.
        if (!cardsFinalized) {
          wipeCards.forEach(function (card) {
            card.style.opacity = '';
            card.style.transform = '';
          });
          cardsFinalized = true;
        }
      } else {
        cardsFinalized = false;
        var CARDS_START = 0.3;
        var cardsLocal = clamp01((wipeP - CARDS_START) / (1 - CARDS_START));
        var cardsStep = 0.7 / cardsCount;
        var dir = isRTL ? -1 : 1;
        wipeCards.forEach(function (card, i) {
          var order = cardsCount - 1 - i;
          var t = easeInOut(clamp01((cardsLocal - order * cardsStep) / cardsStep));
          card.style.opacity = String(t);
          card.style.transform = 'translateX(' + dir * (1 - t) * 40 + 'px)';
        });
      }
    }
  }

  function updateValues() {
    if (!valuesPanel) return;
    var valuesP = getValuesProgress();

    // The panel's own curtain sweeps in FAST (done by CURTAIN_END) instead
    // of across the whole phase — the full-bleed filmstrip below needs the
    // entire panel already uncovered before it starts, or its edge-to-edge
    // cards would be clipped by the still-sweeping curtain behind them.
    var CURTAIN_END = 0.3;
    var reveal = easeInOut(clamp01(valuesP / CURTAIN_END));
    valuesPanel.style.setProperty('--reveal', reveal * 100 + '%');

    // Heading is static (sized once in CSS, never touched here) and gets a
    // beat alone on screen while the curtain finishes, before the filmstrip
    // starts sliding over it.
    var cardsCount = valueCards.length;
    if (!valuesStrip || !valuesTrack || !cardsCount) return;

    var FILMSTRIP_START = 0.4;
    var stripP = clamp01((valuesP - FILMSTRIP_START) / (1 - FILMSTRIP_START));

    // Card 1 sits at the strip's own origin; each next card is placed one
    // unit further toward the entry direction (so under RTL mirroring —
    // dir -1 — card 2 sits to card 1's LEFT, ready to be dragged in from
    // there once card 1 has passed). The card is narrower than the track
    // (see CSS), so this is real px math off its own measured width, not
    // the track's — using the track's width here would space the cards
    // too far apart. Static per-card placement, recomputed every tick
    // since it's cheap and this way it self-corrects across resizes too.
    // Computed directly rather than read back from the --values-gap custom
    // property: getPropertyValue() on a custom property returns its literal
    // authored text ("clamp(12px, 1.6vw, 28px)"), not the resolved pixel
    // value the way it would for a real property like gap/margin — so
    // parseFloat() on it silently failed to NaN and the gap was always 0.
    // Mirrors the same clamp(12px, 1.6vw, 28px) CSS uses for mobile.
    var dir = isRTL ? -1 : 1;
    var cardWidth = valueCards[0].getBoundingClientRect().width;
    var gapPx = Math.min(28, Math.max(12, viewport.width * 0.016));
    var unit = cardWidth + gapPx;

    valueCards.forEach(function (card, i) {
      card.style.left = dir * i * unit + 'px';
    });

    // One shared drag, 1:1 with scroll (no easing — it should feel like
    // pulling a physical strip, not an autonomous animation): card 1 starts
    // fully hidden off the real screen edge (the track is full viewport
    // width), travels in to settle CENTERED in the track, then keeps
    // going, dragging card 2 in behind it the same way, through the last
    // card. The card's own size never changes, only how far it travels.
    var trackWidth = valuesTrack.clientWidth;
    var center = (trackWidth - cardWidth) / 2;

    // Card 1's entry covers MORE ground than every later transition — it
    // has to cross its own full width plus `center` to go from fully
    // hidden to settled, while card 2/3 only need the steady `unit` step
    // from their already-visible predecessor. Weighting stripP by each
    // segment's real distance (instead of splitting it evenly per card)
    // keeps the drag speed constant throughout instead of lurching once
    // card 1 arrives — without this, card 1 would still be peeking in at
    // stripP 0, well before the phase is even supposed to have started.
    var entryDistance = cardWidth + center;
    var totalDistance = entryDistance + (cardsCount - 1) * unit;
    var traveled = totalDistance * stripP;

    // hiddenTx: card 1's position at stripP 0 — its trailing edge exactly
    // at the track's own boundary on the entry side (RTL: right edge at 0;
    // LTR mirror: left edge at trackWidth), i.e. just about to appear.
    var hiddenTx = isRTL ? -cardWidth : trackWidth;
    var tx = hiddenTx - dir * traveled;
    valuesStrip.style.transform = 'translateX(' + tx + 'px)';

    // The heading blurs — all words together, not one at a time — over the
    // SAME distance card 1 covers entering: sharp until it starts sliding
    // in, fully blurred by the moment it settles (which is also roughly
    // when it's physically covered the text anyway). Eased rather than
    // linear so it reads as a gentle gradual sharpen-to-blur instead of a
    // fast, mechanical one.
    var blurT = easeInOut(clamp01(traveled / entryDistance));
    applyWordBlurIn(valuesHeadingWords, blurT, 14);
  }

  function updateTrust() {
    if (!trustPanel) return;
    var trustP = getTrustProgress();

    // Iris wipe: a genuinely different reveal shape from the two straight
    // curtains earlier in this same pin (process wipe, values panel) — a
    // circle growing from center instead of a rectangle sweeping in from
    // one edge. Radius is computed in real px (not a --reveal percentage
    // like the others) since it needs the viewport's own diagonal to be
    // sure it reaches every corner.
    var IRIS_END = 0.35;
    var irisT = easeInOut(clamp01(trustP / IRIS_END));
    var maxRadius = Math.hypot(viewport.width, viewport.height) * 0.65;
    trustPanel.style.clipPath = 'circle(' + irisT * maxRadius + 'px at 50% 48%)';

    // Heading, then subheading, each mask-revealed (see .trust-mask in
    // trust.css) sliding up from fully hidden — overlapping the tail of
    // the iris opening so the text is already moving by the time the
    // circle finishes, instead of waiting for a dead beat first.
    var HEADING_START = 0.3;
    var HEADING_END = 0.6;
    var headingT = easeInOut(clamp01((trustP - HEADING_START) / (HEADING_END - HEADING_START)));
    if (trustHeadingEl) trustHeadingEl.style.transform = 'translateY(' + (1 - headingT) * 100 + '%)';

    var SUBHEADING_START = 0.4;
    var SUBHEADING_END = 0.65;
    var subheadingT = easeInOut(clamp01((trustP - SUBHEADING_START) / (SUBHEADING_END - SUBHEADING_START)));
    if (trustSubheadingEl) trustSubheadingEl.style.transform = 'translateY(' + (1 - subheadingT) * 100 + '%)';

    var statsCount = trustStatRefs.length;
    if (!statsCount) return;

    // Each stat tilts/scales in with a slight overshoot ("pop") rather than
    // a plain slide-up, staggered one after another over the phase's
    // remaining stretch. The overshoot (easeOutBack can exceed 1) only
    // drives the visual transform; the counted-up number itself is clamped
    // so it never briefly reads higher than its real target.
    var STATS_START = 0.55;
    var statsLocal = clamp01((trustP - STATS_START) / (1 - STATS_START));
    var step = 1 / statsCount;
    trustStatRefs.forEach(function (ref, i) {
      var raw = clamp01((statsLocal - i * step) / step);
      var popT = easeOutBack(raw);
      ref.el.style.opacity = String(raw);
      ref.el.style.transform =
        'translateY(' + (1 - raw) * 22 + 'px) scale(' + (0.85 + 0.15 * popT) + ') rotate(' + (1 - popT) * -4 + 'deg)';
      if (ref.numberEl) {
        ref.numberEl.textContent = Math.round(ref.target * raw) + ref.suffix;
      }
    });
  }

  // "Let's Grab a Coffee" jumps straight to the coffee-man scene (scrolled
  // === 1, i.e. COFFEE_TEXT_END) instead of making the user scroll the
  // whole intro by hand. It's a computed scrollTo, not a plain #id anchor,
  // because heroCoffeeText lives inside the sticky pin (not laid out at a
  // "real" document position an anchor jump could target) — this reuses the
  // exact same progress math update() reads scroll position through.
  // scroll-behavior: smooth on #scrollRoot (reset.css) animates it for free.
  if (ctaBtn) {
    ctaBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var total = hero.offsetHeight - viewport.height;
      if (total > 0) scrollRoot.scrollTo({ top: HERO_FRACTION * total });
    });
  }

  // Nav links into #about/#wipePanel: both live inside the one shared
  // hero-pin as position: absolute; inset: 0 layers, not real in-flow
  // content, so a plain <a href="#about"> jump has no real element height
  // to scroll to — the browser either doesn't move at all or lands
  // somewhere meaningless. Same fix as the CTA button above: compute the
  // real scrollY for a specific, already-settled point in that phase (text
  // visibly readable for about, cards fully revealed for wipePanel) and
  // scroll there directly instead of relying on the native anchor jump.
  function scrollToSectionProgress(sectionProgress) {
    var total = hero.offsetHeight - viewport.height;
    if (total > 0) scrollRoot.scrollTo({ top: sectionProgress * total });
  }

  var aboutLink = document.querySelector('a[href="#about"]');
  if (aboutLink) {
    aboutLink.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToSectionProgress(HERO_FRACTION + STORY_FRACTION * 0.45);
    });
  }

  var wipeLink = document.querySelector('a[href="#wipePanel"]');
  if (wipeLink) {
    wipeLink.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToSectionProgress(HERO_FRACTION + STORY_FRACTION + WIPE_FRACTION * 0.95);
    });
  }

  initHeroVideo();

  var ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () {
        // try/finally matters here: this whole pin's reveal state (video
        // scrubbing, wipe/values/trust curtains, every phase) only ever
        // updates from this one call. If update() ever threw without the
        // finally, `ticking` would stay true forever and every later scroll
        // event would silently no-op for the rest of the page's life —
        // freezing whatever phase happened to be on screen at that instant,
        // with no error visible to the user.
        try {
          update();
        } finally {
          ticking = false;
        }
      });
    }
  }

  function init() {
    measure();
    update();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 150);
  });

  scrollRoot.addEventListener('scroll', onScroll, { passive: true });
  scrollRoot.addEventListener('touchmove', onScroll, { passive: true });
  window.addEventListener('load', init);
  // Starts once the whole page (not just this script) has finished loading,
  // same as the user asked for — unlike initHeroVideo() above, which starts
  // immediately since that video is the very first visible thing.
  // Only wires up the pause-at-target-time listener — actually starting
  // playback is scroll-triggered, see startCoffeeVideo() in update().
  window.addEventListener('load', initCoffeeVideo);
  window.addEventListener('load', initOfficeVideo);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(init);
  } else {
    init();
  }
}
