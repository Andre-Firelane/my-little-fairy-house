// Gartensachen für den Balkon-Garten (Raumtyp 'garten', siehe config/rooms.js). Gezeichnet statt gemalt.
// Pflanzen (plant: true) wachsen in Stufen: null = frisch gesät → 'g1' Keimling → 'g2' wächst → 'g3' reif/blüht.
// Sie wachsen von selbst langsam (life/RoomLife.js), schneller, wenn eine Fee sie gießt (activities/garden.js).
// crop: Farbe der Ernte (Gemüse/Obst) – reife Pflanzen erntet eine Fee, danach wachsen sie neu.
// rail: hängt außen an den Haken der Balkonpfosten (links/rechts, je zwei) – neben der Balkonfläche,
//   nicht über den Möbeln (Plätze: config/balcony.js → railSpots).
// sprite: gemalte Bilder aus Lieferung 5 (Hochbeet, Bäumchen, Gießkanne, Bank, Blumenkasten); die Zeichnungen
//   (draw) bleiben als Ersatz, falls ein Bild fehlt.

export const STAGES = [null, 'g1', 'g2', 'g3'];
export const nextStage = (s) => STAGES[Math.min(STAGES.length - 1, STAGES.indexOf(s ?? null) + 1)];
export const GROW_TIME = 70; // Sekunden je Stufe, wenn niemand gießt


const INK = 0x4a2a18;
const WOOD = 0xb07a4a;
const WOOD_D = 0x8a5a33;
const SOIL = 0x6b4128;
const LEAF = 0x5fae4a;
const LEAF_D = 0x3f8a3c;

function outline(g, w = 4) {
  g.lineStyle(w, INK, 1);
}

// Erdhügel am Boden (x Mitte, y Boden)
function mound(g, x, y, w) {
  g.fillStyle(SOIL, 1);
  g.fillEllipse(x, y - 6, w, 18);
  g.fillStyle(0x8a5a3b, 1);
  g.fillCircle(x - w * 0.2, y - 10, 3);
  g.fillCircle(x + w * 0.15, y - 8, 2.5);
}

function leafAt(g, x, y, len, angle, color = LEAF) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const w = Math.sin(t * Math.PI) * len * 0.32;
    pts.push({ x: x + c * t * len - s * w, y: y + s * t * len + c * w });
  }
  for (let i = 12; i >= 0; i--) {
    const t = i / 12;
    const w = -Math.sin(t * Math.PI) * len * 0.32;
    pts.push({ x: x + c * t * len - s * w, y: y + s * t * len + c * w });
  }
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2, LEAF_D, 1);
  g.lineBetween(x, y, x + c * len * 0.85, y + s * len * 0.85);
}

function sprout(g, x, y, k = 1) {
  g.lineStyle(4 * k, LEAF_D, 1);
  g.lineBetween(x, y, x, y - 18 * k);
  leafAt(g, x, y - 16 * k, 16 * k, -2.6);
  leafAt(g, x, y - 16 * k, 16 * k, -0.5);
}

// Stängel mit Blättern bis zur Höhe h
function stem(g, x, y, h, leaves, len = 22) {
  g.lineStyle(5, LEAF_D, 1);
  g.lineBetween(x, y, x, y - h);
  for (let i = 0; i < leaves; i++) {
    const ly = y - h * ((i + 1) / (leaves + 1));
    leafAt(g, x, ly, len, i % 2 ? -0.5 : -2.6);
  }
}

function flower(g, x, y, r, petal, center = 0xffd166, n = 6) {
  g.fillStyle(petal, 1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillCircle(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55);
  }
  g.fillStyle(center, 1);
  g.fillCircle(x, y, r * 0.45);
}

// Pflanzschild im frisch gesäten Beet: Stäbchen mit Schild in der Farbe der Pflanze, damit man Samen unterscheidet
function seedTag(g, x, y, color) {
  g.fillStyle(0xc98b5a, 1);
  g.fillRect(x - 2, y - 34, 4, 30);
  g.fillStyle(0xfff4e0, 1);
  g.fillRoundedRect(x - 12, y - 52, 24, 20, 5);
  g.lineStyle(2.5, INK, 1);
  g.strokeRoundedRect(x - 12, y - 52, 24, 20, 5);
  g.fillStyle(color, 1);
  g.fillCircle(x, y - 42, 6.5);
}

// gemeinsamer Aufbau einer Pflanze: Samen-Stufe ist ein Erdhügel mit winzigem Spross,
// draw(g, W, H, stage) zeichnet die Stufen g1..g3
function plant(id, name, w, h, draw, extra = {}) {
  const fn = (stage) => (g, W, H) => {
    mound(g, W / 2, H, Math.min(W - 10, 60));
    if (!stage) {
      sprout(g, W / 2 - 8, H - 8, 0.55);
      seedTag(g, W / 2 + 16, H - 6, extra.tag ?? extra.crop ?? 0xff9ec7, draw, W, H);
      return;
    }
    draw(g, W, H, stage);
  };
  return {
    id,
    name,
    kind: 'small',
    w,
    h,
    plant: true,
    cardState: 'g3', // in der Leiste ausgewachsen zeigen (gepflanzt wird als Samen)
    draw: fn(null),
    states: { g1: fn('g1'), g2: fn('g2'), g3: fn('g3') },
    ...extra,
  };
}

const n = (stage) => ({ g1: 1, g2: 2, g3: 3 })[stage];

export const GARDEN_FURNITURE = {
  hochbeet: {
    id: 'hochbeet',
    name: 'Hochbeet',
    sprite: 'hochbeet',
    kind: 'floor',
    w: 3,
    h: 1,
    surfaces: [{ y: 0.8, x0: 0, x1: 3 }], // Erde (Höhe wird beim Start am Bild gemessen): drei Pflanzen nebeneinander
    draw(g, W, H) {
      outline(g);
      g.fillStyle(SOIL, 1);
      g.fillRoundedRect(8, H - 64, W - 16, 18, 8);
      g.fillStyle(WOOD, 1);
      g.fillRoundedRect(4, H - 52, W - 8, 52, 8);
      g.strokeRoundedRect(4, H - 52, W - 8, 52, 8);
      g.lineStyle(3, WOOD_D, 1);
      g.lineBetween(10, H - 26, W - 10, H - 26);
      for (const x of [W * 0.33, W * 0.66]) g.lineBetween(x, H - 50, x, H - 2);
      g.fillStyle(0x8a5a3b, 1);
      for (let x = 20; x < W - 20; x += 26) g.fillCircle(x, H - 58, 3);
    },
  },

  baeumchen: {
    id: 'baeumchen',
    name: 'Bäumchen',
    sprite: 'baeumchen',
    kind: 'floor',
    w: 2,
    h: 3,
    flowers: true, // die Feen gießen es (wie Blumen)
    draw(g, W, H) {
      const cx = W / 2;
      // Topf
      g.fillStyle(0xd9774a, 1);
      g.fillPoints([{ x: cx - 40, y: H - 54 }, { x: cx + 40, y: H - 54 }, { x: cx + 30, y: H }, { x: cx - 30, y: H }], true);
      outline(g);
      g.strokePoints([{ x: cx - 40, y: H - 54 }, { x: cx + 40, y: H - 54 }, { x: cx + 30, y: H }, { x: cx - 30, y: H }], true);
      g.fillStyle(0xe8946a, 1);
      g.fillRoundedRect(cx - 46, H - 62, 92, 14, 6);
      // Stamm
      g.fillStyle(0x8a5a3b, 1);
      g.fillRoundedRect(cx - 9, H - 150, 18, 96, 6);
      // Krone
      for (const [dx, dy, r] of [[-34, -170, 46], [34, -172, 46], [0, -200, 52], [-20, -140, 38], [22, -138, 38]]) {
        g.fillStyle(LEAF_D, 1);
        g.fillCircle(cx + dx, H + dy + 4, r);
      }
      for (const [dx, dy, r] of [[-34, -172, 42], [34, -174, 42], [0, -204, 48], [-20, -142, 34], [22, -140, 34]]) {
        g.fillStyle(LEAF, 1);
        g.fillCircle(cx + dx, H + dy, r);
      }
      // Äpfelchen und Blüten
      for (const [dx, dy] of [[-40, -160], [30, -150], [6, -214], [44, -196], [-20, -200]]) {
        g.fillStyle(0xe0566f, 1);
        g.fillCircle(cx + dx, H + dy, 9);
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(cx + dx - 3, H + dy - 3, 3);
      }
      for (const [dx, dy] of [[-8, -168], [52, -170], [-52, -190]]) flower(g, cx + dx, H + dy, 8, 0xffc8e2, 0xffffff, 5);
    },
  },

  giesskanne: {
    id: 'giesskanne',
    name: 'Gießkanne',
    sprite: 'giesskanne',
    kind: 'small',
    w: 1,
    h: 1,
    draw(g, W, H) {
      outline(g);
      // Tülle
      g.fillStyle(0x5fb8ff, 1);
      g.fillPoints([{ x: 50, y: H - 34 }, { x: 74, y: H - 62 }, { x: 78, y: H - 56 }, { x: 56, y: H - 26 }], true);
      g.fillStyle(0x8fd3ff, 1);
      g.fillEllipse(76, H - 60, 12, 8);
      // Bauch
      g.fillStyle(0x5fb8ff, 1);
      g.fillRoundedRect(10, H - 46, 44, 46, 12);
      g.strokeRoundedRect(10, H - 46, 44, 46, 12);
      // Griff
      g.lineStyle(6, 0x3f8acc, 1);
      g.strokeCircle(32, H - 50, 16);
      g.fillStyle(0xffffff, 0.6);
      g.fillRoundedRect(17, H - 38, 8, 24, 4);
      flower(g, 36, H - 22, 7, 0xff9ec7, 0xffffff, 5);
    },
  },

  gartenbank: {
    id: 'gartenbank',
    name: 'Gartenbank',
    sprite: 'gartenbank',
    kind: 'floor',
    w: 3,
    h: 2,
    soft: true,
    surfaces: [{ y: 0.88, x0: 0.3, x1: 2.7 }], // Sitzfläche (Kissen)
    draw(g, W, H) {
      outline(g);
      g.fillStyle(WOOD_D, 1);
      for (const x of [22, W - 30]) g.fillRect(x, H - 40, 10, 40);
      g.fillStyle(WOOD, 1);
      g.fillRoundedRect(8, H - 52, W - 16, 14, 6);
      g.strokeRoundedRect(8, H - 52, W - 16, 14, 6);
      g.fillRoundedRect(14, H - 78, W - 28, 10, 5);
      g.fillRoundedRect(14, H - 94, W - 28, 10, 5);
      g.fillStyle(WOOD_D, 1);
      for (const x of [26, W - 34]) g.fillRect(x, H - 96, 8, 46);
      // Kissen
      g.fillStyle(0xff9ec7, 1);
      g.fillRoundedRect(W / 2 - 30, H - 64, 60, 16, 8);
    },
  },

  haengeblumenkasten: {
    id: 'haengeblumenkasten',
    name: 'Blumenkasten',
    sprite: 'haengeblumenkasten',
    kind: 'wall',
    rail: true,
    w: 1,
    h: 1.25,
    flowers: true,
    draw(g, W, H) {
      // Ketten hinauf zum Haken (der hängt am Eisenarm des Pfostens)
      g.lineStyle(3, 0x5a3a2a, 1);
      g.lineBetween(10, H - 40, W / 2, 4);
      g.lineBetween(W - 10, H - 40, W / 2, 4);
      g.strokeCircle(W / 2, 6, 5);
      // Blumen
      const cols = [0xff7ab8, 0xffd166, 0xc9a6ff];
      for (let i = 0; i < 3; i++) {
        const x = 18 + i * ((W - 36) / 2);
        g.lineStyle(3, LEAF_D, 1);
        g.lineBetween(x, H - 38, x, H - 54 - (i % 2) * 8);
        leafAt(g, x, H - 42, 14, i % 2 ? -0.6 : -2.5);
        flower(g, x, H - 56 - (i % 2) * 8, 9, cols[i % cols.length]);
      }
      // hängende Ranken
      g.lineStyle(3, LEAF_D, 1);
      for (const x of [16, W - 16]) {
        g.lineBetween(x, H - 20, x - 4, H + 6);
        leafAt(g, x - 4, H + 2, 10, 1.6);
      }
      // Kasten
      outline(g);
      g.fillStyle(0xd9774a, 1);
      g.fillRoundedRect(6, H - 40, W - 12, 30, 8);
      g.strokeRoundedRect(6, H - 40, W - 12, 30, 8);
      g.fillStyle(0xe8946a, 1);
      g.fillRect(12, H - 36, W - 24, 6);
    },
  },

  // ---- Pflanzen ----

  karotte: plant('karotte', 'Karotte', 1, 1, (g, W, H, st) => {
    const k = n(st);
    if (k === 3) {
      g.fillStyle(0xff8a2a, 1);
      g.fillTriangle(W / 2 - 13, H - 12, W / 2 + 13, H - 12, W / 2, H + 4);
      outline(g, 2.5);
      g.strokeTriangle(W / 2 - 13, H - 12, W / 2 + 13, H - 12, W / 2, H + 4);
    }
    for (let i = -1; i <= 1; i++) leafAt(g, W / 2, H - 12, 14 + k * 8, -Math.PI / 2 + i * 0.45, i ? LEAF : 0x6fbf5a);
  }, { crop: 0xff8a2a }),

  salat: plant('salat', 'Salat', 1, 1, (g, W, H, st) => {
    const k = n(st);
    const r = 8 + k * 7;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      g.fillStyle(i % 2 ? 0x8fd36a : 0x6fbf5a, 1);
      g.fillCircle(W / 2 + Math.cos(a) * r * 0.7, H - 12 + Math.sin(a) * r * 0.6, r * 0.6);
    }
    g.fillStyle(0xb8e88a, 1);
    g.fillCircle(W / 2, H - 14 - r * 0.3, r * 0.45);
  }, { crop: 0x8fd36a }),

  erdbeere: plant('erdbeere', 'Erdbeere', 1, 1, (g, W, H, st) => {
    const k = n(st);
    for (let i = -1; i <= 1; i++) leafAt(g, W / 2, H - 12, 12 + k * 5, -Math.PI / 2 + i * 0.8);
    if (k >= 2) flower(g, W / 2 + 12, H - 30 - k * 3, 6, 0xffffff, 0xffd166, 5);
    if (k === 3) {
      for (const dx of [-16, 14]) {
        g.fillStyle(0xe0364f, 1);
        g.fillTriangle(W / 2 + dx - 8, H - 22, W / 2 + dx + 8, H - 22, W / 2 + dx, H - 6);
        g.fillCircle(W / 2 + dx, H - 20, 8);
        g.fillStyle(0xfff3a8, 1);
        g.fillCircle(W / 2 + dx - 3, H - 18, 1.5);
        g.fillCircle(W / 2 + dx + 2, H - 14, 1.5);
        g.fillStyle(LEAF_D, 1);
        g.fillTriangle(W / 2 + dx - 6, H - 27, W / 2 + dx + 6, H - 27, W / 2 + dx, H - 22);
      }
    }
  }, { crop: 0xe0364f }),

  kuerbis: plant('kuerbis', 'Kürbis', 2, 1, (g, W, H, st) => {
    const k = n(st);
    g.lineStyle(4, LEAF_D, 1);
    g.lineBetween(20, H - 12, W - 20, H - 14);
    for (const x of [30, W / 2, W - 30]) leafAt(g, x, H - 12, 10 + k * 6, -Math.PI / 2 - 0.4);
    if (k >= 2) {
      const r = k === 3 ? 26 : 12;
      const col = k === 3 ? 0xff9a3c : 0xc9d66a;
      g.fillStyle(col, 1);
      g.fillEllipse(W / 2 + 10, H - 6 - r * 0.8, r * 2.3, r * 1.7);
      g.lineStyle(2.5, 0xc96a1a, 0.7);
      g.strokeEllipse(W / 2 + 10, H - 6 - r * 0.8, r * 1.1, r * 1.7);
      outline(g, 2.5);
      g.strokeEllipse(W / 2 + 10, H - 6 - r * 0.8, r * 2.3, r * 1.7);
      g.fillStyle(LEAF_D, 1);
      g.fillRect(W / 2 + 7, H - 10 - r * 1.6, 6, 10);
    }
  }, { crop: 0xff9a3c }),

  tomate: plant('tomate', 'Tomate', 1, 2, (g, W, H, st) => {
    const k = n(st);
    const h = 30 + k * 32;
    // Stab
    g.fillStyle(0xc98b5a, 1);
    g.fillRect(W / 2 + 14, H - h - 14, 6, h + 6);
    stem(g, W / 2, H - 10, h, 2 + k, 18);
    if (k === 3) {
      for (const [dx, dy] of [[-14, -0.45], [12, -0.6], [-8, -0.8]]) {
        g.fillStyle(0xe0364f, 1);
        g.fillCircle(W / 2 + dx, H - 10 + h * dy, 10);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(W / 2 + dx - 3, H - 13 + h * dy, 3);
      }
    } else if (k === 2) {
      flower(g, W / 2 - 10, H - 10 - h * 0.6, 6, 0xffe066, 0xff9a3c, 5);
    }
  }, { crop: 0xe0364f }),

  sonnenblume: plant('sonnenblume', 'Sonnenblume', 1, 2, (g, W, H, st) => {
    const k = n(st);
    const h = 28 + k * 30; // reif: Blüte passt ganz ins Bild (2 Felder hoch)
    stem(g, W / 2, H - 10, h, 1 + k, 20);
    if (k === 3) {
      flower(g, W / 2, H - 10 - h, 24, 0xffc93a, 0x7a4a1a, 12);
      g.fillStyle(0x5a3414, 1);
      for (let i = 0; i < 6; i++) g.fillCircle(W / 2 - 5 + (i % 3) * 5, H - 14 - h + Math.floor(i / 3) * 6, 1.6);
    } else if (k === 2) {
      g.fillStyle(LEAF, 1);
      g.fillCircle(W / 2, H - 10 - h, 10);
    }
  }, { tag: 0xffc93a }),

  tulpe: plant('tulpe', 'Tulpen', 1, 1, (g, W, H, st) => {
    const k = n(st);
    const cols = [0xff5f8a, 0xffd166, 0xc9a6ff];
    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 18 + i * 18;
      const h = 14 + k * 12 - (i % 2) * 6;
      g.lineStyle(3.5, LEAF_D, 1);
      g.lineBetween(x, H - 10, x, H - 10 - h);
      leafAt(g, x, H - 12, 12 + k * 3, i === 0 ? -2.2 : -0.9);
      if (k === 3) {
        g.fillStyle(cols[i], 1);
        g.fillEllipse(x, H - 14 - h, 14, 18);
        g.fillTriangle(x - 7, H - 20 - h, x - 2, H - 30 - h, x + 1, H - 20 - h);
        g.fillTriangle(x + 7, H - 20 - h, x + 2, H - 30 - h, x - 1, H - 20 - h);
      } else if (k === 2) {
        g.fillStyle(LEAF, 1);
        g.fillEllipse(x, H - 12 - h, 8, 12);
      }
    }
  }, { tag: 0xff5f8a }),
};
