// Auflösung der großen Hintergrundbilder (1 = volle Auflösung).
// Auf Tablet/Handy etwas runtergerechnet: spart Grafikspeicher und Zeit beim Hochladen auf die Grafikkarte.
// Zum Ausprobieren: ?q=0.5 (weniger) bzw. ?q=1 (voll)
const q = Number(new URLSearchParams(location.search).get('q'));
const touchDevice = matchMedia('(pointer: coarse)').matches;

export const BG_RES = q > 0 ? Math.min(1, q) : touchDevice ? 0.6 : 1;
// Raum-Wände sieht man im Editor groß – dort nicht ganz so stark runterrechnen
export const ROOM_RES = Math.max(BG_RES, 0.7);
// Möbel-Texturen: auf dem Tablet runtergerechnet (weniger Grafikspeicher, schnelleres Zeichnen);
// die Bilder werden dafür entsprechend größer gezogen, damit alles gleich groß bleibt
export const FURN_RES = q > 0 ? Math.min(1, q) : touchDevice ? 0.65 : 1;
