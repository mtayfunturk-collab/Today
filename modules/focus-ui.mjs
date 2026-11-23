import { createFocusTimer } from './focus-timer.mjs';

const timer = createFocusTimer();
const root = document;
const get = id => root.getElementById(id);
const minutes = get('focusMinutes');
const topic = get('focusTopic');
const remaining = get('focusRemaining');
const status = get('focusStatus');
const actions = {
  start: get('focusStart'),
  pause: get('focusPause'),
  resume: get('focusResume'),
  finish: get('focusFinish')
};

function render() {
  const state = timer.getState();
  const seconds = Math.ceil(state.remainingMs / 1000);
  remaining.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const labels = { idle: 'Hazır', running: 'Odak sürüyor', paused: 'Duraklatıldı', elapsed: 'Süre doldu', finished: 'Oturum bitti' };
  status.textContent = labels[state.phase];
  minutes.disabled = topic.disabled = !['idle', 'finished'].includes(state.phase);
  actions.start.hidden = !['idle', 'finished'].includes(state.phase);
  actions.pause.hidden = state.phase !== 'running';
  actions.resume.hidden = state.phase !== 'paused';
  actions.finish.hidden = !['running', 'paused', 'elapsed'].includes(state.phase);
}

actions.start.addEventListener('click', () => {
  try {
    timer.start({ durationMinutes: Number(minutes.value), topic: topic.value });
    render();
  } catch {
    status.textContent = '1–180 dakika arasında tam sayı seç.';
    minutes.focus();
  }
});
actions.pause.addEventListener('click', () => { timer.pause(); render(); });
actions.resume.addEventListener('click', () => { timer.resume(); render(); });
actions.finish.addEventListener('click', () => { timer.finish(); render(); });
get('btnFocusBack').addEventListener('click', () => window.TodayRouter?.navigate('modules'));
minutes.addEventListener('input', () => {
  if (timer.getState().phase === 'idle' || timer.getState().phase === 'finished') {
    const count = Math.max(0, Math.min(180, Number(minutes.value) || 0));
    remaining.textContent = `${String(count).padStart(2, '0')}:00`;
  }
});
setInterval(() => {
  if (window.TodayRouter?.getState?.().route === 'focus') render();
}, 1000);
root.addEventListener('visibilitychange', () => {
  if (!root.hidden) render();
});
