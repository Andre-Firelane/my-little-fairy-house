import Phaser from 'phaser';
import { GAME_W, GAME_H, UI_W, FONT } from '../config/layout.js';
import { roomById } from '../config/rooms.js';
import { cardImage, pillImage } from '../ui/panels.js';
import { iconImage } from '../ui/icons.js';
import { bakedImage } from '../systems/bake.js';
import { headerImage } from '../ui/header.js';
import { popIn, squish, wobble } from '../systems/juice.js';
import { makeRng } from '../systems/motion.js';
import { resetGame } from '../state/house.js';
import { save, readSave, loadSave, deleteSave } from '../state/save.js';

// Hauptmenü – aufgebaut wie in My Little Zoo (ui/startScreen.js dort); hier für die Eltern auch mit Schrift (Icon + Text):
//  - Weiterspielen (Play-Pfeil, Datum des Spielstands und seine Zimmer); ohne Spielstand gedimmt
//  - Neues Spiel (Stern); gibt es einen Spielstand, erst Rückfrage (Kreuz = nein, Mülleimer = ja)
//  - Test-Spiel (Reagenzglas), nur mit ?test in der Adresse: speichert nie, der echte Stand bleibt unberührt
const TEST_BUTTON = new URLSearchParams(location.search).has('test');

// „13. Nov. um 09:40“
function savedText(s) {
  const d = new Date(s.savedAt);
  const day = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${day} um ${time}`;
}

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    this.saved = readSave();
    this.modal = null;
    this.leaving = false;
    this.root = this.add.container(0, 0);
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  rebuild() {
    this.root.removeAll(true);
    this.modal = null;
    this.build();
  }

  build() {
    const cx = GAME_W / 2;
    const sky = bakedImage(this, 'menu-sky', UI_W, GAME_H, (g) => {
      g.fillGradientStyle(0x3d2f86, 0x3d2f86, 0xf5a8cf, 0xf5a8cf, 1);
      g.fillRect(0, 0, UI_W, GAME_H);
    }, { ox: 0, oy: 0 }).setDisplaySize(GAME_W, GAME_H);
    this.root.add(sky);
    const rng = makeRng(5);
    for (let i = 0; i < 30; i++) {
      const s = this.add.image(rng() * GAME_W, 860 + rng() * 1000, 'star').setScale(0.4 + rng() * 0.6).setAlpha(0.3);
      this.tweens.add({ targets: s, alpha: 0.95, duration: 900 + rng() * 1400, delay: rng() * 2000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.root.add(s);
    }

    // weißer Kopf mit dem Logo
    this.root.add(headerImage(this, GAME_W, 780));
    const logo = this.add.image(cx, 380, 'logo');
    logo.setScale(Math.min(1.3, (Math.min(GAME_W, UI_W) - 40) / logo.width, 720 / logo.height));
    this.root.add(logo);
    popIn(this, logo, { from: logo.scale * 0.9, to: logo.scale, duration: 900 });

    // Weiterspielen
    const types = [...new Set((this.saved?.game?.rooms ?? []).map((r) => r.type))].filter((t) => roomById(t)).slice(0, 6);
    const cont = this.button(cx, 1040, 700, 250, 'play', 'Weiterspielen', this.saved ? savedText(this.saved) : 'noch kein Spielstand', () => this.tapContinue(cont));
    types.forEach((t, i) => cont.add(iconImage(this, t, 46).setPosition(cont.labelX + 24 + i * 58, 82)));
    if (!this.saved) cont.setAlpha(0.45);

    // Neues Spiel
    const fresh = this.button(cx, 1330, 700, 190, 'new', 'Neues Spiel', null, () => this.tapNew(fresh));
    this.root.add([cont, fresh]);

    // Test-Spiel (nur mit ?test)
    if (TEST_BUTTON) {
      const test = this.button(cx, 1570, 560, 170, 'test', 'Test-Spiel', 'wird nicht gespeichert', () => this.startTest(), { fill: 0xe8e2d6, stroke: 0x8a8070 });
      this.root.add(test);
    }
  }

  // Knopf mit Bildzeichen links und Schrift rechts daneben (sub = kleine zweite Zeile)
  button(x, y, w, h, icon, label, sub, onTap, { fill, stroke } = {}) {
    const c = this.add.container(x, y);
    const left = -w / 2 + h * 0.55;
    const img = iconImage(this, icon, Math.min(120, h * 0.55)).setPosition(left, 0);
    const tx = left + h * 0.5;
    const text = this.add.text(tx, sub ? -24 : 0, label, { fontFamily: FONT, fontSize: '58px', fontStyle: 'bold', color: '#5a3a7a' }).setOrigin(0, 0.5);
    c.add([pillImage(this, w, h, fill, stroke), img, text]);
    if (sub) c.add(this.add.text(tx, 28, sub, { fontFamily: FONT, fontSize: '32px', color: '#8a6aa8' }).setOrigin(0, 0.5));
    c.labelX = tx;
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerup', onTap);
    return c;
  }

  tapContinue(btn) {
    if (this.blocked()) return;
    if (!this.saved) return wobble(this, btn);
    squish(this, btn);
    save.testMode = false;
    if (!loadSave()) return wobble(this, btn);
    this.go(true);
  }

  tapNew(btn) {
    if (this.blocked()) return;
    squish(this, btn);
    if (this.saved) return this.ask();
    this.startNew();
  }

  startNew() {
    save.testMode = false;
    deleteSave();
    resetGame();
    this.go(false);
  }

  startTest() {
    if (this.blocked()) return;
    save.testMode = true;
    resetGame();
    this.go(false);
  }

  // Rückfrage: wirklich neu anfangen? Der alte Spielstand wird gelöscht.
  ask() {
    const cx = GAME_W / 2;
    const m = this.add.container(0, 0);
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2b2150, 0.6).setOrigin(0).setInteractive();
    veil.on('pointerup', () => this.closeAsk());
    const panel = cardImage(this, 860, 560, 44, 0xff9ec7).setPosition(cx, 960).setInteractive();
    const q = this.add
      .text(cx, 860, 'Wirklich neu anfangen?\nDer alte Spielstand wird gelöscht.', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#5a3a7a', align: 'center', lineSpacing: 12 })
      .setOrigin(0.5);
    const no = this.button(cx - 205, 1090, 370, 130, 'cross', 'Nein', null, () => this.closeAsk());
    const yes = this.button(cx + 205, 1090, 370, 130, 'trash', 'Ja, neu', null, () => {
      this.closeAsk();
      this.startNew();
    }, { fill: 0xffe0ea, stroke: 0xd94f74 });
    m.add([veil, panel, q, no, yes]);
    m.setAlpha(0);
    this.tweens.add({ targets: m, alpha: 1, duration: 180 });
    popIn(this, panel, { from: 0.8, to: 1, duration: 500 });
    this.root.add(m);
    this.modal = m;
  }

  closeAsk() {
    const m = this.modal;
    if (!m) return;
    this.modal = null;
    this.tweens.add({ targets: m, alpha: 0, duration: 160, onComplete: () => m.destroy() });
  }

  blocked() {
    return this.leaving || !!this.modal;
  }

  // ins Spiel: kurz ausblenden, dann den Baum starten (load = Räume aus dem Spielstand aufbauen)
  go(load) {
    this.leaving = true;
    this.cameras.main.fadeOut(260, 43, 33, 80);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Tree', { load }));
  }
}
