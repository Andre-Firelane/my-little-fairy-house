// Tag und Nacht. Der Tag ist lang, die Nacht kurz; dazwischen Dämmerung und Morgen als Übergang.
// night = true von Beginn der Dämmerung bis zum Morgen (dann gehen die Feen schlafen bzw. sind im Bett).
// darkness 0 (Tag) … 1 (Nacht), weich übergeblendet – davon hängt ab, wie dunkel Baum, Himmel und Räume sind.
// Zum Testen: ?zeit=10 lässt die Zeit zehnmal so schnell laufen.

export const DAY = 210;
export const DUSK = 10;
export const NIGHT = 50;
export const DAWN = 10;
const CYCLE = DAY + DUSK + NIGHT + DAWN;

const speed = Number(new URLSearchParams(location.search).get('zeit')) || 1;

export default class DayNight {
  constructor(start = 0) {
    this.t = start;
    this.night = false;
    this.darkness = 0;
  }

  update(dt) {
    this.t = (this.t + dt * speed) % CYCLE;
    const t = this.t;
    let d;
    if (t < DAY) d = 0;
    else if (t < DAY + DUSK) d = (t - DAY) / DUSK;
    else if (t < DAY + DUSK + NIGHT) d = 1;
    else d = 1 - (t - DAY - DUSK - NIGHT) / DAWN;
    this.darkness = d * d * (3 - 2 * d);
    this.night = t >= DAY && t < DAY + DUSK + NIGHT;
  }

  // zum Testen: kurz vor die Dämmerung ('dusk') bzw. kurz vor den Morgen ('dawn') springen
  skipTo(phase) {
    this.t = phase === 'dawn' ? DAY + DUSK + NIGHT - 0.05 : DAY - 0.05;
  }
}
