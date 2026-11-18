// Themenkleider: Eine Fee in einem Themenkleid fliegt lieber in die passenden Räume (erster Raum = Lieblingsraum)
// und bleibt dort länger. Sie besucht aber weiterhin alle anderen Räume – das ist nur eine Vorliebe.
// Schlüssel = Kleid-Nummer (dress-<n>, config/fairyLooks.js), Werte = Raum-ids aus config/rooms.js.
// Kleider ohne Eintrag (3, 4) haben keinen Lieblingsraum.

export const DRESS_ROOMS = {
  // Pflanzenkleider
  6: ['garten', 'kitchen'], // Blätterkleid – Kräuter in der Zauberküche
  17: ['garten', 'kitchen'], // Waldkleid mit Pilzen
  1: ['garten', 'teesalon'], // Mintkleid mit Blattgürtel – Kräutertee
  5: ['garten', 'teesalon'], // rosa Blütenkleid
  8: ['garten', 'atelier'], // gelbes Blumenkleid – Blumen malen
  2: ['garten', 'kueche'], // Herbstlaubkleid – Ernte, Backen
  // Sternenkleider
  7: ['sternwarte', 'bedroom'], // dunkelblau mit Sternen
  18: ['sternwarte', 'bedroom'], // Sternenkleid mit Mond
  10: ['kitchen', 'sternwarte', 'library'], // lila Zauberinnenrobe
  // übrige Themenkleider
  15: ['library', 'kitchen', 'sternwarte'], // Wissenschaftskleid
  16: ['werkstatt', 'atelier'], // Tinkerkleid – Werkstatt, Töpfern
  11: ['turnraum', 'musik'], // Turnkleid – Tanzen
  12: ['kueche', 'kitchen', 'teesalon'], // Feuerkleid
  13: ['bad', 'musik'], // Eiskleid – Eistanz
  9: ['bad', 'teesalon'], // hellblaues Rüschenkleid (Wasser)
  14: ['atelier', 'musik'], // Regenbogenkleid – Disco
};

export const FAVORITE_WEIGHT = 4; // Lieblingsraum: so viel wahrscheinlicher als ein beliebiger Raum
export const LIKED_WEIGHT = 2.5; // weitere passende Räume
export const STAY_CHANCE = 0.6; // in einem passenden Raum: so oft bleibt die Fee, statt weiterzufliegen

// Gewicht eines Raum-Typs für eine Fee (1 = keine Vorliebe)
export function roomPreference(f, roomType) {
  const rooms = DRESS_ROOMS[f.look?.dress];
  const i = rooms ? rooms.indexOf(roomType) : -1;
  if (i < 0) return 1;
  return i === 0 ? FAVORITE_WEIGHT : LIKED_WEIGHT;
}
