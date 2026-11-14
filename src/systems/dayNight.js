// Tag und Nacht. Der Tag ist lang, die Nacht kurz; dazwischen Dämmerung und Morgen als Übergang.
// night = true von Beginn der Dämmerung bis zum Morgen (dann gehen die Feen schlafen bzw. sind im Bett).
// darkness 0 (Tag) … 1 (Nacht), weich übergeblendet – davon hängt ab, wie dunkel Baum, Himmel und Räume sind.
// Lange Nacht (Geisterstunde): startLongNight(extra) springt in die Dämmerung und hält die tiefe Nacht extra Sekunden länger.
// Abend (Lichterfest): startEvening() hält warmes Dämmerlicht (darkness EVENING_DARK, warm = 1), ohne dass es Nacht
// wird – die Feen bleiben wach. endEvening() lässt die Dämmerung von dort aus weiterlaufen in die Nacht.
// warm 0 … 1: wie stark Himmel und Schleier ins Abendrot getönt sind.
// Zum Testen: ?zeit=10 lässt die Zeit zehnmal so schnell laufen.

export const DAY = 210;
export const DUSK = 10;
export const NIGHT = 50;
export const DAWN = 10;
const CYCLE = DAY + DUSK + NIGHT + DAWN;
const EVENING_DARK = 0.5; // so dunkel ist der Abend (entspricht der Mitte der Dämmerung)
const EVENING_FADE = 4; // Sekunden, bis das Abendlicht da ist

const speed = Number(new URLSearchParams(location.search).get('zeit')) || 1;

export default class DayNight {
  constructor(start = 0) {
    this.t = ((start % CYCLE) + CYCLE) % CYCLE;
    this.hold = 0; // Sekunden, die die tiefe Nacht noch zusätzlich dauert
    this.night = false;
    this.darkness = 0;
    this.warm = 0;
    this.evening = 0; // 0 = kein Abend, sonst 0 … 1 eingeblendet
    this.update(0);
  }

  update(dt) {
    if (this.evening) {
      // Abend: die Zeit steht, das Licht wird warm und dämmrig
      this.evening = Math.min(1, this.evening + dt / EVENING_FADE);
      const e = this.evening;
      this.darkness = EVENING_DARK * e * e * (3 - 2 * e);
      this.warm = this.darkness / EVENING_DARK;
      this.night = false;
      return;
    }
    this.warm = Math.max(0, this.warm - dt / 8); // Abendrot verblasst in der Dämmerung
    let step = dt * speed;
    // in der tiefen Nacht erst die Verlängerung aufbrauchen
    if (this.hold > 0 && this.t >= DAY + DUSK && this.t < DAY + DUSK + NIGHT) {
      const use = Math.min(this.hold, step);
      this.hold -= use;
      step -= use;
    }
    this.t = (this.t + step) % CYCLE;
    const t = this.t;
    let d;
    if (t < DAY) d = 0;
    else if (t < DAY + DUSK) d = (t - DAY) / DUSK;
    else if (t < DAY + DUSK + NIGHT) d = 1;
    else d = 1 - (t - DAY - DUSK - NIGHT) / DAWN;
    this.darkness = d * d * (3 - 2 * d);
    this.night = t >= DAY && t < DAY + DUSK + NIGHT;
  }

  // sofort Abend werden lassen; die Nacht dauert extra Sekunden länger
  startLongNight(extra) {
    if (!this.night) this.t = DAY;
    this.hold = extra;
  }

  // Abend beginnen (Lichterfest) – hält, bis endEvening()
  startEvening() {
    if (!this.night) this.evening = 0.001;
  }

  // Abend vorbei: weiter in der Dämmerung, genau beim Licht des Abends (Mitte der Dämmerung)
  endEvening() {
    if (!this.evening) return;
    this.evening = 0;
    this.t = DAY + DUSK * 0.5;
  }

  // zum Testen: kurz vor die Dämmerung ('dusk') bzw. kurz vor den Morgen ('dawn') springen
  skipTo(phase) {
    this.t = phase === 'dawn' ? DAY + DUSK + NIGHT - 0.05 : DAY - 0.05;
  }
}
