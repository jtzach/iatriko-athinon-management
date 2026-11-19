(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CeoPlayerCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createPlayer(scenes) {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new TypeError('The player needs at least one scene.');
    }
    // Keep timing independent of later content or DOM changes.
    const timings = scenes.map(function (scene) {
      if (!scene || typeof scene.seconds !== 'number' ||
          !Number.isFinite(scene.seconds) || scene.seconds <= 0) {
        throw new TypeError('Every scene needs a finite, positive duration.');
      }
      const plannedMs = scene.seconds * 1000;
      if (!Number.isFinite(plannedMs)) throw new TypeError('Scene duration is too large.');
      return { plannedMs: plannedMs, frozen: scene.pauseAtFinding === true };
    });
    const pauseSlides = timings.flatMap(function (scene, index) { return scene.frozen ? [index + 1] : []; });
    const metadata = Object.freeze({
      totalScenes: timings.length,
      plannedDurationMs: timings.reduce(function (sum, scene) { return sum + scene.plannedMs; }, 0),
      autoplayDurationMs: timings.reduce(function (sum, scene) { return sum + (scene.frozen ? 0 : scene.plannedMs); }, 0),
      manualStops: pauseSlides.length,
      pauseSlides: Object.freeze(pauseSlides)
    });
    let index = -1;
    let phase = 'intro';
    let elapsedMs = 0;

    function duration() { return index < 0 || timings[index].frozen ? 0 : timings[index].plannedMs; }
    function getState() {
      const durationMs = duration();
      return { index: index, phase: phase, elapsedMs: elapsedMs,
        durationMs: durationMs, remainingMs: Math.max(0, durationMs - elapsedMs) };
    }
    function goTo(target, options) {
      if (!Number.isInteger(target)) return getState();
      index = Math.max(0, Math.min(timings.length - 1, target));
      elapsedMs = 0;
      phase = timings[index].frozen ? 'frozen' : options && options.autoplay === true ? 'playing' : 'paused';
      return getState();
    }
    function start() { return goTo(0, { autoplay: true }); }
    function restart() { index = -1; phase = 'intro'; elapsedMs = 0; return getState(); }
    function next() {
      if (index < 0) return start();
      if (index === timings.length - 1) {
        elapsedMs = duration();
        phase = 'ended';
        return getState();
      }
      return goTo(index + 1, { autoplay: true });
    }
    function previous() { return index < 0 ? getState() : goTo(index - 1); }
    function togglePause() {
      if (phase === 'playing') phase = 'paused';
      else if (phase === 'paused') phase = 'playing';
      return getState();
    }
    function pause() { if (phase === 'playing') phase = 'paused'; return getState(); }
    function advanceBy(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0 || phase !== 'playing') {
        return getState();
      }
      let remaining = ms;
      while (remaining > 0 && phase === 'playing') {
        const consumed = Math.min(remaining, duration() - elapsedMs);
        elapsedMs += consumed;
        remaining -= consumed;
        if (elapsedMs >= duration()) next();
      }
      // Any surplus time is discarded when a manual stop or the end is reached.
      return getState();
    }

    return Object.freeze({ metadata: metadata, getState: getState, start: start,
      next: next, previous: previous, goTo: goTo, togglePause: togglePause,
      pause: pause, restart: restart, advanceBy: advanceBy });
  }
  return Object.freeze({ createPlayer: createPlayer });
});
