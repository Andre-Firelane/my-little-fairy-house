import Phaser from 'phaser';
import { CELL, STICKER_PAD, textureKey, lookState } from '../config/furniture.js';
import { drawNotes } from '../systems/chalk.js';
import { bakedImage } from '../systems/bake.js';

const OVERLAY_MARGIN = 8; // Rand, falls eine Überlagerung etwas über die Zeichnung hinausragt
let overlayCount = 0;

// eine wiederverwendete Hilfs-Graphics je Szene (nur zum Backen, wird nie angezeigt)
function scratchGraphics(scene) {
  if (!scene.overlayGfx || !scene.overlayGfx.scene) scene.overlayGfx = scene.make.graphics({}, false);
  return scene.overlayGfx;
}

// Einrichtungsgegenstand im Raum.
// Ursprung = Mitte der Unterkante (so federt er beim Aufploppen vom Boden aus).
// Das Aussehen folgt dem Item: Variante, Zustand, Vorrat, Füllung (liquid), Tafel-Notizen.
export default class Sticker extends Phaser.GameObjects.Container {
  constructor(scene, def, look = {}) {
    super(scene, 0, 0);
    this.def = def;
    this.item = null;
    this.carried = false; // gerade von einer Fee getragen
    this.W = def.w * CELL;
    this.H = def.h * CELL;
    const oy = (this.H + STICKER_PAD) / (this.H + STICKER_PAD * 2);

    // Möbel stehen auf dem Boden: nur ein weicher Kontaktschatten
    if (def.kind === 'floor') {
      const shadow = bakedImage(scene, 'contact-shadow', 104, 24, (g) => {
        g.fillStyle(0x3b2a4a, 0.18);
        g.fillEllipse(0, 0, 100, 18);
      });
      this.add(shadow.setPosition(0, -4).setScale((this.W * 0.9) / 100, 1));
    }
    this.img = scene.make.image({ x: 0, y: 0, key: textureKey(def.id) }, false).setOrigin(0.5, oy);
    this.add(this.img);

    // Überlagerungen (Flüssigkeit, Kreide) zeichnen in Art-Koordinaten (Ursprung oben links der Zeichnung).
    // Sie werden in eine eigene Textur gebacken und nur bei einer Änderung neu gemalt – eine live gezeichnete
    // Phaser.Graphics würde in JEDEM Bild neu in Dreiecke zerlegt (bei vielen gefüllten Gläsern sehr teuer).
    this.overlays = [];
    if (def.liquid) this.liquidLayer = this.overlay();
    if (def.board) this.boardLayer = this.overlay();
    this.setLook(look);
  }

  overlay() {
    const M = OVERLAY_MARGIN;
    const key = `overlay-${++overlayCount}`;
    const tex = this.scene.textures.addDynamicTexture(key, this.W + M * 2, this.H + M * 2);
    const img = this.scene.make.image({ x: -this.W / 2 - M, y: -this.H - M, key }, false).setOrigin(0).setVisible(false);
    this.add(img);
    this.overlays.push(tex);
    return img;
  }

  // Überlagerung neu backen; draw(g) zeichnet in Art-Koordinaten (false = nichts zu zeigen)
  paintOverlay(img, draw) {
    const g = scratchGraphics(this.scene).clear();
    const any = draw(g) !== false;
    const tex = img.texture;
    tex.clear();
    if (any) tex.draw(g, OVERLAY_MARGIN, OVERLAY_MARGIN);
    img.setVisible(any);
  }

  destroy(fromScene) {
    const textures = this.overlays;
    this.overlays = [];
    super.destroy(fromScene);
    textures?.forEach((t) => t.destroy());
  }

  setLook(item = {}) {
    this.img.setTexture(textureKey(this.def.id, item.v || 0, lookState(this.def, item)));
    this.setLiquid(item.liquid ?? null, 1, item.foam ?? 0);
    this.renderBoard(item.notes);
    return this;
  }

  // extra: Zusatzwert für die Zeichnung (Badewanne: Schaummenge 0..1)
  setLiquid(color, alpha = 1, extra = 0) {
    if (!this.liquidLayer) return;
    const c = color ?? this.def.emptyLiquid;
    const key = c == null ? null : `${c}/${alpha}/${extra}`;
    if (key === this.liquidKey) return; // unverändert: nicht neu backen
    this.liquidKey = key;
    this.paintOverlay(this.liquidLayer, (g) => (c == null ? false : this.def.liquid(g, c, alpha, extra)));
  }

  renderBoard(notes = [], partial = null) {
    if (!this.boardLayer) return;
    this.paintOverlay(this.boardLayer, (g) => {
      if (!notes?.length && !partial) return false;
      drawNotes(g, this.def.board, notes || [], partial, this.def.chalk);
    });
  }

  // Art-Koordinaten → Raum-Koordinaten
  artToLocal(ax, ay) {
    return { x: this.x + ax - this.W / 2, y: this.y + ay - this.H };
  }

  liquidPos() {
    return this.artToLocal(this.def.liquidCenter.x, this.def.liquidCenter.y);
  }

  // Trefferprüfung in Raum-Koordinaten
  containsLocal(lx, ly) {
    return Math.abs(lx - this.x) <= this.W / 2 + 10 && ly <= this.y + 10 && ly >= this.y - this.H - 10;
  }
}
