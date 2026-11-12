// Kleine Zeichen-Helfer für Phaser.Graphics (alles zentriert um 0,0).

// Höhlen-/Raumform: Bogen oben, leicht abgerundet unten
export function arch(g, w, h, inset = 0, fill = true) {
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  // Bogen proportional zur Breite, damit Baum-Ansicht (300 px) und Editor (960 px) gleich aussehen
  const top = Math.min(iw * 0.25, ih - 40);
  const radius = { tl: top, tr: top, bl: 28, br: 28 };
  if (fill) g.fillRoundedRect(-iw / 2, -ih / 2, iw, ih, radius);
  else g.strokeRoundedRect(-iw / 2, -ih / 2, iw, ih, radius);
}

export function starPoints(cx, cy, outer, inner, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function fillStar(g, cx, cy, outer, inner, n = 5) {
  g.fillPoints(starPoints(cx, cy, outer, inner, n), true);
}

// geschlossene Linie mit runden Ecken (dicke Linien haben in Phaser sonst Zacken an den Knicken)
export function strokeRound(g, pts, width, color, alpha = 1, closed = true) {
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts, closed);
  g.fillStyle(color, alpha);
  for (const p of pts) g.fillCircle(p.x, p.y, width / 2);
}
