// Die Feen, die nach und nach ins Haus einziehen (je eingerichtetem Zimmer zwei, siehe life/RoomLife.js).
// likes: Gewichtung der Tätigkeiten (Standard 1) – gibt jeder Fee ihre Persönlichkeit
export const FAIRY_PALETTES = [
  { name: 'Pippa', dress: 0xff7ab8, wing: 0xbfe9ff, hair: 0xffd166, glow: 0xffc8f0, likes: { brew: 3, fill: 3, read: 1, write: 1, wipe: 1, dance: 2 } },
  { name: 'Lila', dress: 0x9b7bff, wing: 0xffd6f5, hair: 0x8d5524, glow: 0xb9f2ff, likes: { brew: 1, fill: 1, read: 3, write: 3, wipe: 2 } },
  { name: 'Mia', dress: 0x5fd3ff, wing: 0xfff3a8, hair: 0xe0566f, glow: 0xb9f2ff, likes: { read: 2, write: 2, bath: 3, water: 2 } },
  { name: 'Ronja', dress: 0x7dffb2, wing: 0xd8b8ff, hair: 0x3b2a4a, glow: 0xd8ffe8, likes: { brew: 2, wipe: 2, play: 3, disco: 2 } },
  { name: 'Lotte', dress: 0xffb347, wing: 0xbfe9ff, hair: 0xffe08a, glow: 0xfff3a8, likes: { fill: 2, read: 2, primp: 3, relax: 2 } },
  { name: 'Ida', dress: 0xff8fa8, wing: 0xc8fff0, hair: 0x6b4128, glow: 0xffc8f0, likes: { write: 3, brew: 1, dance: 3 } },
  { name: 'Fina', dress: 0xd8b8ff, wing: 0xfff3a8, hair: 0xffd166, glow: 0xd8b8ff, likes: { sleep: 2, read: 2, bath: 2, relax: 3 } },
  { name: 'Wilma', dress: 0x5fd39a, wing: 0xffc8f0, hair: 0x8d5524, glow: 0xd8ffe8, likes: { brew: 2, fill: 2, play: 2 } },
  { name: 'Smilla', dress: 0xffd166, wing: 0xb9f2ff, hair: 0x3b2a4a, glow: 0xfff3a8, likes: { write: 2, wipe: 2, primp: 2, bath: 2 } },
  { name: 'Tilda', dress: 0x8fa8ff, wing: 0xffe0f0, hair: 0xe0566f, glow: 0xb9f2ff, likes: { sleep: 3, read: 1, play: 3 } },
  { name: 'Juna', dress: 0xff9a3c, wing: 0xd8b8ff, hair: 0xffe08a, glow: 0xffd9a0, likes: { read: 3, brew: 1, disco: 3, dance: 2 } },
  { name: 'Elli', dress: 0xc8fff0, wing: 0xff9ec7, hair: 0x6b4128, glow: 0xc8fff0, likes: { fill: 2, sleep: 2, primp: 3 } },
];

// Kleine Geister der Geisterstunde (events/ghostHour.js): zarte Bettlaken-Farben, eigene Vorlieben.
// sheet = Farbe des Lakens, glow = Schein, likes wie bei den Feen
export const GHOST_PALETTES = [
  { name: 'Huschi', sheet: 0xffffff, glow: 0xd8e4ff, likes: { light: 3, disco: 3, dance: 3, play: 2 } },
  { name: 'Wuschel', sheet: 0xe4fff3, glow: 0xc8fff0, likes: { cook: 3, eat: 3, read: 2, light: 2 } },
  { name: 'Flatter', sheet: 0xf1e6ff, glow: 0xe2ccff, likes: { bath: 3, primp: 3, dance: 2, light: 2 } },
  { name: 'Buhbu', sheet: 0xe2f1ff, glow: 0xb9e0ff, likes: { play: 3, read: 3, write: 2, light: 2 } },
  { name: 'Nebeline', sheet: 0xfff0f6, glow: 0xffd6ea, likes: { disco: 3, brew: 2, fill: 2, relax: 2 } },
];
