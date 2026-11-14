// Bäume, Büsche, Farne, Gräser, Blumen, Pilze und Steine rund um den Zauberbaum – mit Canvas-2D gemalt,
// im Stil der gemalten Bilder (weiche Formen, dunkler Umriss, helle Lichtkante oben links).
// Alles wird nur beim Start einmal in Texturen gebacken (systems/bake.js → paintTiles, BackScene).
//
// Ein "Plan" ist eine feste Liste von Pflanzen (Art, Ort, Größe, eigener Zufallswert). Gemalt wird er
// kachelweise: jede Kachel malt nur, was in ihr liegt – und weil jede Pflanze ihre Form aus ihrem eigenen
// Zufallswert holt, passen Pflanzen, die über eine Kachelkante ragen, nahtlos zusammen.
//
// look: wie weit weg etwas ist – { haze: Dunstfarbe, amt: 0..1 wie stark eingefärbt, lw: Umrissbreite (0 = keiner) }

import { makeRng } from './motion.js';

const TAU = Math.PI * 2;

// ---------- Farben ----------
const rgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export function mix(a, b, t) {
  if (!t) return a;
  const A = rgb(a);
  const B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const tone = (hex, look) => mix(hex, look.haze, look.amt);
const pick = (r, list) => list[Math.floor(r() * list.length)];

const LEAF = ['#4f9a48', '#3f8a4f', '#5ea84c', '#2f7a5f', '#6aaa45', '#3a7f6c'];
const FIR = ['#2f6a55', '#2d6248', '#36705e', '#2a5f5c'];
const BIRCH_LEAF = ['#8cbf4a', '#9ccb5c', '#7fb653'];
const WILLOW = ['#6fae5a', '#5fa067', '#7ab765'];
const BLOSSOM = ['#f2a6c9', '#e98bb8', '#f7c4dc'];
const BARK = '#6b4630';
const OUTLINE = '#3a2a1c';
const BLOOMS = ['#ff9ec7', '#ffffff', '#ffd166', '#c9a6ff', '#9fd4ff'];

// ---------- Grundformen ----------
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, TAU);
  ctx.fill();
}

// Wolkenform aus Kreisen: Umriss, Schattenseite, Hauptfarbe, Lichtflecken
function blobs(ctx, list, main, look, light = 0.35) {
  if (look.lw) {
    ctx.fillStyle = tone(mix(main, '#0e1a10', 0.62), look);
    for (const b of list) circle(ctx, b.x, b.y, b.r + look.lw);
  }
  ctx.fillStyle = tone(mix(main, '#0d1a12', 0.3), look);
  for (const b of list) circle(ctx, b.x, b.y, b.r);
  ctx.fillStyle = tone(main, look);
  for (const b of list) circle(ctx, b.x - b.r * 0.08, b.y - b.r * 0.13, b.r * 0.82);
  ctx.fillStyle = tone(mix(main, '#fff8d0', light), look);
  for (const b of list) circle(ctx, b.x - b.r * 0.3, b.y - b.r * 0.38, b.r * 0.38);
}

// leicht gebogener, sich verjüngender Stamm von (x, y) nach oben
function trunk(ctx, x, y, w0, w1, h, bend, color, look) {
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(x - w0 / 2, y + 4);
    ctx.quadraticCurveTo(x - w1 / 2 + bend * 0.3, y - h * 0.5, x - w1 / 2 + bend, y - h);
    ctx.lineTo(x + w1 / 2 + bend, y - h);
    ctx.quadraticCurveTo(x + w1 / 2 + bend * 0.3, y - h * 0.5, x + w0 / 2, y + 4);
    ctx.closePath();
  };
  shape();
  if (look.lw) {
    ctx.lineWidth = look.lw * 2;
    ctx.strokeStyle = tone(OUTLINE, look);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = tone(color, look);
  ctx.fill();
  // Licht auf der linken Seite
  ctx.fillStyle = tone(mix(color, '#ffe8c8', 0.25), look);
  ctx.beginPath();
  ctx.moveTo(x - w0 * 0.35, y);
  ctx.quadraticCurveTo(x - w1 * 0.3 + bend * 0.3, y - h * 0.5, x - w1 * 0.3 + bend, y - h);
  ctx.lineTo(x - w1 * 0.05 + bend, y - h);
  ctx.quadraticCurveTo(x - w0 * 0.05 + bend * 0.3, y - h * 0.5, x - w0 * 0.1, y);
  ctx.closePath();
  ctx.fill();
}

// ---------- Bäume ----------
// Laubbaum mit runder Wolkenkrone (manchmal blühend oder mit Früchten)
function oak(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, h } = it;
  const bend = (r() - 0.5) * h * 0.1;
  trunk(ctx, x, y, h * 0.11, h * 0.055, h * 0.64, bend, BARK, look);
  const cx = x + bend;
  const cy = y - h * 0.68;
  const R = h * (0.25 + r() * 0.05);
  const wf = 1 + r() * 0.3;
  const list = [{ x: cx, y: cy, r: R * 0.62 }];
  const n = 8 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.5;
    const d = R * (0.45 + r() * 0.3);
    list.push({ x: cx + Math.cos(a) * d * wf, y: cy + Math.sin(a) * d * 0.78, r: R * (0.38 + r() * 0.2) });
  }
  const bloom = r() < 0.18;
  blobs(ctx, list, bloom ? pick(r, BLOSSOM) : pick(r, LEAF), look, bloom ? 0.45 : 0.35);
  const dots = bloom ? '#ffffff' : r() < 0.3 ? '#e8504a' : r() < 0.3 ? pick(r, BLOOMS) : null;
  if (dots) {
    ctx.fillStyle = tone(dots, look);
    for (let i = 0; i < 16; i++) {
      const a = r() * TAU;
      const d = r() * R * 0.95;
      circle(ctx, cx + Math.cos(a) * d * wf, cy + Math.sin(a) * d * 0.75, h * 0.012 + 1.5);
    }
  }
}

// Tanne aus übereinander liegenden, unten gewellten Stufen
function fir(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, h } = it;
  const w = h * (0.42 + r() * 0.1);
  trunk(ctx, x, y, h * 0.07, h * 0.05, h * 0.2, 0, BARK, look);
  const main = pick(r, FIR);
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const yb = y - h * 0.12 - t * h * 0.66;
    const hw = (w / 2) * (1 - t * 0.8);
    const th = h * 0.3 * (1 - t * 0.35);
    const apex = yb - th;
    const m = 3 + Math.round(hw / (h * 0.06));
    ctx.beginPath();
    ctx.moveTo(x, apex);
    ctx.quadraticCurveTo(x - hw * 0.35, yb - th * 0.35, x - hw, yb);
    for (let k = 1; k <= m; k++) {
      const x2 = x - hw + (2 * hw * k) / m;
      ctx.quadraticCurveTo(x2 - hw / m, yb + th * 0.16, x2, yb);
    }
    ctx.quadraticCurveTo(x + hw * 0.35, yb - th * 0.35, x, apex);
    ctx.closePath();
    if (look.lw) {
      ctx.lineWidth = look.lw * 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tone(mix(main, '#0b140e', 0.65), look);
      ctx.stroke();
    }
    ctx.fillStyle = tone(main, look);
    ctx.fill();
    // Licht links, Schatten rechts
    ctx.fillStyle = tone(mix(main, '#e8ffd0', 0.22), look);
    ctx.beginPath();
    ctx.moveTo(x, apex + th * 0.08);
    ctx.quadraticCurveTo(x - hw * 0.3, yb - th * 0.35, x - hw * 0.82, yb - th * 0.04);
    ctx.lineTo(x - hw * 0.25, yb + th * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tone(mix(main, '#08120c', 0.25), look);
    ctx.beginPath();
    ctx.moveTo(x + hw * 0.05, apex + th * 0.2);
    ctx.quadraticCurveTo(x + hw * 0.4, yb - th * 0.3, x + hw * 0.9, yb);
    ctx.lineTo(x + hw * 0.4, yb + th * 0.08);
    ctx.closePath();
    ctx.fill();
  }
}

// Birke: heller Stamm mit dunklen Strichen, lockere hellgrüne Krone
function birch(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, h } = it;
  const bend = (r() - 0.5) * h * 0.12;
  trunk(ctx, x, y, h * 0.06, h * 0.035, h * 0.78, bend, '#eee6d8', look);
  ctx.strokeStyle = tone('#3c3a40', look);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, h * 0.007);
  for (let i = 0; i < 9; i++) {
    const t = 0.05 + r() * 0.7;
    const yy = y - h * 0.78 * t;
    const xx = x + bend * t * t + (r() - 0.5) * h * 0.02;
    ctx.beginPath();
    ctx.moveTo(xx - h * 0.012, yy);
    ctx.lineTo(xx + h * 0.012, yy + h * 0.004);
    ctx.stroke();
  }
  const cx = x + bend;
  const cy = y - h * 0.74;
  const R = h * 0.2;
  const list = [];
  for (let i = 0; i < 10; i++) {
    const a = r() * TAU;
    const d = R * (0.3 + r() * 0.8);
    list.push({ x: cx + Math.cos(a) * d * 1.1, y: cy + Math.sin(a) * d * 1.05, r: R * (0.3 + r() * 0.18) });
  }
  blobs(ctx, list, pick(r, BIRCH_LEAF), look, 0.4);
}

// Pappel: schmale, hohe Krone
function poplar(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, h } = it;
  trunk(ctx, x, y, h * 0.07, h * 0.05, h * 0.3, 0, BARK, look);
  const list = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    list.push({
      x: x + (r() - 0.5) * h * 0.05,
      y: y - h * (0.28 + t * 0.62),
      r: h * (0.07 + 0.08 * Math.sin(Math.PI * (0.2 + 0.75 * (1 - t)))) * (0.9 + r() * 0.2),
    });
  }
  blobs(ctx, list, pick(r, LEAF), look);
}

// Trauerweide: Kuppel mit herabhängenden Zweigen
function willow(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, h } = it;
  const bend = (r() - 0.5) * h * 0.08;
  trunk(ctx, x, y, h * 0.13, h * 0.07, h * 0.58, bend, BARK, look);
  const cx = x + bend;
  const cy = y - h * 0.62;
  const R = h * 0.3;
  const main = pick(r, WILLOW);
  const strands = [];
  for (let i = 0; i < 16; i++) {
    const sx = cx + (i / 15 - 0.5) * R * 2.3;
    const len = h * (0.28 + r() * 0.2) * (1 - Math.abs(i / 15 - 0.5) * 0.6);
    strands.push([sx, cy + R * 0.1, sx + (r() - 0.5) * R * 0.25, len]);
  }
  ctx.lineCap = 'round';
  const strand = ([sx, sy, ex, len], w, col) => {
    ctx.lineWidth = w;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + (ex - sx) * 2, sy + len * 0.5, ex, sy + len);
    ctx.stroke();
  };
  const sw = h * 0.035;
  if (look.lw) for (const s of strands) strand(s, sw + look.lw * 2, tone(mix(main, '#0e1a10', 0.62), look));
  for (const s of strands) strand(s, sw, tone(mix(main, '#0d1a12', 0.2), look));
  const list = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    list.push({ x: cx + Math.cos(a) * R * 0.75, y: cy + Math.sin(a) * R * 0.55, r: R * (0.42 + r() * 0.12) });
  }
  list.push({ x: cx, y: cy - R * 0.1, r: R * 0.6 });
  blobs(ctx, list, main, look);
}

// gemaltes Baumbild (nur hinten im Wald, eingefärbt)
function painted(ctx, it, look, imgs) {
  const img = imgs?.baum;
  if (!img) return oak(ctx, it, look);
  const w = (it.h * img.width) / img.height;
  ctx.drawImage(img, it.x - w / 2, it.y - it.h, w, it.h);
}

// ---------- Boden ----------
// Busch aus mehreren Kugeln, manchmal mit Blüten oder Beeren
function bush(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, s } = it;
  const w = s * (110 + r() * 90);
  const hh = w * (0.5 + r() * 0.25);
  const n = 5 + Math.floor(r() * 4);
  const list = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const rad = hh * (0.42 + r() * 0.2);
    list.push({ x: x + (u - 0.5) * w * 0.9, y: y - rad * 0.8 - hh * 0.35 * Math.sin(Math.PI * u), r: rad });
  }
  const main = pick(r, LEAF.concat(['#7bb05a', '#4a9a70']));
  blobs(ctx, list, main, look);
  const f = r();
  if (f < 0.4) {
    const col = pick(r, BLOOMS);
    for (let i = 0; i < 8 + r() * 6; i++) {
      const b = list[Math.floor(r() * list.length)];
      const a = r() * TAU;
      const px = b.x + Math.cos(a) * b.r * 0.6;
      const py = b.y + Math.sin(a) * b.r * 0.6;
      blossom(ctx, px, py, s * (7 + r() * 3), col, look);
    }
  } else if (f < 0.6) {
    const col = pick(r, ['#e8404a', '#5a6ad8', '#d8304a']);
    for (let i = 0; i < 5; i++) {
      const b = list[Math.floor(r() * list.length)];
      const px = b.x + (r() - 0.5) * b.r;
      const py = b.y + (r() - 0.2) * b.r * 0.6;
      for (const [dx, dy] of [[0, 0], [9, 3], [3, 9]]) {
        ctx.fillStyle = tone('#3a1a20', look);
        circle(ctx, px + dx * s, py + dy * s, 6.5 * s);
        ctx.fillStyle = tone(col, look);
        circle(ctx, px + dx * s, py + dy * s, 5 * s);
        ctx.fillStyle = tone('#ffffff', look);
        circle(ctx, px + dx * s - 1.8 * s, py + dy * s - 1.8 * s, 1.4 * s);
      }
    }
  }
}

// kleine Blüte (fünf Blütenblätter, gelbe Mitte)
function blossom(ctx, x, y, r, col, look) {
  ctx.fillStyle = tone(col, look);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    circle(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5);
  }
  ctx.fillStyle = tone(col === '#ffd166' ? '#e87a3a' : '#ffd166', look);
  circle(ctx, x, y, r * 0.35);
}

// Farn: gebogene Wedel mit Fiederblättchen
function fern(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, s } = it;
  const main = pick(r, ['#3f8f4a', '#4fa055', '#5aa35a', '#3a8a5e']);
  const n = 5 + Math.floor(r() * 3);
  const fronds = [];
  for (let i = 0; i < n; i++) {
    const side = i / (n - 1) - 0.5;
    const L = s * (100 + r() * 50) * (1 - Math.abs(side) * 0.35);
    const ang = -Math.PI / 2 + side * 2.4;
    fronds.push({
      p0: [x + side * 20 * s, y],
      p1: [x + Math.cos(ang) * L * 0.5, y + Math.sin(ang) * L * 0.75],
      p2: [x + Math.cos(ang) * L * 1.05, y + Math.sin(ang) * L * 0.55 + L * 0.25 * Math.abs(side) * 2],
      L,
    });
  }
  const quad = (f, t) => {
    const u = 1 - t;
    return [
      u * u * f.p0[0] + 2 * u * t * f.p1[0] + t * t * f.p2[0],
      u * u * f.p0[1] + 2 * u * t * f.p1[1] + t * t * f.p2[1],
    ];
  };
  const leaflets = (f, grow, col) => {
    ctx.fillStyle = col;
    for (let t = 0.12; t <= 1; t += 0.075) {
      const [px, py] = quad(f, t);
      const [qx, qy] = quad(f, Math.min(1, t + 0.01));
      const a = Math.atan2(qy - py, qx - px);
      const l = f.L * 0.17 * (1 - t * 0.75) + grow;
      for (const sd of [-1, 1]) {
        const na = a + sd * 1.1;
        ctx.beginPath();
        ctx.ellipse(px + Math.cos(na) * l * 0.5, py + Math.sin(na) * l * 0.5, l * 0.55, l * 0.22 + grow * 0.5, na, 0, TAU);
        ctx.fill();
      }
    }
  };
  for (const f of fronds) {
    if (look.lw) leaflets(f, look.lw * 0.8, tone(mix(main, '#0e1a10', 0.6), look));
    leaflets(f, 0, tone(main, look));
    ctx.strokeStyle = tone(mix(main, '#0e1a10', 0.35), look);
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(...f.p0);
    ctx.quadraticCurveTo(...f.p1, ...f.p2);
    ctx.stroke();
  }
}

// Grasbüschel
function grass(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, s } = it;
  const n = 7 + Math.floor(r() * 7);
  const cols = ['#5aa84c', '#6fb84f', '#4a9a45', '#7cc25a'];
  const blades = [];
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * 50 * s;
    blades.push({ bx, bh: s * (40 + r() * 70), lean: (bx - x) * 0.9 + (r() - 0.5) * 30 * s, bw: s * (5 + r() * 4), col: pick(r, cols) });
  }
  blades.sort((a, b) => b.bh - a.bh);
  ctx.lineJoin = 'round';
  for (const b of blades) {
    ctx.beginPath();
    ctx.moveTo(b.bx - b.bw, y);
    ctx.quadraticCurveTo(b.bx - b.bw * 0.3, y - b.bh * 0.6, b.bx + b.lean, y - b.bh);
    ctx.quadraticCurveTo(b.bx + b.bw * 0.3, y - b.bh * 0.5, b.bx + b.bw, y);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = tone('#2f5a2a', look);
    ctx.stroke();
    ctx.fillStyle = tone(b.col, look);
    ctx.fill();
  }
}

// Fingerhut: hoher Stängel mit hängenden Glockenblüten
function foxglove(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, s } = it;
  const H = s * (150 + r() * 80);
  const lean = (r() - 0.5) * 30 * s;
  const col = pick(r, ['#d77ac8', '#b78ae8', '#f29ab8', '#f4e6f6']);
  // Blätter am Fuß
  ctx.fillStyle = tone('#2f5a2a', look);
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sd * 22 * s, y - 10 * s, 30 * s, 11 * s, sd * -0.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = tone('#4f9a48', look);
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sd * 22 * s, y - 12 * s, 26 * s, 8 * s, sd * -0.4, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = tone('#3f7a35', look);
  ctx.lineWidth = 5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x, y - H * 0.6, x + lean, y - H);
  ctx.stroke();
  const at = (t) => {
    const u = 1 - t;
    return [u * u * x + 2 * u * t * x + t * t * (x + lean), u * u * y + 2 * u * t * (y - H * 0.6) + t * t * (y - H)];
  };
  for (let i = 0, t = 0.4; t < 0.95; t += 0.07, i++) {
    const [px, py] = at(t);
    const sd = i % 2 ? 1 : -1;
    const b = s * (13 - t * 7);
    ctx.save();
    ctx.translate(px + sd * b * 0.7, py + b * 0.4);
    ctx.rotate(sd * 0.5);
    ctx.fillStyle = tone(mix(col, '#2a1030', 0.45), look);
    ctx.beginPath();
    ctx.ellipse(0, 0, b * 0.75, b * 1.15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tone(col, look);
    ctx.beginPath();
    ctx.ellipse(-b * 0.08, -b * 0.08, b * 0.6, b, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tone(mix(col, '#5a1a4a', 0.5), look);
    circle(ctx, 0, b * 0.65, b * 0.3);
    ctx.restore();
  }
  ctx.fillStyle = tone('#7cc25a', look);
  const [tx, ty] = at(1);
  circle(ctx, tx, ty, 5 * s);
}

// Blumenstrauß auf der Wiese: Gänseblümchen, Glockenblumen, Butterblumen
function flowers(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, s } = it;
  const kind = pick(r, ['daisy', 'bell', 'butter', 'daisy', 'tulip']);
  const n = 2 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * 50 * s;
    const H = s * (35 + r() * 55);
    const tx = bx + (r() - 0.5) * 20 * s;
    ctx.strokeStyle = tone('#3f7a35', look);
    ctx.lineWidth = 3.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx, y - H * 0.5, tx, y - H);
    ctx.stroke();
    if (i === 0) {
      ctx.fillStyle = tone('#4f9a48', look);
      ctx.beginPath();
      ctx.ellipse(bx + 8 * s, y - H * 0.3, 10 * s, 4 * s, -0.5, 0, TAU);
      ctx.fill();
    }
    const fy = y - H;
    if (kind === 'daisy') {
      ctx.fillStyle = tone('#8a7a9a', look);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * 8 * s, fy + Math.sin(a) * 8 * s, 6.5 * s, 3.4 * s, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = tone('#ffffff', look);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * 8 * s, fy + Math.sin(a) * 8 * s, 5.5 * s, 2.6 * s, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = tone('#ffc23a', look);
      circle(ctx, tx, fy, 4.5 * s);
    } else if (kind === 'bell') {
      ctx.save();
      ctx.translate(tx, fy);
      ctx.rotate(0.5);
      ctx.fillStyle = tone('#3c4aa0', look);
      ctx.beginPath();
      ctx.moveTo(-9 * s, 10 * s);
      ctx.quadraticCurveTo(-9 * s, -6 * s, 0, -6 * s);
      ctx.quadraticCurveTo(9 * s, -6 * s, 9 * s, 10 * s);
      ctx.lineTo(4 * s, 7 * s);
      ctx.lineTo(0, 11 * s);
      ctx.lineTo(-4 * s, 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = tone('#7d8cf0', look);
      ctx.beginPath();
      ctx.ellipse(-2 * s, 1 * s, 4 * s, 6 * s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (kind === 'butter') {
      blossom(ctx, tx, fy, 11 * s, '#ffd166', look);
    } else {
      ctx.fillStyle = tone('#c0406a', look);
      ctx.beginPath();
      ctx.moveTo(tx - 9 * s, fy - 8 * s);
      ctx.lineTo(tx - 4 * s, fy - 3 * s);
      ctx.lineTo(tx, fy - 10 * s);
      ctx.lineTo(tx + 4 * s, fy - 3 * s);
      ctx.lineTo(tx + 9 * s, fy - 8 * s);
      ctx.quadraticCurveTo(tx + 10 * s, fy + 7 * s, tx, fy + 7 * s);
      ctx.quadraticCurveTo(tx - 10 * s, fy + 7 * s, tx - 9 * s, fy - 8 * s);
      ctx.fill();
      ctx.fillStyle = tone('#ff8ab0', look);
      ctx.beginPath();
      ctx.ellipse(tx - 3 * s, fy, 3 * s, 5 * s, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// ein Pilz: Stiel + Hut; kind bestimmt die Form
// 'fly' Fliegenpilz, 'cep' Steinpilz, 'glow' leuchtender Feenpilz, 'tiny' dünne Hallimasch-Stiele
function mushroom(ctx, x, y, s, kind, cap, look) {
  const line = tone('#4a2a18', look);
  const lw = look.lw === 0 ? 0 : Math.max(2.5, 3.2 * Math.min(s, 1.6));
  const stroke = () => {
    if (!lw) return;
    ctx.lineWidth = lw;
    ctx.strokeStyle = line;
    ctx.stroke();
  };
  const dims = {
    fly: [24, 50, 46, 34],
    cep: [34, 40, 44, 28],
    glow: [18, 44, 36, 30],
    tiny: [8, 52, 17, 14],
  }[kind];
  const [sw, sh, rx, ry] = dims.map((v) => v * s);
  if (kind === 'glow') {
    const g = ctx.createRadialGradient(x, y - sh, 2, x, y - sh, rx * 2.4);
    g.addColorStop(0, 'rgba(210, 170, 255, 0.55)');
    g.addColorStop(1, 'rgba(210, 170, 255, 0)');
    ctx.fillStyle = g;
    circle(ctx, x, y - sh, rx * 2.4);
  }
  {
    ctx.fillStyle = tone(kind === 'cep' ? '#efe0c0' : '#fff4e0', look);
    ctx.beginPath();
    if (kind === 'cep') {
      ctx.moveTo(x - sw * 0.35, y - sh);
      ctx.quadraticCurveTo(x - sw * 0.75, y - sh * 0.3, x - sw * 0.45, y);
      ctx.lineTo(x + sw * 0.45, y);
      ctx.quadraticCurveTo(x + sw * 0.75, y - sh * 0.3, x + sw * 0.35, y - sh);
      ctx.closePath();
    } else ctx.roundRect(x - sw / 2, y - sh, sw, sh, Math.min(sw / 2, 10 * s));
    ctx.fill();
    stroke();
  }
  const cy = y - sh;
  ctx.beginPath();
  if (kind === 'tiny') {
    ctx.moveTo(x - rx, cy + 2 * s);
    ctx.quadraticCurveTo(x - rx * 0.8, cy - ry * 1.6, x, cy - ry * 1.4);
    ctx.quadraticCurveTo(x + rx * 0.8, cy - ry * 1.6, x + rx, cy + 2 * s);
  } else {
    ctx.ellipse(x, cy, rx, ry, 0, Math.PI, 0);
    ctx.quadraticCurveTo(x, cy + ry * 0.28, x - rx, cy);
  }
  ctx.closePath();
  ctx.fillStyle = tone(cap, look);
  ctx.fill();
  stroke();
  // Licht oben links
  ctx.fillStyle = tone(mix(cap, '#ffffff', 0.35), look);
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.4, cy - ry * 0.55, rx * 0.25, ry * 0.18, -0.5, 0, TAU);
  ctx.fill();
  if (kind === 'fly' || kind === 'glow') {
    ctx.fillStyle = tone(kind === 'glow' ? '#f4e8ff' : '#ffffff', look);
    for (const [dx, dy, rr] of [[-0.45, -0.35, 0.15], [0.12, -0.7, 0.17], [0.5, -0.3, 0.13], [-0.05, -0.25, 0.1], [-0.75, -0.08, 0.08]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * rx, cy + dy * ry, rr * rx, rr * rx * 0.8, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// Pilzgruppe
function shrooms(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, s } = it;
  const kind = pick(r, ['fly', 'fly', 'cep', 'glow', 'tiny']);
  const cap = { fly: '#e0566f', cep: '#8a5230', glow: pick(r, ['#a77ae0', '#6aa8e8']), tiny: '#d6a26a' }[kind];
  const n = kind === 'tiny' ? 3 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3);
  const list = [];
  for (let i = 0; i < n; i++) list.push({ x: x + (i - (n - 1) / 2) * 34 * s + (r() - 0.5) * 16 * s, sc: s * (i === 0 ? 1 : 0.55 + r() * 0.4), y: y + r() * 8 * s });
  list.sort((a, b) => b.sc - a.sc).sort((a, b) => a.y - b.y);
  for (const m of list) mushroom(ctx, m.x, m.y, m.sc, kind, cap, look);
}

// Stein mit Moos
function stone(ctx, it, look) {
  const r = makeRng(it.seed);
  const { x, y, s } = it;
  const w = s * (40 + r() * 30);
  const h = w * (0.55 + r() * 0.2);
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.45, w, h, 0, Math.PI, 0);
  ctx.quadraticCurveTo(x + w, y + 4, x, y + 4);
  ctx.quadraticCurveTo(x - w, y + 4, x - w, y - h * 0.45);
  ctx.closePath();
  ctx.fillStyle = tone('#8f8aa3', look);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = tone('#45405a', look);
  ctx.stroke();
  ctx.fillStyle = tone('#b4afc6', look);
  ctx.beginPath();
  ctx.ellipse(x - w * 0.3, y - h * 0.95, w * 0.35, h * 0.22, -0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = tone('#6fae48', look);
  for (let i = 0; i < 5; i++) circle(ctx, x + (r() - 0.3) * w * 0.9, y - h * (1.15 + r() * 0.15) + Math.abs(r() - 0.5) * h * 0.6, w * (0.13 + r() * 0.1));
}

const PAINTERS = { oak, fir, birch, poplar, willow, painted, bush, fern, grass, foxglove, flowers, shrooms, stone };

// Größe einer Pflanze (für das Weglassen außerhalb der Kachel): halbe Breite und Höhe
function extent(it) {
  if (it.h) return [it.h * 0.55, it.h * 1.08];
  const s = it.s;
  return {
    bush: [s * 130, s * 190], fern: [s * 170, s * 170], grass: [s * 80, s * 125], foxglove: [s * 70, s * 250],
    flowers: [s * 70, s * 110], shrooms: [s * 150, s * 150], stone: [s * 80, s * 80],
  }[it.kind];
}

// sichtbarer Bereich der Kachel, in die gerade gemalt wird
function tileBounds(ctx) {
  const m = ctx.getTransform();
  const x = -m.e / m.a;
  const y = -m.f / m.d;
  return { x0: x, y0: y, x1: x + ctx.canvas.width / m.a, y1: y + ctx.canvas.height / m.d };
}

// Pflanzenliste malen (nur was in der Kachel liegt)
export function paintPlants(ctx, items, looks, imgs) {
  const b = tileBounds(ctx);
  for (const it of items) {
    const [hw, h] = extent(it);
    if (it.x + hw < b.x0 || it.x - hw > b.x1 || it.y - h > b.y1 || it.y + 40 < b.y0) continue;
    PAINTERS[it.kind](ctx, it, looks[it.look] || looks.near, imgs);
  }
}

function weighted(r, table) {
  let v = r() * table.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of table) if ((v -= w) <= 0) return k;
  return table[0][0];
}

// ---------- Pläne ----------
// Boden rund um den Zauberbaum (Weltkoordinaten). gy = Oberkante der Wiese.
// trunk: [x0, x1] – hier steht der Stamm (dahinter wächst nichts, sieht man eh nicht);
// door: [x0, x1] – vor der Haustür bleibt die Wiese frei.
export function groundPlan({ x0, x1, gy, trunk: [ta, tb], door: [da, db] }) {
  const r = makeRng(4242);
  const seed = () => Math.floor(r() * 1e9);
  const grove = [];
  const thicket = [];
  const front = [];

  // Bäume am Waldrand: zwei Reihen (hinten größer und leicht im Dunst, vorne kleiner und kräftig)
  const TREES = [['oak', 34], ['fir', 26], ['birch', 16], ['poplar', 10], ['willow', 11]];
  for (const [row, hMin, hMax, gap, look, dy] of [
    ['back', 950, 1350, 330, 'grove2', -18],
    ['front', 620, 980, 420, 'grove', 8],
  ]) {
    for (let x = x0 + r() * gap; x < x1; x += gap * (0.7 + r() * 0.8)) {
      if (x > ta - 150 && x < tb + 150) continue;
      grove.push({ kind: weighted(r, TREES), x, y: gy + dy + r() * 14, h: hMin + r() * (hMax - hMin), seed: seed(), look, row });
    }
  }
  grove.sort((a, b) => (a.row === b.row ? a.y - b.y : a.row === 'back' ? -1 : 1));

  // Dickicht vor den Bäumen: Büsche, Farne, Fingerhut, Gräser, Pilze, Steine
  const UNDER = [['bush', 46], ['fern', 18], ['foxglove', 10], ['grass', 12], ['shrooms', 9], ['stone', 5]];
  for (let x = x0; x < x1; x += 65 + r() * 85) {
    if (x > ta && x < tb) continue;
    const kind = weighted(r, UNDER);
    const s = { bush: 1 + r() * 0.7, fern: 1 + r() * 0.5, foxglove: 1 + r() * 0.4, grass: 1.1 + r() * 0.5, shrooms: 1.2 + r() * 0.5, stone: 1.1 + r() * 0.6 }[kind];
    thicket.push({ kind, x, y: gy + 18 + r() * 26, s, seed: seed(), look: 'near' });
  }
  // zweite, niedrige Reihe davor
  for (let x = x0 + 40; x < x1; x += 110 + r() * 140) {
    if (x > ta + 60 && x < tb - 60) continue;
    const kind = weighted(r, [['grass', 40], ['shrooms', 25], ['flowers', 25], ['fern', 10]]);
    thicket.push({ kind, x, y: gy + 40 + r() * 10, s: 0.9 + r() * 0.4, seed: seed(), look: 'near' });
  }
  thicket.sort((a, b) => a.y - b.y);

  // vorne in der Wiese: verstreut, nach Tiefe sortiert (weiter unten = weiter vorne = etwas größer)
  const FRONT = [['grass', 38], ['flowers', 28], ['shrooms', 16], ['stone', 8], ['fern', 6], ['foxglove', 4]];
  for (let x = x0; x < x1; x += 45 + r() * 95) {
    const y = gy + 75 + r() * 220;
    if (x > da && x < db) continue;
    const kind = weighted(r, FRONT);
    const depth = (y - gy) / 300;
    const s = (0.65 + depth * 0.45) * (0.85 + r() * 0.3) * (kind === 'fern' || kind === 'foxglove' ? 0.75 : 1);
    front.push({ kind, x, y, s, seed: seed(), look: 'near' });
  }
  front.sort((a, b) => a.y - b.y);

  return { back: [...grove, ...thicket], front };
}

// Aussehen je Entfernung für den Boden am Baum
export const GROUND_LOOKS = {
  grove2: { haze: '#9a92d8', amt: 0.24, lw: 5 },
  grove: { haze: '#9a92d8', amt: 0.06, lw: 6 },
  near: { haze: '#ffffff', amt: 0, lw: 4 },
};

// Ein Streifen ferner Wald für die BackScene (Breite FW, Boden bei horizon, darunter `below` Boden).
// Bäume in zwei Reihen, Büsche an der Waldkante, Nebel über dem Boden.
export function paintForestLayer(ctx, FW, cfg, imgs) {
  const r = makeRng(cfg.seed);
  const look = { haze: cfg.haze, amt: cfg.amt, lw: cfg.lw || 0 };
  const H = cfg.horizon + cfg.below;
  // Boden: sanfte Hügel
  const ground = tone(cfg.ground, look);
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= FW; x += 20) ctx.lineTo(x, cfg.horizon - 10 + Math.sin(x / 260 + cfg.seed) * 14 + Math.sin(x / 97) * 6);
  ctx.lineTo(FW, H);
  ctx.closePath();
  ctx.fill();

  const items = [];
  const seed = () => Math.floor(r() * 1e9);
  for (const [dy, f] of [[-cfg.hMin * 0.06, 0.85], [cfg.hMin * 0.04, 1]]) {
    for (let x = -80 + r() * cfg.step; x < FW + 80; x += cfg.step * (0.55 + r() * 0.9)) {
      const kind = weighted(r, cfg.kinds);
      items.push({ kind, x, y: cfg.horizon + dy + r() * 16, h: (cfg.hMin + r() * (cfg.hMax - cfg.hMin)) * f, seed: seed() });
    }
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) PAINTERS[it.kind](ctx, it, look, imgs);
  // Büsche an der Waldkante (verdecken die Stammfüße)
  for (let x = -60; x < FW + 60; x += cfg.hMin * (0.15 + r() * 0.2)) {
    bush(ctx, { x, y: cfg.horizon + 14 + r() * 10, s: cfg.hMin / 520 + r() * 0.3, seed: seed() }, look);
  }
  // Nebel über dem Waldboden
  if (cfg.mist) {
    const top = cfg.horizon - cfg.hMax * 0.55;
    const g = ctx.createLinearGradient(0, top, 0, H);
    const [mr, mg, mb] = rgb(cfg.mistColor);
    const span = H - top;
    g.addColorStop(0, `rgba(${mr},${mg},${mb},0)`);
    g.addColorStop((cfg.horizon - top) / span, `rgba(${mr},${mg},${mb},${cfg.mist})`);
    g.addColorStop(1, `rgba(${mr},${mg},${mb},${cfg.mist * 0.5})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, FW, span);
  }
}
