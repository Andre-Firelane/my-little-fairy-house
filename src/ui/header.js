import { bakedImage } from '../systems/bake.js';

// Weißer Kopf für Hauptmenü und Ladebildschirm: das Logo steht auf Weiß (es hat einen weißen Hintergrund),
// unten trennt eine geschwungene Linie den Kopf vom farbigen Rest. w = Breite, h = Höhe bis zur Mitte der Welle.
export function headerImage(scene, w, h) {
  const wave = (x) => h + Math.sin((x / w) * Math.PI * 2 * 1.5 + 0.6) * 34;
  const pts = (dy = 0) => {
    const out = [{ x: 0, y: 0 }, { x: w, y: 0 }];
    for (let x = w; x >= 0; x -= 20) out.push({ x, y: wave(x) + dy });
    return out;
  };
  return bakedImage(scene, `head-${w}-${h}`, w, h + 70, (g) => {
    g.fillStyle(0x3b2a6b, 0.18); // weicher Schatten unter der Welle
    g.fillPoints(pts(12), true);
    g.fillStyle(0xe2b6ff, 1); // lila Saum
    g.fillPoints(pts(7), true);
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts(), true);
  }, { ox: 0, oy: 0 });
}
