// Vollbild auf Tablet/Handy (wie im Zoo-Spiel): beim ersten Antippen automatisch ins Vollbild und auf
// Hochformat festhalten. Der Knopf oben rechts schaltet um; wer ihn zum Verlassen benutzt hat,
// wird nicht bei jedem Tippen wieder ins Vollbild geholt.

const ICON = (d) =>
  `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON_EXPAND = ICON('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>');
const ICON_SHRINK = ICON('<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>');

export function setupFullscreen() {
  window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });

  const root = document.documentElement;
  const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
  const isFull = () => !!(document.fullscreenElement ?? document.webkitFullscreenElement);
  let leftOnPurpose = false;

  // Chrome erlaubt Vollbild erst beim Loslassen des Fingers (touchend)
  const enter = () => {
    if (isFull() || !request || leftOnPurpose) return;
    Promise.resolve(request({ navigationUI: 'hide' }))
      .then(() => screen.orientation?.lock?.('portrait'))
      .catch(() => {});
  };
  if (!request) document.body.classList.add('no-fullscreen'); // z. B. iPhone

  const button = document.getElementById('btn-full');
  const mark = () => {
    button.innerHTML = isFull() ? ICON_SHRINK : ICON_EXPAND;
    button.setAttribute('aria-label', isFull() ? 'Vollbild beenden' : 'Vollbild');
  };
  mark();
  document.addEventListener('fullscreenchange', mark);
  document.addEventListener('webkitfullscreenchange', mark);
  window.addEventListener('touchend', enter);
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isFull()) {
      leftOnPurpose = true;
      (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
    } else {
      leftOnPurpose = false;
      enter();
    }
  });
  // Antippen des Knopfs soll nicht ins Spiel durchgehen
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) {
    button.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }
}
