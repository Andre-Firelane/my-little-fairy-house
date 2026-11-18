// Wege für Events (Lichterfest, Frühlingsfest, Erster Schnee): Polylinien mit Weglänge und glatte Schleifen.
import { clamp } from '../systems/motion.js';

// Polylinie mit Weglänge: at(s) = Punkt nach s Weltpixeln
export function track(points, closed = false) {
  const pts = closed ? [...points, points[0]] : points;
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const length = d[d.length - 1];
  const at = (s) => {
    s = closed ? ((s % length) + length) % length : clamp(s, 0, length);
    let lo = 0;
    let hi = d.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (d[mid] <= s) lo = mid;
      else hi = mid;
    }
    const u = (s - d[lo]) / Math.max(1e-6, d[hi] - d[lo]);
    return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * u, y: pts[lo].y + (pts[hi].y - pts[lo].y) * u };
  };
  return { length, at };
}

// glatter, geschlossener Weg durch die Punkte (Catmull-Rom); points in Weltkoordinaten
export function smoothPath(points) {
  const p = points;
  const n = p.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]];
    for (let k = 0; k < 12; k++) {
      const t = k / 12;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

// Kreis (bzw. Ellipse) als Punkte, für smoothPath
export function ring(cx, cy, rx, ry, n = 10) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });
}
