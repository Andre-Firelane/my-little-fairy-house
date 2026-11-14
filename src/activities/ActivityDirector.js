import JobContext, { ABORT, Cancel } from './JobContext.js';
import ThoughtBubbles from '../objects/ThoughtBubble.js';
import { rand, pick } from '../systems/motion.js';
import brew from './brew.js';
import fill from './fill.js';
import read from './read.js';
import { write, wipe } from './board.js';
import sleep from './sleep.js';
import { cook, eat } from './food.js';
import bath from './bath.js';
import primp from './primp.js';
import { play, dance, disco } from './music.js';
import { light, water, relax } from './home.js';
import nightSleep from './night.js';
import { tend, harvest } from './garden.js';
import { craft, saw } from './werkstatt.js';
import { lift, rings, tumble, vault, climb } from './turnraum.js';
import { paint, pottery } from './atelier.js';
import { tea } from './teesalon.js';
import { NEED_DUST, NEED_EVERY, NEED_LASTS, NEED_PAUSE } from '../config/dust.js';
import { furnitureById, textureKey } from '../config/furniture.js';

// Alle Tätigkeiten. Neue einfach hier eintragen:
// { id, icon, uses(def) → passt zu diesem Gegenstand?, available?(sticker, director) → gerade möglich?, run(c, sticker) }
export const ACTIVITIES = [brew, fill, read, write, wipe, sleep, cook, eat, bath, primp, play, dance, disco, light, water, relax, tend, harvest,
  craft, saw, lift, rings, tumble, vault, climb, paint, pottery, tea];

// Wünsche: nur Tätigkeiten, deren Gegenstand man in dieser Raumart bauen kann (Schlafen am Tag ausgenommen)
const buildable = (a, catalog) => catalog.some((id) => {
  const def = furnitureById(id);
  return def && a.uses(def);
});
const wishesFor = (catalog) => ACTIVITIES.filter((a) => a.id !== 'sleep' && buildable(a, catalog));

// Bild in der Wunschblase: ein Gegenstand, den es in dieser Raumart gibt (das Standardbild der Tätigkeit,
// wenn es passt – sonst der erste passende aus dem Katalog, z. B. Blumenkasten statt Vase im Garten)
function wishIcon(a, catalog) {
  const fitting = catalog.filter((id) => {
    const def = furnitureById(id);
    return def && (a.uses(def) || a.wishAlso?.(def));
  });
  if (fitting.some((id) => a.icon.startsWith(textureKey(id)))) return a.icon;
  const def = furnitureById(fitting[0]);
  return def ? textureKey(def.id, 0, def.cardState ?? null) : a.icon;
}

// Regie eines Raums: Feen suchen sich selbst etwas zu tun (nach ihren Vorlieben), das Kind kann sie auch
// auf einen Gegenstand ziehen. Kümmert sich um Reservierungen und sauberes Abbrechen.
// Wünsche: ab und zu (oder wenn man sie antippt) wünscht sich eine Fee etwas aus ihrer Raumart (rosa Blase).
// Zieht man sie auf einen passenden Gegenstand, ist der Wunsch erfüllt: Feenstaub – nur dafür. Fehlt der Gegenstand,
// muss man ihn bauen. Eine Fee mit Wunsch wartet: sie erfüllt ihn nicht selbst und wechselt nicht das Zimmer.
// life = das Raum-Leben (life/RoomLife.js) mit Feen, Raumansicht, Spielstand und Glitzer.
export default class ActivityDirector {
  constructor(life) {
    this.life = life;
    this.scene = life.scene;
    this.jobs = new Map(); // fairy → job
    this.reserved = new Set(); // Item-uids, die gerade eine Fee benutzt
    this.idle = new Map(); // fairy → Sekunden bis zur nächsten eigenen Idee
    this.bubbles = new ThoughtBubbles(life.scene, life.layer);
    this.needTimer = rand(...NEED_EVERY) * 0.5;
  }

  update(dt) {
    const night = this.scene.clock?.night;
    this.updateNeeds(dt, night);
    // Geister (Geisterstunde) beschäftigen sich wie Feen am Tag – sie gehen nicht ins Bett
    for (const f of [...this.life.fairies, ...this.life.ghosts]) {
      if (this.jobs.has(f) || f.state !== 'wander') continue;
      if (night && !f.isGhost) {
        this.goToBed(f);
        continue;
      }
      if (f.need) continue; // wartet darauf, dass man ihr hilft
      const t = (this.idle.get(f) ?? rand(1.5, 4)) - dt;
      this.idle.set(f, t);
      if (t <= 0) {
        this.idle.set(f, rand(3, 6));
        this.startAuto(f);
      }
    }
    this.bubbles.update();
  }

  // Gegenstände im Raum, die gerade frei sind (nicht reserviert, nicht getragen, nicht in der Hand des Kindes)
  free(pred) {
    if (!this.life.view) return [];
    const busy = this.life.draggingUids;
    const items = this.life.state.items;
    return [...this.life.view.stickers.values()].filter(
      (s) => !s.carried && items.includes(s.item) && !this.reserved.has(s.item.uid) && !busy.has(s.item.uid) && pred(s),
    );
  }

  targets(activity) {
    return this.free((s) => activity.uses(s.def) && (activity.available?.(s, this) ?? true));
  }

  // passende Tätigkeit für einen Gegenstand, auf den das Kind eine Fee zieht
  activityFor(sticker) {
    return ACTIVITIES.find((a) => a.uses(sticker.def) && (a.available?.(sticker, this) ?? true)) || null;
  }

  // selbst etwas aussuchen, gewichtet nach Lieblingstätigkeiten der Fee
  startAuto(f) {
    const options = ACTIVITIES.map((a) => ({ a, ts: this.targets(a) })).filter((o) => o.ts.length);
    if (!options.length) return false;
    const weight = (o) => f.palette.likes?.[o.a.id] ?? 1;
    let r = Math.random() * options.reduce((sum, o) => sum + weight(o), 0);
    const choice = options.find((o) => (r -= weight(o)) <= 0) || options[0];
    return this.start(f, choice.a, pick(choice.ts));
  }

  start(f, activity, target) {
    if (!activity || !target?.item || this.reserved.has(target.item.uid)) return false;
    return this.startJob(f, activity, target, target.item.uid);
  }

  // Nacht: Schlafplatz holen (das Haus verteilt sie, siehe life/Residents.js) und schlafen gehen
  goToBed(f) {
    const spot = this.scene.residents?.claimBed(f, this.life);
    if (!spot) return false;
    // Bett und Sitzplatz gehören dann dieser Fee; Teppich und Boden teilen sich mehrere
    const uid = spot.tier <= 2 ? spot.sticker.item.uid : null;
    if (uid && this.reserved.has(uid)) return false;
    this.clearNeed(f);
    return this.startJob(f, nightSleep, spot, uid);
  }

  startJob(f, activity, arg, reserveUid = null) {
    this.abort(f);
    const token = { aborted: false };
    const ctx = new JobContext(this, f, token);
    if (reserveUid) ctx.reserve(reserveUid);
    const job = { f, activity, ctx, token };
    this.jobs.set(f, job);
    f.hold();
    activity
      .run(ctx, arg)
      .then(() => this.end(job, false))
      .catch((e) => {
        if (e === ABORT) return;
        if (!(e instanceof Cancel)) console.error(e);
        this.end(job, true);
      });
    return true;
  }

  end(job, cleanup) {
    if (this.jobs.get(job.f) !== job) return;
    this.jobs.delete(job.f);
    if (cleanup) job.ctx.cleanup();
    else job.ctx.release();
    job.f.dropCarry();
    job.f.resetPose();
    job.f.wander();
    this.idle.set(job.f, rand(3, 7));
  }

  // ---------- Wünsche ----------

  updateNeeds(dt, night) {
    const now = this.scene.time.now;
    const fairies = this.life.fairies;
    for (const f of fairies) if (f.need && now > f.need.until) this.clearNeed(f);
    // Blasen nur im geöffneten Raum: nur dort kann man die Fee packen
    const open = this.scene.activeRoom?.life === this.life;
    for (const f of fairies) {
      if (!f.need) continue;
      if (open && !this.bubbles.has(f)) this.bubbles.show(f, f.need.icon ?? f.need.activity.icon, (f.need.until - now) / 1000);
      if (!open && this.bubbles.has(f)) this.bubbles.hide(f, true);
    }
    if (night || !this.life.view) return;
    this.needTimer -= dt;
    if (this.needTimer > 0) return;
    this.needTimer = rand(...NEED_EVERY);
    if (fairies.some((f) => f.need)) return; // je Zimmer nur ein Wunsch auf einmal
    // (eine Fee, deren Wunsch gerade erfüllt wurde, hat erst einmal Pause)
    const idle = fairies.filter((f) => f.state === 'wander' && !this.jobs.has(f) && now > (f.needPause ?? 0));
    if (idle.length) this.giveNeed(pick(idle));
  }

  // Wunsch nach Vorliebe der Fee – nur etwas, das zu dieser Raumart gehört
  giveNeed(f) {
    const all = wishesFor(this.life.view?.typeDef?.catalog || []);
    const options = all.length > 1 ? all.filter((a) => a.id !== f.lastNeed) : all;
    if (!options.length) return false;
    const weight = (a) => f.palette.likes?.[a.id] ?? 1;
    let r = Math.random() * options.reduce((sum, a) => sum + weight(a), 0);
    const activity = options.find((a) => (r -= weight(a)) <= 0) || options[0];
    f.need = { activity, icon: wishIcon(activity, this.life.view?.typeDef?.catalog || []), until: this.scene.time.now + NEED_LASTS * 1000 };
    f.lastNeed = activity.id;
    this.life.sparkles.twinkle(f.x, f.y - 40, 4);
    return true;
  }

  clearNeed(f) {
    if (!f.need) return;
    f.need = null;
    this.bubbles.hide(f);
  }

  // passt dieser Gegenstand zum Wunsch der Fee? (egal, ob die Tätigkeit gerade möglich ist)
  fitsNeed(f, target) {
    const a = f.need?.activity;
    return !!(a && target?.def && (a.uses(target.def) || a.wishAlso?.(target.def)));
  }

  // Wunsch erfüllt: Glitzer, Feenstaub fliegt ins Glas, Blase weg, Pause. Dann macht sie es – oder, wenn das
  // gerade nicht geht (z. B. kein Obst zum Backen), freut sie sich nur und dreht eine Glitzerrunde.
  fulfill(f, target) {
    if (!this.fitsNeed(f, target)) return false;
    const activity = f.need.activity;
    this.clearNeed(f);
    f.needPause = this.scene.time.now + NEED_PAUSE * 1000;
    this.life.sparkles.burst(f.x, f.y - 20, 18);
    const w = this.life.view.toWorld(f.x, f.y - 20);
    this.scene.giveDust?.(NEED_DUST, w.x, w.y);
    // auf ein Hilfsding gezogen (z. B. Gießkanne): das eigentliche Ziel suchen (z. B. eine durstige Pflanze)
    if (!activity.uses(target.def)) target = pick(this.targets(activity)) ?? target;
    const canDo = activity.uses(target.def) && !this.reserved.has(target.item.uid) && (activity.available?.(target, this) ?? true);
    if (canDo && this.start(f, activity, target)) return true;
    f.wander();
    f.visit({ x: target.x, y: target.y - target.H * 0.6 }, null, { duration: 1.6, spread: 20 });
    return true;
  }

  abort(f) {
    const job = this.jobs.get(f);
    if (!job) return;
    job.token.aborted = true;
    this.end(job, true);
  }

  // Kind nimmt einen Gegenstand, den gerade eine Fee benutzt → Fee hört auf
  interruptFor(uids) {
    for (const job of [...this.jobs.values()]) {
      if (job.ctx.held.some((u) => uids.has(u))) {
        this.abort(job.f);
        this.life.sparkles.twinkle(job.f.x, job.f.y - 20, 4);
      }
    }
  }

  abortAll() {
    for (const f of [...this.jobs.keys()]) this.abort(f);
  }

  // Fee antippen: sie wünscht sich gleich etwas (hat sie schon einen Wunsch, wackelt die Blase)
  tap(f) {
    if (f.isGhost) return;
    if (f.need) return this.bubbles.nudge(f);
    if (this.scene.clock?.night) return;
    this.abort(f);
    if (f.state !== 'wander') f.wander();
    this.giveNeed(f);
  }
}
