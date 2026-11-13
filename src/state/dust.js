import Phaser from 'phaser';
import { GLASS } from '../config/dust.js';

// Feenstaub des Hauses (wird gespeichert): ein Glas, höchstens GLASS. Volles Glas = ein Event, das Event leert es.
// Meldet jede Änderung ('change'), damit die Anzeige (HudScene) nachziehen kann.

class Dust extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    this.amount = 0;
  }

  get full() {
    return this.amount >= GLASS;
  }

  set(n) {
    this.amount = Math.max(0, Math.min(GLASS, Math.round(n) || 0));
    this.emit('change', this.amount);
  }

  // gibt zurück, wie viel wirklich dazukam (das Glas ist begrenzt)
  add(n) {
    const before = this.amount;
    this.set(before + n);
    return this.amount - before;
  }

  // Event: das volle Glas wird ganz geleert; false, wenn es nicht voll ist
  empty() {
    if (!this.full) return false;
    this.set(0);
    return true;
  }
}

export const dust = new Dust();
