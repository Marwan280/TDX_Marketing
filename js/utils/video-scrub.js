// Robust scroll-scrubbed video seeking, shared by every scroll-driven video
// on the site (hero, coffee-man, office, closing-blinds). Handles two real
// failure modes found testing this:
//
// 1. Issuing a new seek while one is already resolving just queues them up
//    faster than the decoder can drain them — reads as the video lagging
//    behind / stuttering on a fast scroll (seen on Chrome). Fixed by
//    tracking a `pending` flag and skipping new seeks while one's in
//    flight, then re-checking against the LATEST requested time (not the
//    stale one from when the in-flight seek started) once it clears.
// 2. The 'seeked' event that's supposed to clear `pending` doesn't always
//    fire for a closely-spaced re-seek, or a big jump just takes WebKit
//    longer than expected to settle — observed as the video permanently
//    (or for many seconds) freezing partway through a scroll, since
//    nothing cleared `pending` and every later scroll tick's seek got
//    skipped. The setTimeout below is the recovery valve: if `pending`
//    hasn't cleared naturally within seekTimeoutMs, retry against
//    `latestTarget` anyway. `latestTarget` is only ever cleared once
//    video.currentTime has actually landed within minDelta of it — never
//    just because a seek was *issued* — so a timeout retry keeps re-firing
//    the assignment every seekTimeoutMs until it genuinely lands, instead
//    of giving up on the one target it was supposed to be chasing.
// 3. iOS Safari never paints a frame for a `currentTime` seek issued
//    against a video that hasn't actually played yet — every seek lands
//    (currentTime updates, 'seeked' even fires) but the video element
//    itself keeps showing nothing/black, no matter how many scroll ticks
//    come in. This is what every "video doesn't work on my phone" report
//    traced back to. A muted+playsinline video is allowed to autoplay via
//    script with no user gesture, so play() immediately followed by
//    pause() — before any seek is attempted — "primes" WebKit's decoder
//    into a state where later currentTime assignments actually render.
//    One-shot per video, safe to call before metadata has even loaded.
export function createVideoScrubber(video, options) {
  var minDelta = (options && options.minDelta) || 1 / 30;
  var seekTimeoutMs = (options && options.seekTimeoutMs) || 300;
  var pending = false;
  var timeoutId = null;
  var latestTarget = null;
  var primed = false;

  function prime() {
    if (primed) return;
    primed = true;
    var playResult = video.play();
    if (playResult && typeof playResult.then === 'function') {
      playResult
        .then(function () {
          video.pause();
        })
        .catch(function () {
          // Autoplay blocked for some reason (not muted, stricter policy,
          // etc.) — nothing was unlocked, so let a later real interaction
          // (e.g. the coffee-man video's own click-to-play) prime it instead.
          primed = false;
        });
    } else {
      video.pause();
    }
  }

  function attemptSeek() {
    if (!video.duration || latestTarget === null) return;
    if (Math.abs(latestTarget - video.currentTime) < minDelta) {
      latestTarget = null;
      return;
    }
    pending = true;
    video.currentTime = latestTarget;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(onSeekSettled, seekTimeoutMs);
  }

  function onSeekSettled() {
    pending = false;
    clearTimeout(timeoutId);
    timeoutId = null;
    attemptSeek();
  }

  video.addEventListener('seeked', onSeekSettled);

  // Primed as soon as the scrubber exists, not deferred to the first real
  // seek — the very first scroll tick needs a frame to already be visible.
  prime();

  // Call with a target time (seconds) on every scroll tick — internally
  // no-ops while a seek is still pending, so it's always safe to call
  // often and let this decide when a seek is actually worth issuing.
  return function updateScrub(time) {
    latestTarget = time;
    if (!pending) attemptSeek();
  };
}
