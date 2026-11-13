// Feenstaub: alle Stellschrauben an einer Stelle.
// Feen erzeugen Staub, wenn sie eine Tätigkeit fertig machen (Lieblingstätigkeit: mehr). Er fliegt ins Glas oben rechts.
// Nur mit vollem Glas lässt sich ein Event auslösen, und jedes Event leert das Glas ganz.

export const GLASS = 200; // so viel Staub passt in ein Glas
export const PER_ACTIVITY = 3; // Staub für eine fertige Tätigkeit
export const LIKED_BONUS = 2; // Faktor bei einer Lieblingstätigkeit (likes ≥ LIKED_AT)
export const LIKED_AT = 3;

// Geisterstunde
export const GHOST_NIGHT_EXTRA = 70; // so viele Sekunden dauert die Nacht länger als sonst (normal: 50)
