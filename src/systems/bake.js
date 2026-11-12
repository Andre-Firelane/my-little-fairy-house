// Statische Zeichnungen einmal in eine Textur "backen".
// Hintergrund: Phaser.Graphics wird bei WebGL in JEDEM Bild neu in Dreiecke zerlegt – bei vielen Formen
// (Baumkrone, Rinde, Räume, Feen) bremst das Tablets stark aus. Ein gebackenes Bild kostet fast nichts.
//
// draw(g) zeichnet wie gewohnt in einem w×h-Bereich; (ox, oy) ist die Stelle der Textur, auf der der
// Zeichnungs-Ursprung 0,0 landet (z. B. Mitte, wenn die Zeichnung um 0,0 zentriert ist).
// res < 1 rechnet die Textur herunter (große Hintergründe auf dem Tablet, siehe config/quality.js).
export function bake(scene, key, w, h, draw, ox = 0, oy = 0, res = 1) {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  draw(g);
  g.setScale(res);
  const tex = scene.textures.addDynamicTexture(key, Math.ceil(w * res), Math.ceil(h * res));
  tex.draw(g, ox * res, oy * res);
  g.destroy();
  return key;
}

// Bild aus einer gebackenen Zeichnung, so platziert, dass der Zeichnungs-Ursprung bei (x, y) liegt
// und alles so groß erscheint wie gezeichnet (auch wenn heruntergerechnet).
export function bakedImage(scene, key, w, h, draw, { ox = w / 2, oy = h / 2, res = 1, x = 0, y = 0 } = {}) {
  bake(scene, key, w, h, draw, ox, oy, res);
  return scene.add.image(x, y, key).setOrigin(ox / w, oy / h).setScale(1 / res);
}

// Große Zeichnung (z. B. der ganze Baum) in Kacheln backen – Tablets können oft nur Texturen bis 2048–4096 px.
// Die Zeichnung wird für jede Kachel einmal ausgeführt (nur beim Start). Legt die Bilder an Weltposition 0,0.
export function bakeTiles(scene, key, w, h, draw, { res = 1, tile = 1200, depth = 0 } = {}) {
  const images = [];
  for (let ty = 0; ty < h; ty += tile) {
    for (let tx = 0; tx < w; tx += tile) {
      const tw = Math.min(tile, w - tx);
      const th = Math.min(tile, h - ty);
      const k = bake(scene, `${key}-${tx}-${ty}`, tw, th, draw, -tx, -ty, res);
      images.push(scene.add.image(tx, ty, k).setOrigin(0).setScale(1 / res).setDepth(depth));
    }
  }
  return images;
}

// Wie bakeTiles, aber mit Canvas-2D gemalt (Muster-Füllungen, gemalte Bilder): paint(ctx) malt in Weltkoordinaten,
// für jede Kachel einmal (nur beim Start). (x0, y0) = linke obere Ecke des Bereichs in der Welt.
export function paintTiles(scene, key, w, h, paint, { res = 1, tile = 1200, depth = 0, x0 = 0, y0 = 0 } = {}) {
  const images = [];
  for (let ty = 0; ty < h; ty += tile) {
    for (let tx = 0; tx < w; tx += tile) {
      const tw = Math.min(tile, w - tx);
      const th = Math.min(tile, h - ty);
      const k = `${key}-${tx}-${ty}`;
      if (!scene.textures.exists(k)) {
        const tex = scene.textures.createCanvas(k, Math.ceil(tw * res), Math.ceil(th * res));
        const ctx = tex.getContext();
        ctx.setTransform(res, 0, 0, res, -(x0 + tx) * res, -(y0 + ty) * res);
        paint(ctx);
        tex.refresh();
      }
      images.push(scene.add.image(x0 + tx, y0 + ty, k).setOrigin(0).setScale(1 / res).setDepth(depth));
    }
  }
  return images;
}
