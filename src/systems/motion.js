// Reine Mathe-Helfer für die code-basierten Animationen. Keine Phaser-Abhängigkeit.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Farben (0xRRGGBB) mischen
export function lerpColor(a, b, t) {
  const ch = (c, s) => (c >> s) & 0xff;
  const mix = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return mix(16) | mix(8) | mix(0);
}

// framerate-unabhängiges Annähern (lambda ≈ "wie schnell", 5–15 fühlt sich gut an)
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

export const easeInOutSine = (u) => -(Math.cos(Math.PI * u) - 1) / 2;

// sanftes Auf und Ab: t in Sekunden, freq in Schwingungen pro Sekunde
export const hover = (t, amp = 10, freq = 0.5, phase = 0) => Math.sin((t * freq + phase) * TAU) * amp;

// Flügelschlag als scaleX: pendelt zwischen 0.55 (Flügel hinten) und 1 (offen)
export const wingFlap = (t, speed = 15, phase = 0) => 0.55 + 0.45 * Math.abs(Math.sin(t * speed + phase));

export function cubicBezier(p0, p1, p2, p3, u) {
  const m = 1 - u;
  const a = m * m * m;
  const b = 3 * m * m * u;
  const c = 3 * m * u * u;
  const d = u * u * u;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

// geschwungene Bahn von a nach b: Kontrollpunkte seitlich versetzt (bend = Anteil der Strecke)
export function makeCurve(a, b, bend = rand(-0.35, 0.35)) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const off = bend * len;
  return {
    p0: { x: a.x, y: a.y },
    p1: { x: a.x + dx * 0.33 + nx * off, y: a.y + dy * 0.33 + ny * off },
    p2: { x: a.x + dx * 0.66 + nx * off * 0.7, y: a.y + dy * 0.66 + ny * off * 0.7 },
    p3: { x: b.x, y: b.y },
    length: len,
  };
}

// reproduzierbarer Zufall (für Deko, die bei jedem Start gleich aussehen soll)
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
