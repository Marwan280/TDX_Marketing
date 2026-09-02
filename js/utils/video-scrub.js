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
export function createVideoScrubber(video, options) {
  var minDelta = (options && options.minDelta) || 1 / 30;
  var seekTimeoutMs = (options && options.seekTimeoutMs) || 300;
  var pending = false;
  var timeoutId = null;
  var latestTarget = null;

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

  // Call with a target time (seconds) on every scroll tick — internally
  // no-ops while a seek is still pending, so it's always safe to call
  // often and let this decide when a seek is actually worth issuing.
  return function updateScrub(time) {
    latestTarget = time;
    if (!pending) attemptSeek();
  };
}
