import GhostHour from './ghostHour.js';
import LightFestival from './lightFestival.js';
import SpringFestival from './springFestival.js';
import FirstSnow from './firstSnow.js';

// Alle Events, die man im Event-Fenster (Glas antippen, siehe HudScene) mit Feenstaub starten kann.
// Jedes Event braucht ein volles Glas und leert es ganz. icon = Bildzeichen der Kachel (ui/icons.js),
// Happening = Klasse mit update(dt) / done
export const EVENTS = [
  { id: 'ghost', icon: 'ghost', Happening: GhostHour },
  { id: 'lights', icon: 'lantern', Happening: LightFestival },
  { id: 'spring', icon: 'blossom', Happening: SpringFestival },
  { id: 'snow', icon: 'snowflake', Happening: FirstSnow },
];

export const eventById = (id) => EVENTS.find((e) => e.id === id);
