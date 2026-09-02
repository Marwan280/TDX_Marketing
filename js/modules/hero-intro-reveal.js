/**
 * Splits the hero title into one <span> per letter so hero.css's
 * intro-letter-in keyframes can stagger them on load — a premium reveal
 * where letters alternate landing from above and below the title's resting
 * line, one at a time, converging into place as their color deepens. Runs
 * once, independent of scroll-story.js's own opacity/transform on the
 * parent .intro-block.
 *
 * Each word's letters are wrapped in their own inline-block .intro-word —
 * without it, adjacent letter-spans have no whitespace between them, but
 * browsers still treat every inline-level box boundary as a line-break
 * opportunity, so on a narrow (mobile) viewport the title could wrap
 * mid-word ("Ex-perts"). An inline-block is one atomic box from the
 * outside, so the line can only break between words, same as plain text.
 */
export function initHeroIntroReveal() {
  var el = document.getElementById('introTitleLetters');
  if (!el) return;

  var text = el.textContent;
  el.textContent = '';

  var i = 0;
  var wordEl = document.createElement('span');
  wordEl.className = 'intro-word';
  el.appendChild(wordEl);

  text.split('').forEach(function (char) {
    if (char === ' ') {
      var spaceEl = document.createElement('span');
      spaceEl.className = 'intro-letter-space';
      spaceEl.textContent = ' ';
      el.appendChild(spaceEl);
      wordEl = document.createElement('span');
      wordEl.className = 'intro-word';
      el.appendChild(wordEl);
      return;
    }
    var span = document.createElement('span');
    span.className = 'intro-letter';
    span.style.setProperty('--i', i);
    span.style.setProperty('--from-y', (i % 2 === 0 ? '-' : '') + '44px');
    span.textContent = char;
    i += 1;
    wordEl.appendChild(span);
  });
}
