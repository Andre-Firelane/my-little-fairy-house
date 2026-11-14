import { UI_W, GAME_W, GAME_H, uiLeft } from '../config/layout.js';
import { FAIRY_PARTS, PART_BOXES, partKey } from '../config/fairyLooks.js';
import { buildPaintedFigure, flapWings } from '../objects/Fairy.js';
import { setSavedLook } from '../state/looks.js';
import { bakedImage } from '../systems/bake.js';
import { wingFlap } from '../systems/motion.js';
import { popIn, squish } from '../systems/juice.js';
import { cardImage, pillImage, iconButton } from './panels.js';

// Fee anpassen: Overlay mit großer Vorschau und Reitern (ohne Schrift).
// Gewählt wird sofort – die Fee (und alle Feen mit demselben Namen) ändert sich gleich mit, der Spielstand merkt es sich.
// Neue Teile in config/fairyLooks.js (FAIRY_PARTS) erscheinen hier von selbst.

const PANEL_Y = 930;
const PANEL_W = 980;
const PANEL_H = 1560;
const PREVIEW_Y = 520;
const PREVIEW_SCALE = 4.4;
const TAB_Y = 880;
const GRID_Y = 1040;
const CELL = 178; // Raster der Auswahl (5 Spalten, bis 15 Teile)
const COLS = 5;
const CARD = 160;

// Reiter: Bildzeichen + Auswahl (Teile einer Ebene oder Farben)
const TABS = [
  { icon: 'face', slot: 'body', zoom: true }, // Fee: Gesicht und Hautfarbe
  { icon: 'hair', slot: 'hair', zoom: true },
  { icon: 'dress', slot: 'dress' },
  { icon: 'wand', slot: 'wand' },
  { icon: 'wings', slot: 'wings' },
];

// Auswahl eines Reiters: alle Teile der Ebene (Schlafanzug/Schürze nicht – die zieht die Fee selbst an)
function optionsOf(tab) {
  const ids = Object.keys(FAIRY_PARTS[tab.slot]).filter((id) => !(tab.slot === 'dress' && (id === 'pj' || id === 'apron')));
  return ids.map((id) => ({ changes: { [tab.slot]: id }, current: (l) => l[tab.slot] === id }));
}

// Vorschaubild eines Teils, um 0,0 zentriert, höchstens size groß
function partThumb(scene, slot, id, size) {
  const part = FAIRY_PARTS[slot][id];
  const key = partKey(part);
  const [x0, y0, x1, y1] = PART_BOXES[part.file];
  if (slot === 'wings') {
    // rechter Flügel + gespiegelter linker, Ansatz in der Mitte
    const box = scene.add.container(0, 0);
    for (const side of [-1, 1]) {
      const img = scene.add.image(0, 0, key).setCrop(x0, y0, x1 - x0, y1 - y0);
      img.setOrigin(x0 / img.width, (y0 + y1) / 2 / img.height).setScale(side, 1);
      box.add(img);
    }
    return box.setScale(size / Math.max(2 * (x1 - x0), y1 - y0));
  }
  // Fee: nur der Kopf (Gesicht und Hautfarbe zählen)
  const h = slot === 'body' ? (y1 - y0) * 0.42 : y1 - y0;
  const img = scene.add.image(0, 0, key).setCrop(x0, y0, x1 - x0, h);
  img.setOrigin((x0 + x1) / 2 / img.width, (y0 + h / 2) / img.height);
  return img.setScale(size / Math.max(x1 - x0, h));
}

export default class FairyLookMenu {
  // scene = RoomEditScene (Bedienung, Kamera um uiLeft verschoben), fairy = angetippte Fee, onClose = Rückruf
  constructor(scene, fairy, onClose) {
    this.scene = scene;
    this.fairy = fairy;
    this.onClose = onClose;
    this.look = { ...fairy.look };
    this.tab = 0;
    this.t = 0;

    const s = scene;
    const m = (this.root = s.add.container(0, 0));
    // dunkler Schleier: fängt alle Berührungen ab, Antippen daneben schließt
    const veil = s.add.rectangle(-uiLeft(), 0, GAME_W, GAME_H, 0x2b2150, 0.6).setOrigin(0).setInteractive();
    veil.on('pointerup', () => this.close());
    const panel = cardImage(s, PANEL_W, PANEL_H, 50, 0xd8b8ff).setPosition(UI_W / 2, PANEL_Y).setInteractive();
    // Bühne für die Vorschau: heller Kreis mit Schein in der Farbe der Fee
    const stage = bakedImage(s, 'look-stage', 560, 560, (g) => {
      g.fillStyle(0xf3e8ff, 1);
      g.fillCircle(0, 0, 270);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(0, 0, 220);
    }).setPosition(UI_W / 2, PREVIEW_Y + 40);
    const glow = s.add.image(UI_W / 2, PREVIEW_Y + 60, 'sparkle').setScale(16).setTint(fairy.palette.glow).setAlpha(0.35);
    this.preview = s.add.container(UI_W / 2, PREVIEW_Y).setScale(PREVIEW_SCALE);
    const done = iconButton(s, UI_W / 2 + PANEL_W / 2 - 110, PANEL_Y - PANEL_H / 2 + 100, 140, 110, 'check', () => this.close());
    this.tabsBox = s.add.container(0, 0);
    this.grid = s.add.container(0, 0);
    m.add([veil, panel, stage, glow, this.preview, done, this.tabsBox, this.grid]);
    m.setAlpha(0);
    s.tweens.add({ targets: m, alpha: 1, duration: 180 });
    popIn(s, panel, { from: 0.85, to: 1, duration: 450 });

    this.buildPreview();
    this.buildTabs();
    this.buildGrid();
    this.onUpdate = (time, delta) => this.update(delta / 1000);
    s.events.on('update', this.onUpdate);
  }

  buildPreview() {
    const { wingL, wingR } = buildPaintedFigure(this.scene, this.preview, this.look, this.fairy.palette, 'dress', 8);
    this.wings = [wingL, wingR];
  }

  update(dt) {
    this.t += dt;
    if (this.wings) flapWings(this.wings[0], this.wings[1], wingFlap(this.t, 9, 0));
    this.preview.y = PREVIEW_Y + Math.sin(this.t * 2) * 8;
  }

  buildTabs() {
    this.tabsBox.removeAll(true);
    const step = 152;
    TABS.forEach((tab, i) => {
      const x = UI_W / 2 + (i - (TABS.length - 1) / 2) * step;
      const on = i === this.tab;
      const b = iconButton(this.scene, x, TAB_Y, 138, 118, tab.icon, () => this.pickTab(i), {
        fill: on ? 0xffe6f4 : 0xfff4fb,
        stroke: on ? 0xff7ab8 : 0xe2b6ff,
        size: 84,
      });
      if (on) b.setScale(1.08);
      this.tabsBox.add(b);
    });
  }

  pickTab(i) {
    if (i === this.tab) return;
    this.tab = i;
    this.buildTabs();
    this.buildGrid();
  }

  buildGrid() {
    const s = this.scene;
    this.grid.removeAll(true);
    const tab = TABS[this.tab];
    this.options = optionsOf(tab);
    this.options.forEach((opt, i) => {
      const x = UI_W / 2 + ((i % COLS) - (COLS - 1) / 2) * CELL;
      const y = GRID_Y + Math.floor(i / COLS) * CELL;
      const c = s.add.container(x, y);
      // nur das Teil selbst (zugeschnitten), Flügel als Paar, bei der Fee der Kopf
      c.add(cardImage(s, CARD, CARD, 28, 0xe2b6ff));
      c.add(partThumb(s, tab.slot, opt.changes[tab.slot], CARD - 30));
      const ring = bakedImage(s, `look-ring-${CARD}`, CARD + 20, CARD + 20, (g) => {
        g.lineStyle(9, 0xff7ab8, 1);
        g.strokeRoundedRect(-CARD / 2 - 5, -CARD / 2 - 5, CARD + 10, CARD + 10, 36);
      }).setVisible(opt.current(this.look));
      c.add(ring);
      c.ring = ring;
      c.setSize(CARD, CARD).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => this.pick(opt, c));
      this.grid.add(c);
    });
  }

  pick(opt, card) {
    this.look = { ...this.look, ...opt.changes };
    setSavedLook(this.fairy.palette.name, opt.changes);
    for (const f of this.scene.allFairies()) if (f.palette.name === this.fairy.palette.name) f.setLook(opt.changes);
    this.buildPreview();
    for (const c of this.grid.list) c.ring.setVisible(false);
    card.ring.setVisible(true);
    squish(this.scene, card, { amount: 0.12 });
    const f = this.fairy;
    f.sparkles?.burst(f.x, f.y, 10);
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    const s = this.scene;
    s.events.off('update', this.onUpdate);
    s.tweens.add({ targets: this.root, alpha: 0, duration: 160, onComplete: () => this.root.destroy() });
    this.onClose?.();
  }
}
