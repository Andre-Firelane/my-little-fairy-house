import { bakedImage } from '../systems/bake.js';
import { iconImage } from './icons.js';
import { FONT } from '../config/layout.js';

// Gebackene UI-Flächen (Leisten, Karten, Knöpfe) – gleich aussehend wie vorher mit Graphics, aber ein Bild.

// Leiste: abgerundetes Rechteck mit weichem Schatten und lila Rand; (x, y) = linke obere Ecke
export function barImage(scene, key, x, y, w, h, alpha = 0.94) {
  return bakedImage(scene, key, w + 8, h + 14, (g) => {
    g.fillStyle(0x3b2a6b, 0.25);
    g.fillRoundedRect(0, 8, w, h, 40);
    g.fillStyle(0xfff4fb, alpha);
    g.fillRoundedRect(0, 0, w, h, 40);
    g.lineStyle(6, 0xe2b6ff, 1);
    g.strokeRoundedRect(0, 0, w, h, 40);
  }, { ox: 4, oy: 4, x, y });
}

// Karte: weiß mit farbigem Rand, um 0,0 zentriert
export function cardImage(scene, w, h, radius, accent) {
  return bakedImage(scene, `card-${w}x${h}-${accent}`, w + 8, h + 18, (g) => {
    g.fillStyle(0x7a4fa0, 0.18);
    g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, radius);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    g.lineStyle(5, accent, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  }, { ox: w / 2 + 4, oy: h / 2 + 4 });
}

// runder Knopf ("Zurück"), um 0,0 zentriert
export function pillImage(scene, w, h, fill = 0xfff4fb, stroke = 0xe2b6ff) {
  return bakedImage(scene, `pill-${w}x${h}-${fill}-${stroke}`, w + 8, h + 14, (g) => {
    g.fillStyle(0x3b2a6b, 0.25);
    g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, h / 2);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(5, stroke, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  }, { ox: w / 2 + 4, oy: h / 2 + 4 });
}

// Knopf mit Bildzeichen (Container, antippbar), um (x, y) zentriert – das Spiel kommt ohne Schrift aus
export function iconButton(scene, x, y, w, h, icon, onTap, { fill, stroke, size = h * 0.62 } = {}) {
  const c = scene.add.container(x, y);
  c.add([pillImage(scene, w, h, fill, stroke), iconImage(scene, icon, size)]);
  c.setSize(w, h).setInteractive();
  c.on('pointerup', onTap);
  return c;
}

// Knopf mit Bildzeichen links und Schrift daneben (Haupt- und Spielmenü – die lesen eher die Eltern);
// sub = kleine zweite Zeile. Gibt den Container zurück; .setSub(text) ändert die zweite Zeile.
export function labelButton(scene, x, y, w, h, icon, label, sub, onTap, { fill, stroke } = {}) {
  const c = scene.add.container(x, y);
  const left = -w / 2 + h * 0.55;
  const img = iconImage(scene, icon, Math.min(120, h * 0.55)).setPosition(left, 0);
  const tx = left + h * 0.5;
  const text = scene.add.text(tx, sub ? -24 : 0, label, { fontFamily: FONT, fontSize: '58px', fontStyle: 'bold', color: '#5a3a7a' }).setOrigin(0, 0.5);
  if (text.width > w - (tx + w / 2) - 30) text.setScale((w - (tx + w / 2) - 30) / text.width);
  const subText = scene.add.text(tx, 28, sub || '', { fontFamily: FONT, fontSize: '32px', color: '#8a6aa8' }).setOrigin(0, 0.5);
  c.add([pillImage(scene, w, h, fill, stroke), img, text, subText]);
  c.labelX = tx;
  c.setSub = (t) => {
    subText.setText(t || '');
    text.setY(t ? -24 : 0);
  };
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerup', onTap);
  return c;
}

// Knopf mit Beschriftung (Container, antippbar), um (x, y) zentriert
export function textButton(scene, x, y, w, h, text, onTap, { fill, stroke, color = '#5a3a7a', size = 40, font } = {}) {
  const c = scene.add.container(x, y);
  const label = scene.add.text(0, 0, text, { fontFamily: font, fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0.5);
  if (label.width > w - 30) label.setScale((w - 30) / label.width);
  c.add([pillImage(scene, w, h, fill, stroke), label]);
  c.setSize(w, h).setInteractive();
  c.on('pointerup', onTap);
  return c;
}
