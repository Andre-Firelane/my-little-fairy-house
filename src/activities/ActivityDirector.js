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
import { PER_ACTIVITY, LIKED_BONUS, LIKED_AT } from '../config/dust.js';

// Alle Tätigkeiten. Neue einfach hier eintragen:
// { id, icon, uses(def) → passt zu diesem Gegenstand?, available?(sticker, director) → gerade möglich?, run(c, sticker) }
export const ACTIVITIES = [brew, fill, read, write, wipe, sleep, cook, eat, bath, primp, play, dance, disco, light, water, relax];

// Regie eines Raums: Feen suchen sich selbst etwas zu tun (nach ihren Vorlieben), das Kind kann sie auch
// auf einen Gegenstand ziehen. Kümmert sich um Reservierungen und sauberes Abbrechen.
// life = das Raum-Leben (life/RoomLife.js) mit Feen, Raumansicht, Spielstand und Glitzer.
export default class ActivityDirector {
  constructor(life) {
    this.life = life;
    this.scene = life.scene;
    this.jobs = new Map(); // fairy → job
    this.reserved = new Set(); // Item-uids, die gerade eine Fee benutzt
    this.idle = new Map(); // fairy → Sekunden bis zur nächsten eigenen Idee
    this.bubbles = new ThoughtBubbles(life.scene, life.layer);
  }

  update(dt) {
    const night = this.scene.clock?.night;
    // Geister (Geisterstunde) beschäftigen sich wie Feen am Tag – sie gehen nicht ins Bett
    for (const f of [...this.life.fairies, ...this.life.ghosts]) {
      if (this.jobs.has(f) || f.state !== 'wander') continue;
      if (night && !f.isGhost) {
        this.goToBed(f);
        continue;
      }
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
    else {
      job.ctx.release();
      this.reward(job);
    }
    job.f.dropCarry();
    job.f.resetPose();
    job.f.wander();
    this.idle.set(job.f, rand(3, 7));
  }

  // fertige Tätigkeit einer Fee → Feenstaub (Lieblingstätigkeit: mehr); Geister und die Nachtruhe bringen nichts
  reward(job) {
    const { f, activity } = job;
    if (f.isGhost || activity.id === 'night' || !this.life.view) return;
    const liked = (f.palette.likes?.[activity.id] ?? 1) >= LIKED_AT;
    const amount = PER_ACTIVITY * (liked ? LIKED_BONUS : 1);
    const w = this.life.view.toWorld(f.x, f.y - 20);
    this.scene.giveDust?.(amount, w.x, w.y);
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

  // Fee antippen: zeigt, was sie gerade macht – oder sucht sich gleich etwas aus
  tap(f) {
    const job = this.jobs.get(f);
    if (job) return this.bubbles.show(f, job.activity.icon, 1.4);
    if (f.state === 'wander') this.startAuto(f);
  }
}
