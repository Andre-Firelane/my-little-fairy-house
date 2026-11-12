// Kreidezeichnungen für die Tafel: kleine Bildzeichen (keine Schrift – Kinder müssen nichts lesen).
// Jedes Zeichen besteht aus Strichen in einer 1×1-Box; es kann teilweise gezeichnet werden (Fee schreibt gerade).

const star = (() => {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 ? 0.2 : 0.48;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([0.5 + Math.cos(a) * r, 0.52 + Math.sin(a) * r]);
  }
  return [pts];
})();

const flower = (() => {
  const strokes = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      pts.push([0.5 + Math.cos(a) * 0.24 + Math.cos(t) * 0.13, 0.5 + Math.sin(a) * 0.24 + Math.sin(t) * 0.13]);
    }
    strokes.push(pts);
  }
  return strokes;
})();

export const GLYPHS = {
  leaf: [
    [[0.12, 0.88], [0.25, 0.45], [0.6, 0.15], [0.9, 0.1], [0.82, 0.45], [0.5, 0.8], [0.12, 0.88]],
    [[0.12, 0.88], [0.7, 0.3]],
  ],
  sprig: [
    [[0.5, 0.95], [0.5, 0.08]],
    [[0.5, 0.72], [0.22, 0.52]],
    [[0.5, 0.52], [0.8, 0.32]],
    [[0.5, 0.3], [0.25, 0.14]],
  ],
  drop: [[[0.5, 0.05], [0.28, 0.45], [0.22, 0.68], [0.33, 0.88], [0.5, 0.94], [0.67, 0.88], [0.78, 0.68], [0.72, 0.45], [0.5, 0.05]]],
  plus: [[[0.5, 0.22], [0.5, 0.78]], [[0.22, 0.5], [0.78, 0.5]]],
  arrow: [[[0.08, 0.5], [0.9, 0.5]], [[0.66, 0.26], [0.9, 0.5], [0.66, 0.74]]],
  flask: [
    [[0.4, 0.06], [0.4, 0.4], [0.14, 0.84], [0.24, 0.95], [0.76, 0.95], [0.86, 0.84], [0.6, 0.4], [0.6, 0.06]],
    [[0.28, 0.66], [0.72, 0.66]],
  ],
  heart: [[[0.5, 0.9], [0.15, 0.56], [0.12, 0.32], [0.3, 0.15], [0.5, 0.3], [0.7, 0.15], [0.88, 0.32], [0.85, 0.56], [0.5, 0.9]]],
  squiggle: [[[0.05, 0.6], [0.2, 0.35], [0.35, 0.65], [0.5, 0.35], [0.65, 0.65], [0.8, 0.35], [0.95, 0.6]]],
  star,
  flower,
};

export const CHALK = 0xf4f1e8;
const SIZE = 34;
const STEP = 39;
const ROW_H = 56;

// Position (Art-Koordinaten der Tafel) eines Zeichens
export function glyphBox(area, row, col) {
  return { x: area.x + 4 + col * STEP, y: area.y + 10 + row * ROW_H, size: SIZE };
}

function segments(strokes) {
  return strokes.reduce((n, s) => n + s.length - 1, 0);
}

function drawGlyph(g, glyph, box, progress, chalk) {
  const strokes = GLYPHS[glyph.t];
  let budget = segments(strokes) * progress;
  g.lineStyle(4, glyph.c ?? chalk, 0.95);
  for (const s of strokes) {
    if (budget <= 0) break;
    g.beginPath();
    g.moveTo(box.x + s[0][0] * box.size, box.y + s[0][1] * box.size);
    for (let i = 1; i < s.length && budget > 0; i++) {
      const f = Math.min(1, budget);
      const [ax, ay] = s[i - 1];
      const [bx, by] = s[i];
      g.lineTo(box.x + (ax + (bx - ax) * f) * box.size, box.y + (ay + (by - ay) * f) * box.size);
      budget -= 1;
    }
    g.strokePath();
  }
}

// alle Zeilen; partial = { row, glyphs, progress 0..1 } für die Zeile, die gerade entsteht
export function drawNotes(g, area, notes = [], partial = null, chalk = CHALK) {
  g.clear();
  const line = (row, glyphs, progress) => {
    const upto = progress * glyphs.length;
    glyphs.forEach((gl, col) => {
      const p = Math.max(0, Math.min(1, upto - col));
      if (p > 0) drawGlyph(g, gl, glyphBox(area, row, col), p, chalk);
    });
  };
  notes.forEach((n, row) => line(row, n.glyphs, 1));
  if (partial) line(partial.row, partial.glyphs, partial.progress);
}

export const BOARD_ROWS = 2;
