// An in-memory timer. It creates no history, notification or cross-module record.
export function createFocusTimer({ now = () => performance.now() } = {}) {
  if (typeof now !== 'function') throw new TypeError('invalid-clock');

  let phase = 'idle';
  let durationMs = 0;
  let topic = '';
  let accruedMs = 0;
  let segmentStartMs = null;
  let lastClockMs = null;

  function clock() {
    const value = now();
    if (!Number.isFinite(value)) throw new TypeError('invalid-clock-value');
    // A bad or replaced clock must not move an active session backwards.
    lastClockMs = Math.max(value, lastClockMs ?? value);
    return lastClockMs;
  }

  function settle() {
    if (phase !== 'running') return;
    const elapsed = accruedMs + Math.max(0, clock() - segmentStartMs);
    if (elapsed >= durationMs) {
      accruedMs = durationMs;
      segmentStartMs = null;
      phase = 'elapsed';
    }
  }

  function getState() {
    settle();
    const elapsedMs = phase === 'running'
      ? Math.min(durationMs, accruedMs + Math.max(0, lastClockMs - segmentStartMs))
      : accruedMs;
    return Object.freeze({
      phase,
      durationMs,
      elapsedMs,
      remainingMs: Math.max(0, durationMs - elapsedMs),
      topic
    });
  }

  function start({ durationMinutes, topic: proposedTopic = '' } = {}) {
    if (phase !== 'idle' && phase !== 'finished') throw new Error('session-active');
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
      throw new RangeError('invalid-duration');
    }
    if (typeof proposedTopic !== 'string' || /[\u0000-\u001f\u007f]/u.test(proposedTopic)) {
      throw new TypeError('invalid-topic');
    }
    const nextTopic = proposedTopic.trim();
    if (nextTopic.length > 80) throw new RangeError('topic-too-long');
    const started = clock();
    durationMs = durationMinutes * 60_000;
    topic = nextTopic;
    accruedMs = 0;
    segmentStartMs = started;
    phase = 'running';
    return getState();
  }

  function pause() {
    settle();
    if (phase !== 'running') throw new Error('not-running');
    accruedMs = Math.min(durationMs, accruedMs + Math.max(0, lastClockMs - segmentStartMs));
    segmentStartMs = null;
    phase = 'paused';
    return getState();
  }

  function resume() {
    if (phase !== 'paused') throw new Error('not-paused');
    segmentStartMs = clock();
    phase = 'running';
    return getState();
  }

  function finish() {
    settle();
    if (phase === 'idle' || phase === 'finished') throw new Error('no-active-session');
    if (phase === 'running') {
      accruedMs = Math.min(durationMs, accruedMs + Math.max(0, lastClockMs - segmentStartMs));
    }
    segmentStartMs = null;
    phase = 'finished';
    return getState();
  }

  return Object.freeze({ start, pause, resume, finish, getState });
}
