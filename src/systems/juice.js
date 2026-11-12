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

// Antipp-Feedback: kurz breit und flach, dann zurück
export function squish(scene, target, { amount = 0.1, duration = 100 } = {}) {
  const sx = target.scaleX;
  const sy = target.scaleY;
  return scene.tweens.add({
    targets: target,
    scaleX: sx * (1 + amount),
    scaleY: sy * (1 - amount),
    duration,
    yoyo: true,
    ease: 'Quad.Out',
  });
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
