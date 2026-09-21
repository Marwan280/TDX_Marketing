import { initScrollStory } from './modules/scroll-story.js';
import { initServicesStack } from './modules/services-stack.js';
import { initWorkStories } from './modules/work-stories.js';
import { initHeroIntroReveal } from './modules/hero-intro-reveal.js';
import { initPartnersReveal } from './modules/partners-reveal.js';
import { initClosingReveal } from './modules/closing-reveal.js';
import { initContactForm } from './modules/contact-form.js';
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

// Which video/poster each device gets (desktop vs phone) is decided by the
// inline script at the end of index.html/en/index.html — before any request
// is made — so the other device's files are never even fetched.

initHeroIntroReveal();
initThemeColorSync();
initNavToggle();
initScrollStory();
initServicesStack();
initWorkStories();
initPartnersReveal();
initClosingReveal();
initContactForm();
