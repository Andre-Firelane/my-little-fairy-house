import GhostHour from './ghostHour.js';

// Alle Events, die man im Event-Fenster (Glas antippen, siehe HudScene) mit Feenstaub starten kann.
// Jedes Event braucht ein volles Glas und leert es ganz. icon = Bildzeichen der Kachel (ui/icons.js),
// Happening = Klasse mit update(dt) / done
export const EVENTS = [{ id: 'ghost', icon: 'ghost', Happening: GhostHour }];

export const eventById = (id) => EVENTS.find((e) => e.id === id);
