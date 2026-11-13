import { GHOST_PALETTES } from '../config/fairies.js';
import { GHOST_NIGHT_EXTRA } from '../config/dust.js';
import { pick } from '../systems/motion.js';

const ARRIVE_AFTER = 8; // Sekunden: erst wenn die Feen im Bett liegen, kommen die Geister

// Event „Geisterstunde“: sofort wird es Nacht, und die Nacht dauert länger. Die Feen schlafen (wie jede Nacht,
// siehe life/Residents.js). In jedes eingerichtete Zimmer schweben 1–2 kleine Geister und benutzen die Möbel
// wie Feen – ohne Glitzer und ohne Feenstaub. Am Morgen winken sie und schweben davon.
// Gehört der Baum-Szene (TreeScene.happening); wird nicht gespeichert.
export default class GhostHour {
  constructor(scene) {
    this.scene = scene;
    this.id = 'ghost';
    this.t = 0;
    this.arrived = false;
    this.done = false;
    scene.clock.startLongNight(GHOST_NIGHT_EXTRA);
  }

  update(dt) {
    if (this.done) return;
    const clock = this.scene.clock;
    this.t += dt;
    if (!this.arrived && this.t >= ARRIVE_AFTER) {
      this.arrived = true;
      this.arrive();
    }
    // Morgen: vorbei
    if (this.t > ARRIVE_AFTER && !clock.night) this.end();
  }

  arrive() {
    const rooms = this.scene.rooms.filter((r) => !r.life.dead && r.life.isFurnished());
    let used = [];
    rooms.forEach((room, i) => {
      const n = Math.random() < 0.5 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        // möglichst verschiedene Geister im Haus
        if (used.length >= GHOST_PALETTES.length) used = [];
        const palette = pick(GHOST_PALETTES.filter((p) => !used.includes(p)));
        used.push(palette);
        room.life.addGhost(palette, i * 500 + k * 1600 + Math.random() * 600);
      }
    });
  }

  end() {
    this.done = true;
    for (const room of this.scene.rooms) if (!room.life.dead) room.life.sendGhostsAway();
  }
}
