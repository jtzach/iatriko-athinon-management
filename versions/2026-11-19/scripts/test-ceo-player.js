'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createPlayer } = require('../assets/ceo-player-core.js');
const dataPath = path.join(__dirname, '../data/ceo-presentation.json');
const fixture = [20, 25, 30, 45, 40, 40, 35, 40, 35, 35, 40, 35]
  .map((seconds, i) => ({ seconds, pauseAtFinding: [3, 5, 8].includes(i) }));
// Keep the original timing fixture stable so production content changes do not
// silently redefine the state-machine unit tests.
const player = () => createPlayer(fixture);
let checks = 0;
function check(name, run) {
  run(); checks += 1; console.log('PASS ' + name);
}

check('12 scenes, 420 seconds planned, 300 seconds automatic, exactly three stops', () => {
  assert.deepEqual(player().metadata, { totalScenes: 12, plannedDurationMs: 420000,
    autoplayDurationMs: 300000, manualStops: 3, pauseSlides: [4, 6, 9] });
});
check('Start enters the cover, restart returns to the intro', () => {
  const p = player();
  assert.deepEqual(p.getState(), { index: -1, phase: 'intro', elapsedMs: 0, durationMs: 0, remainingMs: 0 });
  p.start();
  assert.deepEqual(p.getState(), { index: 0, phase: 'playing', elapsedMs: 0, durationMs: 20000, remainingMs: 20000 });
  p.advanceBy(7000); p.restart();
  assert.equal(p.getState().phase, 'intro'); assert.equal(p.getState().index, -1);
  p.start(); assert.equal(p.getState().elapsedMs, 0);
});
check('Automatic playback carries elapsed time into the next ordinary scene', () => {
  const p = player(); p.start(); p.advanceBy(23500);
  assert.deepEqual(p.getState(), { index: 1, phase: 'playing', elapsedMs: 3500, durationMs: 25000, remainingMs: 21500 });
});
check('Playback reaches the first finding at 75 seconds and remains frozen', () => {
  const p = player(); p.start(); p.advanceBy(74999);
  assert.equal(p.getState().index, 2); assert.equal(p.getState().remainingMs, 1);
  p.advanceBy(1);
  assert.deepEqual(p.getState(), { index: 3, phase: 'frozen', elapsedMs: 0, durationMs: 0, remainingMs: 0 });
  p.advanceBy(1e12); p.togglePause(); p.pause();
  assert.equal(p.getState().index, 3); assert.equal(p.getState().phase, 'frozen');
});
check('A large clock advance never skips a finding and leaves no timing debt', () => {
  const p = player(); p.start(); p.advanceBy(1e12);
  assert.equal(p.getState().index, 3);
  p.next(); assert.equal(p.getState().index, 4); assert.equal(p.getState().elapsedMs, 0);
  p.advanceBy(39999); assert.equal(p.getState().index, 4);
  p.advanceBy(1); assert.equal(p.getState().index, 5); assert.equal(p.getState().phase, 'frozen');
  p.next(); p.advanceBy(75000);
  assert.equal(p.getState().index, 8); assert.equal(p.getState().phase, 'frozen');
});
check('The final sequence ends and never automatically restarts', () => {
  const p = player(); p.goTo(8); p.next(); p.advanceBy(109999);
  assert.equal(p.getState().index, 11); assert.equal(p.getState().remainingMs, 1);
  p.advanceBy(1);
  assert.deepEqual(p.getState(), { index: 11, phase: 'ended', elapsedMs: 35000, durationMs: 35000, remainingMs: 0 });
  p.advanceBy(1e12); p.next(); p.togglePause();
  assert.equal(p.getState().index, 11); assert.equal(p.getState().phase, 'ended');
  p.start(); assert.equal(p.getState().index, 0); assert.equal(p.getState().phase, 'playing');
});
check('Pausing preserves elapsed time and resumes from the same point', () => {
  const p = player(); p.start(); p.advanceBy(7500.5); p.pause(); p.advanceBy(1e12);
  assert.equal(p.getState().elapsedMs, 7500.5); assert.equal(p.getState().phase, 'paused');
  p.togglePause(); p.advanceBy(12499.5);
  assert.equal(p.getState().index, 1); assert.equal(p.getState().elapsedMs, 0);
});
check('Previous and chapter jumps pause ordinary scenes but always freeze findings', () => {
  const p = player(); p.goTo(7); assert.equal(p.getState().phase, 'paused');
  p.previous(); assert.equal(p.getState().index, 6); assert.equal(p.getState().phase, 'paused');
  p.previous(); assert.equal(p.getState().index, 5); assert.equal(p.getState().phase, 'frozen');
  p.goTo(8, { autoplay: true }); assert.equal(p.getState().phase, 'frozen');
  p.goTo(10, { autoplay: true }); assert.equal(p.getState().phase, 'playing');
});
check('Integer chapter indexes clamp safely; noninteger indexes do nothing', () => {
  const p = player(); p.goTo(-50); assert.equal(p.getState().index, 0);
  p.goTo(50); assert.equal(p.getState().index, 11);
  const before = p.getState();
  for (const bad of [2.5, NaN, Infinity, -Infinity, '3', null, undefined]) {
    p.goTo(bad); assert.deepEqual(p.getState(), before);
  }
  p.goTo(0); p.previous(); assert.equal(p.getState().index, 0);
});
check('Invalid clock input and clock input outside playing state have no effect', () => {
  const p = player(); p.advanceBy(50000); assert.equal(p.getState().phase, 'intro');
  p.start(); const before = p.getState();
  for (const bad of [0, -1, NaN, Infinity, -Infinity, '50000', null, undefined]) {
    p.advanceBy(bad); assert.deepEqual(p.getState(), before);
  }
  p.goTo(2); p.advanceBy(50000); assert.equal(p.getState().index, 2);
});
check('Callers cannot mutate playback by changing a snapshot or source scene', () => {
  const source = [{ seconds: 3, pauseAtFinding: false }, { seconds: 2, pauseAtFinding: true }];
  const p = createPlayer(source); source[0].seconds = 99; source[1].pauseAtFinding = false;
  p.start(); const snapshot = p.getState(); snapshot.index = 100; snapshot.phase = 'ended';
  p.advanceBy(3000); assert.equal(p.getState().index, 1); assert.equal(p.getState().phase, 'frozen');
});
check('Invalid durations fail at construction instead of creating a zero-duration loop', () => {
  for (const bad of [0, -1, NaN, Infinity, '20', null, undefined, Number.MAX_VALUE]) {
    assert.throws(() => createPlayer([{ seconds: bad }]), TypeError);
  }
  assert.throws(() => createPlayer([]), TypeError);
});
check('Browser UMD export works without CommonJS or external dependencies', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/ceo-player-core.js'), 'utf8'), context);
  assert.equal(typeof context.CeoPlayerCore.createPlayer, 'function');
  const p = context.CeoPlayerCore.createPlayer(fixture);
  p.start(); p.advanceBy(75000); assert.equal(p.getState().phase, 'frozen');
});
check('Published fifteen-scene flow has six automatic minutes and three manual stops', () => {
  const actual = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const p = createPlayer(actual.scenes);
  assert.deepEqual(p.metadata, { totalScenes: 15, plannedDurationMs: 480000,
    autoplayDurationMs: 360000, manualStops: 3, pauseSlides: [5, 7, 11] });
  assert.deepEqual(actual.pauseSlides, p.metadata.pauseSlides);
  p.start();
  const stops = [];
  let automaticMs = 0;
  while (p.getState().phase !== 'ended') {
    const state = p.getState();
    if (state.phase === 'frozen') {
      stops.push(state.index + 1);
      const before = p.getState();
      p.advanceBy(1e12); p.togglePause(); p.pause();
      assert.deepEqual(p.getState(), before, 'A published finding requires explicit continuation');
      p.next();
      assert.equal(p.getState().elapsedMs, 0, 'No timing debt after a manual stop');
    } else {
      assert.equal(state.phase, 'playing');
      automaticMs += state.remainingMs;
      p.advanceBy(state.remainingMs);
    }
  }
  assert.deepEqual(stops, [5, 7, 11]);
  assert.equal(automaticMs, 360000);
  assert.equal(p.getState().index, 14);
  const ended = p.getState(); p.advanceBy(1e12); p.next();
  assert.deepEqual(p.getState(), ended, 'The published presentation remains ended');
});
check('Large clock advances cannot skip any of the three published findings', () => {
  const actual = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const p = createPlayer(actual.scenes); p.start();
  for (const slide of [5, 7, 11]) {
    p.advanceBy(1e12);
    assert.equal(p.getState().index, slide - 1);
    assert.equal(p.getState().phase, 'frozen');
    p.next();
  }
  p.advanceBy(1e12);
  assert.equal(p.getState().index, 14); assert.equal(p.getState().phase, 'ended');
});
console.log('CEO player: ' + checks + ' checks passed. Stable twelve-scene unit fixture and actual fifteen-scene integration.');
