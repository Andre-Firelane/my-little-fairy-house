// "Juicy" Feedback: dünne Wrapper um scene.tweens, damit überall dieselben Bewegungen benutzt werden.

export function popIn(scene, target, { from = 0.6, to = 1, duration = 900, delay = 0 } = {}) {
  target.setScale(from);
  return scene.tweens.add({
    targets: target,
    scale: to,
    duration,
    delay,
    ease: 'Elastic.Out',
    easeParams: [1.2, 0.45],
  });
}

// kurzes Hin-und-her-Wackeln, endet wieder gerade
export function wobble(scene, target, { angle = 7, duration = 90, times = 3 } = {}) {
  return scene.tweens.add({
    targets: target,
    angle: { from: -angle, to: angle },
    duration,
    yoyo: true,
    repeat: times - 1,
    ease: 'Sine.InOut',
    onComplete: () => target.setAngle(0),
  });
}

// Antipp-Feedback: kurz breit und flach, dann zurück.
// Zurück geht es immer auf die Ruhegröße: target.restScale (Möbel: 1), sonst die Größe vor der ersten Quetschung.
// Wichtig, wenn eine neue Quetschung kommt, solange die alte noch läuft (Schrank auf und gleich wieder zu) –
// sonst würde die halb gequetschte Größe zur neuen Ausgangsgröße und der Gegenstand bliebe verformt.
export function squish(scene, target, { amount = 0.1, duration = 100 } = {}) {
  let base;
  if (target.restScale != null) base = { x: target.restScale, y: target.restScale };
  else {
    if (!target._squish) target._squishBase = { x: target.scaleX, y: target.scaleY };
    base = target._squishBase;
  }
  if (target._squish) target._squish.stop();
  target.setScale(base.x, base.y);
  const done = () => {
    if (target._squish !== tween) return;
    target._squish = null;
    target.setScale(base.x, base.y);
  };
  const tween = scene.tweens.add({
    targets: target,
    scaleX: base.x * (1 + amount),
    scaleY: base.y * (1 - amount),
    duration,
    yoyo: true,
    ease: 'Quad.Out',
    onComplete: done,
    onStop: done,
  });
  target._squish = tween;
  return tween;
}

export function fadeIn(scene, target, duration = 300) {
  target.setAlpha(0);
  return scene.tweens.add({ targets: target, alpha: 1, duration, ease: 'Sine.Out' });
}

export function fadeOut(scene, target, duration = 300, destroy = true) {
  return scene.tweens.add({
    targets: target,
    alpha: 0,
    duration,
    ease: 'Sine.In',
    onComplete: () => destroy && target.destroy(),
  });
}
