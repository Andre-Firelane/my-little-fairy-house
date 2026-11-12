import Phaser from 'phaser';
import { GAME_W } from '../config/layout.js';

// Gemeinsamer Zustand für das Platzieren von Räumen (Tap-Select und Drag-and-Drop).
// TreeScene besitzt ihn, UIScene holt ihn aus der Registry.
// Events: 'selection' (roomId | null), 'room-placed' (slot)
export default class Placement extends Phaser.Events.EventEmitter {
  constructor(tree) {
    super();
    this.tree = tree;
    this.selected = null; // Raum-ID der angetippten Karte
    this.origin = null; // Bildschirmposition der angetippten Karte (dort startet der Raum beim Tap-Place)
    this.dragging = false;
  }

  select(roomId, originScreen = null) {
    if (this.selected === roomId) return this.clear();
    this.selected = roomId;
    this.origin = originScreen;
    this.emit('selection', roomId);
  }

  clear() {
    if (this.selected === null) return;
    this.selected = null;
    this.origin = null;
    this.emit('selection', null);
  }

  originWorld() {
    const o = this.origin || { x: GAME_W / 2, y: 1920 };
    return this.tree.toWorld(o.x, o.y);
  }

  freeSlotAt(wx, wy) {
    return this.tree.slots.find((s) => !s.room && s.contains(wx, wy)) || null;
  }

  // Raum in Slot setzen; fromX/fromY = Weltposition, von der aus er einfliegt
  place(roomId, slot, fromX, fromY) {
    if (!slot || slot.room) return false;
    this.tree.placeRoom(roomId, slot, fromX, fromY);
    this.clear();
    this.emit('room-placed', slot);
    return true;
  }
}
