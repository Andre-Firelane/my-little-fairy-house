# My Little Fairy House

Kinderspiel (ab 5 Jahren): ein magischer Baum im Querschnitt, dessen Höhlen das Kind in ein Feenhaus verwandelt.
Phaser 3 + Vite, Hochformat, Touch-first. Alle Animationen per Code (Sinus, Bezier, Tweens, Partikel).

## Starten

```
npm install
npm run dev      # http://localhost:5174
npm run tablet   # Build + Preview im WLAN, z. B. http://192.168.178.83:5174
```

`?fps` an die URL hängen zeigt die Bildrate.

## Struktur

```
src/
  main.js          Phaser-Config (1080×1920, Scale.FIT)
  config/          reine Daten: Layout, Slots, Raum-Definitionen
  systems/         motion (Mathe), juice (Tweens), particles (Glitzer), placement (Auswahl/Drop), draw (Formen)
  objects/         Slot, Room, Fairy
  scenes/          Boot (Texturen), Tree (Welt), UI (Kartenleiste)
public/assets/     spätere Grafiken & Sounds
art-source/        Roh-Grafiken (wird nicht ausgeliefert)
```
