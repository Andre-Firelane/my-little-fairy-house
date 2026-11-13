import Sparkles from '../systems/particles.js';
import Fairy from '../objects/Fairy.js';
import Ghost from '../objects/Ghost.js';
import ActivityDirector from '../activities/ActivityDirector.js';
import { rand } from '../systems/motion.js';

// Feen-Größe in Raum-Koordinaten (etwa eine Rasterzelle hoch)
export const FAIRY_SCALE = 1;
// so viele Feen ziehen in jedes eingerichtete Zimmer ein
export const FAIRIES_PER_ROOM = 2;

// Das Leben in einem Raum: seine Feen, ihre Regie (Tätigkeiten) und der Glitzer.
// Läuft immer – im Baum (verkleinert) genauso wie in der Großansicht beim Einrichten.
// Alles in Raum-Koordinaten (Mitte = 0,0, Maße aus view.geo) innerhalb von layer.
//
// Detailstufen, damit viele Räume gleichzeitig leben können:
//   detail an  (Raum ist groß geöffnet): Glitzer, Blasen, Gedankenblasen, jedes Bild bewegt
//   detail aus (Baum-Übersicht):         keine Effekte, Feen bewegen sich mit halber Bildrate
//   außerhalb des Bildschirms:            Feen nur 4× pro Sekunde weitergerückt, Tätigkeiten laufen weiter
//
// Die Feen gehören dem ganzen Haus (life/Residents.js): sie ziehen ein, wenn ein Zimmer eingerichtet ist,
// und wechseln ab und zu das Zimmer. Hier lebt nur, wer gerade in diesem Zimmer ist.
export default class RoomLife {
  constructor(scene, { layer, view = null, state = null }) {
    this.scene = scene;
    this.layer = layer;
    this.view = view; // RoomView (einrichtbare Räume) oder null
    this.roomState = state;
    this.fairies = [];
    this.draggingUids = new Set(); // Items, die das Kind gerade in der Hand hat
    this.sparkles = new Sparkles(scene, layer);
    this.mist = new Sparkles(scene, layer, { mist: true }); // Geister glitzern nicht, sie nebeln
    this.ghosts = []; // Besuch der Geisterstunde (zählt nicht zu den Feen des Hauses)
    this.director = new ActivityDirector(this);
    this.acc = 0;
    this.frame = 0;
    this.sleepers = 0; // wie viele Feen gerade schlafen (dann wird es dunkel)
    this.halos = new Map(); // Lampen-uid → Lichtschein
    this.ambient = 0;
    this.setDetail(false);
  }

  get state() {
    return this.roomState || { items: [] };
  }

  getWanderArea() {
    const g = this.view.geo;
    const m = Math.min(140, g.innerW * 0.2);
    const x1 = g.innerLeft + m;
    const x2 = g.innerRight - m;
    // oben nur so hoch, wie die Decke an der Stelle es erlaubt (Dachschräge, Kuppel)
    const y1 = Math.max(g.topAt(x1), g.topAt(x2)) + 90;
    return { x1, x2, y1, y2: Math.max(y1 + 40, g.floorY - 60) };
  }

  setDetail(on) {
    this.detail = on;
    this.sparkles.setDetail(on);
    this.mist.setDetail(on);
    this.director.bubbles.enabled = on;
    if (!on) this.director.bubbles.hideAll();
  }

  // eine Fee legt sich schlafen (+1) bzw. steht auf (−1): Raum wird dunkel bzw. wieder hell
  setSleeping(delta) {
    this.sleepers = Math.max(0, this.sleepers + delta);
  }

  // Raum abdunkeln: Nacht, eine Fee schläft, oder Disco (etwas dunkler, damit die bunten Lichter leuchten).
  // Wird jedes Bild sanft nachgeführt (update).
  updateNight(dt = 1) {
    if (!this.view) return;
    const want = Math.max((this.scene.clock?.darkness ?? 0) * 0.5, this.sleepers > 0 ? 0.45 : 0, this.discoSpots ? 0.32 : 0);
    const n = this.view.night;
    if (Math.abs(n.alpha - want) > 0.002) n.alpha += (want - n.alpha) * Math.min(1, dt * 1.2);
  }

  // Discokugel an: bunte Lichtflecken wandern durch den Raum
  setDisco(on) {
    if (on === !!this.discoSpots) return;
    if (on) {
      const colors = [0xff5fa8, 0x3fc8ff, 0xffd23f, 0x5fe08a, 0xa77bff, 0xff9a3c];
      this.discoT = 0;
      this.discoSpots = colors.map((c) => {
        const spot = this.scene.add.image(0, 0, 'sparkle').setTint(c).setBlendMode('ADD').setScale(5.5).setAlpha(0);
        this.view.lights.add(spot);
        this.scene.tweens.add({ targets: spot, alpha: 0.6, duration: 600 });
        return spot;
      });
      this.moveDisco(0);
    } else {
      this.discoSpots.forEach((s) => s.destroy());
      this.discoSpots = null;
    }
  }

  moveDisco(dt) {
    this.discoT += dt;
    const g = this.view.geo;
    const t = this.discoT;
    const cx = (g.innerLeft + g.innerRight) / 2;
    const cy = (g.innerTop + g.floorY) / 2 + 30;
    this.discoSpots.forEach((s, i) => {
      s.setPosition(
        cx + Math.sin(t * (0.7 + i * 0.13) + i * 1.9) * g.innerW * 0.4,
        cy + Math.sin(t * (1.1 + i * 0.09) + i * 2.6) * (g.floorY - g.innerTop) * 0.32,
      );
    });
  }

  // Lichtschein für eingeschaltete Lampen (folgt der Lampe, auch wenn sie getragen wird)
  syncLights() {
    const t = this.scene.time.now / 1000;
    let disco = false;
    for (const s of this.view.stickers.values()) {
      if (s.def.disco && s.item?.state === 'on' && s.active && !s.carried) disco = true;
      // Fenster: draußen Tag oder Nacht (Wechsel in der Mitte der Dämmerung)
      if (s.def.skyWindow && s.item) {
        const look = (this.scene.clock?.darkness ?? 0) > 0.5 ? 'night' : null;
        if ((s.item.state ?? null) !== look) {
          s.item.state = look;
          s.setLook(s.item);
        }
      }
      if (!s.def.lamp) continue;
      const on = s.item?.state === 'on' && s.active;
      let halo = this.halos.get(s.item.uid);
      if (on && !halo) {
        halo = this.scene.add.image(0, 0, 'sparkle').setTint(s.def.lamp.color).setBlendMode('ADD');
        this.view.lights.add(halo);
        this.halos.set(s.item.uid, halo);
      }
      if (!on && halo) {
        halo.destroy();
        this.halos.delete(s.item.uid);
        continue;
      }
      if (!halo) continue;
      const p = s.artToLocal(s.def.lamp.x, s.def.lamp.y);
      const L = s.def.lamp;
      const size = L.size ?? 6;
      const k = L.flicker ? 1 + Math.sin(t * 13 + p.x) * 0.07 + Math.sin(t * 7.3) * 0.05 : 1 + Math.sin(t * 1.3) * 0.07;
      halo.setPosition(p.x, p.y).setScale(size * k).setAlpha(L.alpha ?? (L.flicker ? 0.7 : 0.55));
    }
    for (const [uid, halo] of this.halos) {
      if (!this.view.stickers.has(uid)) {
        halo.destroy();
        this.halos.delete(uid);
      }
    }
    this.setDisco(disco);
  }

  // eine Fee kommt aus einem anderen Zimmer an (x, y in Raum-Koordinaten)
  addFairy(f, x, y) {
    f.moveInto(this.layer, this, this.sparkles, FAIRY_SCALE, x, y);
    f.arrivedAt = this.scene.time.now / 1000;
    this.fairies.push(f);
  }

  // eine Fee verlässt das Zimmer
  removeFairy(f) {
    this.director.abort(f);
    this.director.bubbles.hide(f, true);
    this.director.idle.delete(f);
    this.fairies = this.fairies.filter((x) => x !== f);
  }

  // Raum wird gelöscht: alles anhalten (die Objekte selbst verschwinden mit dem Raum)
  dispose() {
    this.dead = true;
    this.director.abortAll();
    this.director.bubbles.hideAll();
    this.ghosts = [];
  }

  // ---------- Geister (Geisterstunde) ----------

  // ein Geist schwebt von der Seite herein
  addGhost(palette, delay = 0) {
    this.scene.time.delayedCall(delay, () => {
      if (this.dead || !this.view) return;
      const side = Math.random() < 0.5 ? -1 : 1;
      const a = this.getWanderArea();
      const g = new Ghost(this.scene, side * (this.view.geo.W / 2 + 260), rand(a.y1, a.y2), palette, this.mist, FAIRY_SCALE, this, this.layer);
      g.arrivedAt = this.scene.time.now / 1000;
      this.ghosts.push(g);
      g.goTo({ x: rand(a.x1, a.x2), y: rand(a.y1, a.y2) }, 220).then(() => {
        if (g.state === 'script' && !this.director.jobs.has(g)) g.wander();
        this.mist.burst(g.x, g.y, 10);
      });
    });
  }

  // Morgen: die Geister hören auf, winken kurz und schweben hinaus
  sendGhostsAway() {
    const ghosts = this.ghosts;
    this.ghosts = [];
    this.leaving ??= new Set();
    ghosts.forEach((g) => this.leaving.add(g)); // bewegen sich weiter, bis sie draußen sind
    for (const g of ghosts) {
      this.director.abort(g);
      this.director.bubbles.hide(g, true);
      this.director.idle.delete(g);
      g.hold();
      g.pose.bob = 1.6; // aufgeregtes Winken
      this.scene.time.delayedCall(600 + Math.random() * 900, () => {
        if (!g.active) return;
        const side = g.pos.x < 0 ? -1 : 1;
        this.mist.burst(g.x, g.y, 8);
        g.goTo({ x: side * (this.view.geo.W / 2 + 320), y: g.pos.y - 160 }, 320).then(() => {
          this.leaving.delete(g);
          g.dropTrail();
          g.destroy();
        });
      });
    }
  }

  // eine Fee zieht ein: kommt von der Seite angeflogen
  moveIn(palette, delay = 0) {
    this.scene.time.delayedCall(delay, () => {
      if (this.dead) return;
      const side = Math.random() < 0.5 ? -1 : 1;
      const a = this.getWanderArea();
      const f = new Fairy(this.scene, side * (this.view.geo.W / 2 + 260), rand(a.y1, a.y2), palette, this.sparkles, FAIRY_SCALE, this, this.layer);
      f.arrivedAt = this.scene.time.now / 1000;
      this.fairies.push(f);
      f.goTo({ x: rand(a.x1, a.x2), y: rand(a.y1, a.y2) }, 300).then(() => {
        if (f.state === 'script') f.wander();
        this.sparkles.burst(f.x, f.y, 12);
      });
    });
  }

  isFurnished() {
    return !!this.view && this.state.items.length >= (this.view.typeDef.furnishedAt ?? 4);
  }

  update(dt, onScreen) {
    if (this.dead) return;
    this.updateNight(dt);
    this.director.update(dt);
    if (this.view) this.syncLights();
    if (this.discoSpots && onScreen) this.moveDisco(dt);

    // Feen je nach Detailstufe seltener bewegen (größere Schritte)
    this.acc += dt;
    if (!onScreen) {
      if (this.acc < 0.25) return;
    } else if (!this.detail) {
      this.frame ^= 1;
      if (this.frame) return;
    }
    const step = Math.min(this.acc, 0.3);
    this.acc = 0;
    for (const f of this.fairies) f.update(step);
    for (const g of this.ghosts) g.update(step);
    if (this.leaving) {
      for (const g of this.leaving) {
        if (g.active) g.update(step);
        else this.leaving.delete(g);
      }
    }

    // ein voller Kessel blubbert vor sich hin
    if (!this.detail || !this.view) return;
    this.ambient -= step;
    if (this.ambient > 0) return;
    this.ambient = 0.4;
    for (const s of this.view.stickers.values()) {
      if (s.def.id !== 'kessel' || !(s.item?.potion > 0) || s.carried) continue;
      const p = s.liquidPos();
      this.sparkles.bubbles(p.x + rand(-70, 70), p.y, s.item.liquid, 1);
    }
  }
}
