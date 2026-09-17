import { initScrollStory } from './modules/scroll-story.js';
import { initServicesStack } from './modules/services-stack.js';
import { initWorkStories } from './modules/work-stories.js';
import { initHeroIntroReveal } from './modules/hero-intro-reveal.js';
import { initPartnersReveal } from './modules/partners-reveal.js';
import { initClosingReveal } from './modules/closing-reveal.js';
import { initNavToggle } from './modules/nav-toggle.js';
import { getScrollRoot } from './utils/scroll-root.js';
import { initThemeColorSync } from './utils/theme-color.js';

var scrollRoot = getScrollRoot();

// #scrollRoot is a real scrollable element, not the document — the browser
// can still remember/restore ITS scrollTop across a reload or back/forward
// the same way it used to for window, and a raw restored value can land
// anywhere inside the hero's own giant pinned sequence (e.g. deep in the
// values filmstrip's full-bleed photo) instead of at its start. Forcing it
// back to 0 on every load/bfcache-show (skipped only for a real deep link
// like #services) makes every open of the page start from the actual top,
// same as a first-ever visit.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.addEventListener('pageshow', function () {
  if (!window.location.hash && scrollRoot) {
    scrollRoot.scrollTop = 0;
  }
});

// Plain <a href="#id"> jumps into a REAL in-flow section (the header logo's
// #hero, the nav's #services/#work) still need to move #scrollRoot, not
// html/body (locked, see reset.css) — scrollIntoView() already walks up to
// the nearest ancestor that can actually scroll, so it naturally lands on
// #scrollRoot with no extra math needed. #about and #wipePanel are
// excluded: those two live inside the hero's shared pin as absolutely-
// positioned layers with no real element height of their own to jump to,
// so scroll-story.js already gives them their own specific handler
// (scrollToSectionProgress) instead.
Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (link) {
  var hash = link.getAttribute('href');
  // Skip bare "#" (the CTA/coffee buttons use it as a plain JS-hook
  // placeholder, not a real anchor — document.querySelector('#') throws)
  // and the two hero-pin phases scroll-story.js already handles itself.
  if (hash.length < 2 || hash === '#about' || hash === '#wipePanel') return;
  var target = document.querySelector(hash);
  if (!target) return;
  link.addEventListener('click', function (e) {
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Hero/coffee-man/office videos each have a desktop and a phone version
// (data-src-desktop/data-src-mobile — see index.html/en/index.html), with
// NO <source> written in the HTML at all. That's deliberate: a <video>'s
// own <source media="..."> is what every earlier version of this used, but
// it's genuinely unreliable across mobile browsers in a way <picture>'s
// identical-looking media attribute isn't — some phones were fetching (and
// sometimes playing) the desktop clip instead of, or as well as, the phone
// one, inconsistently between reloads on the same device. The only way to
// guarantee a device never even requests the other one's video is to never
// put its URL in the DOM in the first place: this one-time check decides
// the device, then injects exactly one <source> — so the wrong file is
// never even a possibility, not just "unlikely". The poster swap is the
// exact same decision, reused, so the still frame shown before playback
// starts also always matches whichever clip actually got picked.
var isMobileDevice = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);

Array.prototype.forEach.call(document.querySelectorAll('video[data-src-desktop]'), function (video) {
  var src = isMobileDevice ? video.getAttribute('data-src-mobile') : video.getAttribute('data-src-desktop');
  var source = document.createElement('source');
  source.src = src;
  source.type = 'video/mp4';
  video.appendChild(source);
  video.load();
});

if (isMobileDevice) {
  Array.prototype.forEach.call(document.querySelectorAll('video[data-poster-mobile]'), function (video) {
    video.setAttribute('poster', video.getAttribute('data-poster-mobile'));
  });
}

initHeroIntroReveal();
initThemeColorSync();
initNavToggle();
initScrollStory();
initServicesStack();
initWorkStories();
initPartnersReveal();
initClosingReveal();
