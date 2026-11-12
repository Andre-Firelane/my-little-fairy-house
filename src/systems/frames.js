// Zimmerrahmen aus dem gemalten Bild (Textur 'frame-<form>') in passender Größe zusammensetzen:
// das Bild wird an den Schnittkanten aus roomGeometry zerteilt und Stück für Stück gezeichnet.
// Ergebnis: Canvas-Textur geo.W × geo.H (× res), wird von Raum und Höhle gemeinsam benutzt.

export function frameTexture(scene, geo, res = 1) {
  const key = `framebuilt-${geo.key}-${res}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(`frame-${geo.shape}`).getSourceImage();
  const tex = scene.textures.createCanvas(key, Math.ceil(geo.W * res), Math.ceil(geo.H * res));
  const ctx = tex.getContext();
  ctx.imageSmoothingQuality = 'high';
  const { cols, rows, dstX, dstY } = geo.slices;
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < cols.length - 1; i++) {
      const sw = cols[i + 1] - cols[i];
      const sh = rows[j + 1] - rows[j];
      const dw = (dstX[i + 1] - dstX[i]) * res;
      const dh = (dstY[j + 1] - dstY[j]) * res;
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
      // +0.5 px Überlappung gegen feine Nähte zwischen den Stücken
      ctx.drawImage(src, cols[i], rows[j], sw, sh, dstX[i] * res, dstY[j] * res, dw + 0.5, dh + 0.5);
    }
  }
  tex.refresh();
  return key;
}
