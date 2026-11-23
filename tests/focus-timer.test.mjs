import assert from 'node:assert/strict';
import { createFocusTimer } from '../modules/focus-timer.mjs';

let passed = 0;
function check(name, run) {
  run();
  passed++;
  console.log(`PASS ${name}`);
}
function fixture() {
  let time = 0;
  const timer = createFocusTimer({ now: () => time });
  return { timer, advance: ms => { time += ms; }, setTime: ms => { time = ms; } };
}

check('initial state is inert and has no history', () => {
  const { timer } = fixture();
  assert.deepEqual(timer.getState(), {
    phase: 'idle', durationMs: 0, elapsedMs: 0, remainingMs: 0, topic: ''
  });
  assert.equal('history' in timer, false);
});
check('starting requires a bounded whole-minute duration', () => {
  for (const durationMinutes of [undefined, 0, -1, 1.5, 181, NaN, '25']) {
    const { timer } = fixture();
    assert.throws(() => timer.start({ durationMinutes }), /invalid-duration/);
    assert.equal(timer.getState().phase, 'idle');
  }
  assert.equal(fixture().timer.start({ durationMinutes: 180 }).durationMs, 10_800_000);
});
check('optional topic is trimmed and control characters are rejected', () => {
  const { timer } = fixture();
  for (const topic of [7, 'bad\nline']) {
    assert.throws(() => timer.start({ durationMinutes: 1, topic }), /invalid-topic/);
  }
  assert.throws(() => timer.start({ durationMinutes: 1, topic: 'x'.repeat(81) }), /topic-too-long/);
  assert.equal(timer.start({ durationMinutes: 1, topic: '  Okuma  ' }).topic, 'Okuma');
});
check('running time counts down and prevents a duplicate start', () => {
  const f = fixture();
  f.timer.start({ durationMinutes: 2 });
  f.advance(30_000);
  assert.equal(f.timer.getState().remainingMs, 90_000);
  assert.throws(() => f.timer.start({ durationMinutes: 1 }), /session-active/);
});
check('pause excludes waiting time and resume continues', () => {
  const f = fixture();
  f.timer.start({ durationMinutes: 2 });
  f.advance(40_000);
  assert.equal(f.timer.pause().elapsedMs, 40_000);
  f.advance(600_000);
  assert.equal(f.timer.getState().remainingMs, 80_000);
  f.timer.resume();
  f.advance(20_000);
  assert.equal(f.timer.getState().elapsedMs, 60_000);
});
check('background return caps elapsed time and never records completion', () => {
  const f = fixture();
  f.timer.start({ durationMinutes: 1 });
  f.advance(3_600_000);
  assert.deepEqual([f.timer.getState().phase, f.timer.getState().remainingMs], ['elapsed', 0]);
  assert.equal(f.timer.getState().elapsedMs, 60_000);
  assert.throws(() => f.timer.resume(), /not-paused/);
});
check('backwards monotonic reading cannot increase remaining time', () => {
  const f = fixture();
  f.timer.start({ durationMinutes: 1 });
  f.setTime(30_000);
  assert.equal(f.timer.getState().remainingMs, 30_000);
  f.setTime(1_000);
  assert.equal(f.timer.getState().remainingMs, 30_000);
});
check('wall clock changes do not affect the monotonic timer', () => {
  const f = fixture();
  f.timer.start({ durationMinutes: 1 });
  const original = Date.now;
  try {
    Date.now = () => original() + 86_400_000;
    f.advance(10_000);
    assert.equal(f.timer.getState().remainingMs, 50_000);
  } finally {
    Date.now = original;
  }
});
check('finish is explicit and does not save a record', () => {
  const f = fixture();
  f.timer.start({ durationMinutes: 1, topic: 'Kitap' });
  f.advance(10_000);
  assert.deepEqual([f.timer.finish().phase, f.timer.getState().elapsedMs], ['finished', 10_000]);
  assert.equal('save' in f.timer, false);
  assert.throws(() => f.timer.finish(), /no-active-session/);
});
check('completed session must be finished before another starts', () => {
  const f = fixture();
  f.timer.start({ durationMinutes: 1 });
  f.advance(60_000);
  assert.equal(f.timer.getState().phase, 'elapsed');
  assert.throws(() => f.timer.start({ durationMinutes: 1 }), /session-active/);
  f.timer.finish();
  assert.equal(f.timer.start({ durationMinutes: 2 }).remainingMs, 120_000);
});
check('invalid clock values and actions fail without changing phase', () => {
  assert.throws(() => createFocusTimer({ now: 3 }), /invalid-clock/);
  const timer = createFocusTimer({ now: () => Infinity });
  assert.throws(() => timer.start({ durationMinutes: 1 }), /invalid-clock-value/);
  assert.equal(timer.getState().phase, 'idle');
  const { timer: idle } = fixture();
  assert.throws(() => idle.pause(), /not-running/);
  assert.throws(() => idle.resume(), /not-paused/);
});
check('snapshots and public methods cannot be mutated by callers', () => {
  const { timer } = fixture();
  const state = timer.start({ durationMinutes: 1 });
  assert.throws(() => { state.phase = 'finished'; }, TypeError);
  assert.throws(() => { timer.start = () => {}; }, TypeError);
  assert.equal(timer.getState().phase, 'running');
});

console.log(`focus-timer: ${passed}/${passed} PASS`);
