import { fillStar } from '../systems/draw.js';

// Raum-Typen. Der Typ bestimmt Farben, Katalog (was man hineinstellen kann) und Startausstattung;
// Größe und Form bestimmt die Höhle, in die der Raum kommt (config/layout.js → SLOTS).
// draw(g, w, h) zeichnet nur das Vorschaubild für die Karte in der Leiste.
// Neue Räume: einfach hier ergänzen – Kartenleiste und Platzierung lesen diese Liste.

export const ROOMS = [
  {
    id: 'bedroom',
    preview: ['bett', 'nachtlicht', 'kleiderschrank'], // Vorschaubild der Karte (objects/Room.js)
    name: 'Schlafzimmer',
    wall: 0xf7c6d9,
    accent: 0xff8fbf,
    interior: { wall: 0xf7c6d9, wainscot: 0xeeaecb, floor: 0xd9a77a, floorLine: 0xb98a5e },
    catalog: [
      'bett', 'kleiderschrank', 'nachtlicht', 'spieluhr', 'sessel', 'haengesessel', 'buecher',
      'haengeregal', 'regal', 'tisch', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'bett', gx: 1, gy: 0 }],
    furnishedAt: 4,
    draw(g, w, h) {
      const fy = h / 2 - 44; // Fußboden-Linie
      g.fillStyle(0xc98b5a, 1);
      g.fillRoundedRect(-w / 2 + 14, fy, w - 28, 30, { tl: 0, tr: 0, bl: 22, br: 22 });
      // Teppich
      g.fillStyle(0xff9ec7, 1);
      g.fillEllipse(70, fy + 10, 110, 22);
      // rundes Fenster mit Mond
      g.fillStyle(0x3d3a8c, 1);
      g.fillCircle(70, -40, 34);
      g.fillStyle(0xfff3a8, 1);
      g.fillCircle(78, -46, 15);
      g.fillStyle(0x3d3a8c, 1);
      g.fillCircle(86, -52, 13);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(52, -56, 2.5);
      g.fillCircle(58, -24, 2);
      g.lineStyle(6, 0x9c6a43, 1);
      g.strokeCircle(70, -40, 34);
      // Bett
      g.fillStyle(0x9c6a43, 1);
      g.fillRoundedRect(-128, -20, 26, fy + 20, 10);
      g.fillRect(-128, fy - 28, 190, 28);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-112, fy - 48, 172, 24, 10);
      g.fillStyle(0x8fa8ff, 1);
      g.fillRoundedRect(-68, fy - 56, 132, 34, 14);
      g.fillStyle(0xb4c4ff, 1);
      g.fillRoundedRect(-68, fy - 56, 132, 10, { tl: 14, tr: 14, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(-104, fy - 66, 44, 22, 10);
      // Lichterkette
      const bulbs = [0xfff3a8, 0xb9f2ff, 0xffc8f0];
      for (let i = 0; i < 8; i++) {
        g.fillStyle(bulbs[i % 3], 1);
        g.fillCircle(-105 + i * 30, -72 + Math.sin(i * 0.9) * 6, 6);
      }
    },
  },
  {
    id: 'kitchen',
    preview: ['kessel', 'kraeuter', 'blaetter', { id: 'tafel', above: 1 }],
    name: 'Zauberküche',
    wall: 0xbfe8d4,
    accent: 0x5fd39a,
    // einrichtbar: Innenraum + Sticker-Katalog + Startausstattung (Raster-Zellen)
    interior: { wall: 0xbfe8d4, wainscot: 0xa6d9c0, floor: 0xe3cfa6, floorLine: 0xc4ab7e },
    catalog: [
      'kessel', 'kraeuter', 'blaetter', 'mondwasser', 'kolben', 'phiole', 'becher',
      'regal', 'haengeregal', 'tisch', 'sessel', 'tafel', 'buecher', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'kessel', gx: 1, gy: 0 }],
    furnishedAt: 4, // ab so vielen Gegenständen gilt das Zimmer als eingerichtet → eine Fee zieht ein
    // draw() = Vorschau auf der Karte in der Baum-Leiste
    draw(g, w, h) {
      const fy = h / 2 - 44;
      // Fliesenboden
      for (let i = 0; i < 9; i++) {
        g.fillStyle(i % 2 ? 0xf2e6c9 : 0xd9c7a0, 1);
        g.fillRect(-w / 2 + 14 + i * 30.2, fy, 30.2, 30);
      }
      // Regal mit Tränken
      g.fillStyle(0x9c6a43, 1);
      g.fillRect(38, -28, 96, 8);
      g.fillRect(38, 22, 96, 8);
      const bottles = [
        [56, -28, 0xff7ab8], [86, -28, 0x9b7bff], [116, -28, 0x5fd3ff],
        [60, 22, 0xffd166], [96, 22, 0x7dffb2],
      ];
      for (const [x, y, c] of bottles) {
        g.fillStyle(c, 1);
        g.fillCircle(x, y - 12, 12);
        g.fillRect(x - 4, y - 32, 8, 12);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(x - 4, y - 16, 3);
      }
      // Feuer
      g.fillStyle(0xff9a3c, 1);
      g.fillTriangle(-80, fy + 2, -60, fy - 34, -44, fy + 2);
      g.fillTriangle(-50, fy + 2, -34, fy - 40, -18, fy + 2);
      g.fillStyle(0xffd166, 1);
      g.fillTriangle(-66, fy + 2, -52, fy - 20, -40, fy + 2);
      // Kessel
      g.fillStyle(0x3b3355, 1);
      g.fillEllipse(-46, fy - 58, 124, 84);
      g.fillStyle(0x56507a, 1);
      g.fillEllipse(-46, fy - 96, 128, 26);
      g.fillStyle(0x7dffb2, 1);
      g.fillEllipse(-46, fy - 96, 106, 16);
      // Blasen
      g.fillStyle(0xb6ffd6, 1);
      g.fillCircle(-60, fy - 116, 9);
      g.fillCircle(-34, fy - 128, 6);
      g.fillCircle(-50, fy - 142, 4);
    },
  },
  {
    id: 'kueche',
    preview: ['ofen', 'unterschrank', { id: 'obstschale', on: 1 }, { id: 'wandleiste', above: 1 }],
    name: 'Küche',
    wall: 0xfbd5bd,
    accent: 0xffa94d,
    interior: { wall: 0xfbd5bd, wainscot: 0xf2b996, floor: 0xe3cfa6, floorLine: 0xc4ab7e },
    catalog: [
      'ofen', 'unterschrank', 'vorratsregal', 'wandleiste', 'haengeschrank', 'gewuerze', 'obstschale', 'brot', 'kuchen',
      'tisch', 'regal', 'haengeregal', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'ofen', gx: 1, gy: 0 }],
    furnishedAt: 4,
    // Vorschaubild für die Karte
    draw(g, w, h) {
      const fy = h / 2 - 44;
      g.fillStyle(0xe3cfa6, 1);
      g.fillRoundedRect(-w / 2 + 14, fy, w - 28, 30, { tl: 0, tr: 0, bl: 22, br: 22 });
      // Kochleiste
      g.fillStyle(0xd9a066, 1);
      g.fillRect(-20, -72, 110, 6);
      g.fillStyle(0xb9c4d0, 1);
      g.fillRect(0, -66, 4, 26);
      g.fillCircle(2, -38, 7);
      g.fillStyle(0xd9a066, 1);
      g.fillRect(40, -66, 4, 22);
      g.fillEllipse(42, -38, 10, 14);
      // Ofen
      g.fillStyle(0x4a4060, 1);
      g.fillRoundedRect(-126, fy - 96, 104, 96, 10);
      g.fillStyle(0x3b3355, 1);
      g.fillRect(-130, fy - 100, 112, 10);
      g.fillStyle(0xff9a3c, 1);
      g.fillRoundedRect(-108, fy - 62, 68, 38, 8);
      g.fillStyle(0xffd166, 1);
      g.fillRoundedRect(-100, fy - 48, 52, 16, 6);
      // Unterschrank mit Arbeitsplatte und Obstschale
      g.fillStyle(0xc98b5a, 1);
      g.fillRect(4, fy - 58, 118, 58);
      g.fillStyle(0xf2e6c9, 1);
      g.fillRoundedRect(0, fy - 66, 126, 12, 4);
      g.fillStyle(0xe0566f, 1);
      g.fillCircle(50, fy - 80, 9);
      g.fillStyle(0xffd166, 1);
      g.fillCircle(64, fy - 82, 8);
      g.fillStyle(0x8fd3ff, 1);
      g.slice(58, fy - 72, 22, 0, Math.PI, false);
      g.fillPath();
      // Brot
      g.fillStyle(0xd9a066, 1);
      g.fillEllipse(100, fy - 76, 34, 18);
    },
  },
  {
    id: 'library',
    preview: ['buecherregal', 'schreibtisch', { id: 'leselampe', on: 1 }],
    name: 'Bibliothek',
    wall: 0xd9c8f2,
    accent: 0x9b7bff,
    interior: { wall: 0xd9c8f2, wainscot: 0xc4aee8, floor: 0xc9a27a, floorLine: 0xa8825c },
    catalog: [
      'schreibtisch', 'leselampe', 'buecherregal', 'schriftrolle',
      'regal', 'buecher', 'sessel', 'haengesessel', 'tisch', 'tafel', 'haengeregal', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'buecherregal', gx: 0, gy: 0, or: 'regal' }], // passt die Bücherwand nicht in die Höhle: normales Regal
    furnishedAt: 4,
    draw(g, w, h) {
      const fy = h / 2 - 44;
      g.fillStyle(0xb07a50, 1);
      g.fillRoundedRect(-w / 2 + 14, fy, w - 28, 30, { tl: 0, tr: 0, bl: 22, br: 22 });
      g.fillStyle(0x8fd3ff, 1);
      g.fillEllipse(60, fy + 10, 120, 22);
      // Bücherregal
      g.fillStyle(0x8a5a3b, 1);
      g.fillRect(-128, -66, 112, fy + 66);
      g.fillStyle(0x6b4128, 1);
      g.fillRect(-120, -58, 96, fy + 50);
      const colors = [0xff7ab8, 0xffd166, 0x5fd3ff, 0x9b7bff, 0x7dffb2, 0xff9a3c];
      const heights = [30, 36, 26, 38, 32, 28, 34, 30];
      const rows = [-18, 30, fy - 8];
      rows.forEach((bottom, r) => {
        g.fillStyle(0x8a5a3b, 1);
        g.fillRect(-120, bottom, 96, 7);
        let x = -118;
        for (let i = 0; x < -30; i++) {
          const bw = 11 + ((i + r) % 3) * 2;
          const bh = heights[(i + r * 3) % heights.length];
          g.fillStyle(colors[(i + r * 2) % colors.length], 1);
          g.fillRect(x, bottom - bh, bw, bh);
          x += bw + 1.5;
        }
      });
      // Sessel
      g.fillStyle(0xe0566f, 1);
      g.fillRoundedRect(36, -14, 84, 70, 24);
      g.fillRoundedRect(22, 28, 112, 42, 14);
      g.fillStyle(0xc9445c, 1);
      g.fillRoundedRect(22, 22, 22, 50, 10);
      g.fillRoundedRect(112, 22, 22, 50, 10);
      // Sternlampe
      g.lineStyle(3, 0x6b4128, 1);
      g.lineBetween(78, -h / 2 + 14, 78, -72);
      g.fillStyle(0xfff3a8, 1);
      fillStar(g, 78, -54, 24, 10, 5);
    },
  },
  {
    id: 'bad',
    preview: ['badewanne', 'pflegeschrank', { id: 'spiegelschrank', above: 1 }, { id: 'quietscheente', on: 0 }],
    name: 'Badezimmer',
    wall: 0xc6e2f7,
    accent: 0x5fb8ff,
    interior: { wall: 0xc6e2f7, wainscot: 0xa9d0ee, floor: 0xeee4d6, floorLine: 0xc9b9a3, pattern: 'tiles' },
    catalog: [
      'badewanne', 'spiegelschrank', 'pflegeschrank', 'quietscheente',
      'regal', 'haengeregal', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'badewanne', gx: 1, gy: 0 }],
    furnishedAt: 4,
  },
  {
    id: 'musik',
    preview: ['harfe', 'piano', { id: 'discokugel', above: 1 }, { id: 'trompete', on: 1 }],
    name: 'Musikzimmer',
    wall: 0xf6d8ef,
    accent: 0xff7ad9,
    interior: { wall: 0xf6d8ef, wainscot: 0xe9bfe0, floor: 0xc99a74, floorLine: 0xa87c58 },
    catalog: [
      'piano', 'harfe', 'laute', 'floete', 'trompete', 'tanzflaeche', 'discokugel',
      'sessel', 'regal', 'haengeregal', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'piano', gx: 1, gy: 0 }],
    furnishedAt: 4,
  },
  {
    id: 'werkstatt',
    preview: ['werkbank', 'saege', { id: 'werkzeugleiste', above: 0 }],
    name: 'Werkstatt',
    wall: 0xf2dcb8,
    accent: 0xd9894a,
    interior: { wall: 0xf2dcb8, wainscot: 0xe0c497, floor: 0xb98a5e, floorLine: 0x9c6a43 },
    catalog: [
      'werkbank', 'werkzeugkasten', 'werkzeugleiste', 'saege', 'schuerzengarderobe',
      'regal', 'haengeregal', 'tisch', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'werkbank', gx: 1, gy: 0 }],
    furnishedAt: 4,
  },
  {
    id: 'turnraum',
    preview: ['turnkasten', 'kletterwand', { id: 'turnringe', above: 0 }],
    name: 'Turnraum',
    wall: 0xcfe8fb,
    accent: 0x4fb0e8,
    interior: { wall: 0xcfe8fb, wainscot: 0xb2d5f0, floor: 0xe6c08a, floorLine: 0xc9a066 },
    catalog: [
      'turnmatte', 'turnkasten', 'kletterwand', 'turnringe', 'medizinball',
      'regal', 'haengeregal', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'deckenlampe', 'vase',
    ],
    preset: [{ id: 'turnmatte', gx: 1, gy: 0 }],
    furnishedAt: 4,
  },
  {
    // Malatelier: Staffelei (Bilder malen → hängen danach an der Wand), Töpferscheibe (Vasen drehen)
    id: 'atelier',
    preview: ['staffelei', 'toepferscheibe', { id: 'trockenleine', above: 1 }],
    name: 'Malatelier',
    wall: 0xfff1dc,
    accent: 0xff8f5c,
    interior: { wall: 0xfff1dc, wainscot: 0xf6dcbc, floor: 0xd9b48a, floorLine: 0xb8946a },
    catalog: [
      'staffelei', 'farbtoepfe', 'pinselbecher', 'toepferscheibe', 'trockenleine',
      'regal', 'haengeregal', 'tisch', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'staffelei', gx: 1, gy: 0 }],
    furnishedAt: 4,
  },
  {
    // Teesalon: Teestunde am Pilztisch – die Feen trinken gemeinsam Tee
    id: 'teesalon',
    preview: ['bluetensofa', 'teetisch', { id: 'teekanne', on: 1 }],
    name: 'Teesalon',
    wall: 0xf6d3da,
    accent: 0x5fcfa6,
    interior: { wall: 0xf6d3da, wainscot: 0xe9b9c4, floor: 0xc99a74, floorLine: 0xa87c58 },
    catalog: [
      'teetisch', 'teekanne', 'teetassen', 'bluetensofa', 'kamin', 'etagere', 'grammophon',
      'regal', 'haengeregal', 'sessel', 'stehpflanze', 'haengepflanze',
      'bild', 'fenster', 'teppich', 'deckenlampe', 'vase', 'kerze',
    ],
    preset: [{ id: 'teetisch', gx: 1, gy: 0 }],
    furnishedAt: 4,
  },
  {
    // Balkon-Garten: kein Zimmer im Stamm, sondern eine offene Holzplattform außen am Baum (nur auf die
    // Balkon-Plätze, siehe layout.js). Ohne Wand: dahinter ist Himmel, oben eine Pergola, außen an den Pfosten hängen Blumenkästen.
    id: 'garten',
    open: true,
    preview: ['hochbeet', 'baeumchen', { id: 'sonnenblume', on: 0 }],
    name: 'Garten',
    wall: 0xcdeeff,
    accent: 0x6fcf6a,
    interior: { wall: 0xcdeeff, wainscot: 0xa8d8a0, floor: 0xc98b5a, floorLine: 0xa86d40 },
    catalog: [
      'hochbeet', 'baeumchen', 'giesskanne', 'gartenbank', 'haengeblumenkasten',
      'karotte', 'salat', 'erdbeere', 'kuerbis', 'tomate', 'sonnenblume', 'tulpe',
      'stehpflanze', 'haengepflanze',
    ],
    preset: [{ id: 'hochbeet', gx: 1, gy: 0 }],
    furnishedAt: 4,
  },
];

export const roomById = (id) => ROOMS.find((r) => r.id === id);
