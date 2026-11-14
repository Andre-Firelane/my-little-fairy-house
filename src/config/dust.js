// Feenstaub: alle Stellschrauben an einer Stelle.
// Feenstaub gibt es nur für erfüllte Wünsche: eine Fee hat eine rosa Wunschblase, man zieht sie auf den passenden
// Gegenstand im selben Raum. Er fliegt ins Glas oben rechts.
// Nur mit vollem Glas lässt sich ein Event auslösen, und jedes Event leert das Glas ganz.

export const GLASS = 200; // so viel Staub passt in ein Glas
export const NEED_DUST = 40; // Staub für einen erfüllten Wunsch (5 Wünsche = volles Glas)
export const NEED_EVERY = [18, 35]; // Sekunden, bis in einem Zimmer wieder eine Fee einen Wunsch hat
export const NEED_LASTS = 60; // so lange wartet eine Fee auf Hilfe, dann verblasst der Wunsch
export const NEED_PAUSE = 40; // nach einem erfüllten Wunsch hat diese Fee so lange keinen neuen

// Geisterstunde
export const GHOST_NIGHT_EXTRA = 70; // so viele Sekunden dauert die Nacht länger als sonst (normal: 50)
