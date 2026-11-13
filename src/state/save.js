// Spielstand im Browser (localStorage), wie in My Little Zoo: alle 5 Minuten, wenn die Seite in den Hintergrund geht,
// beim Zurück ins Hauptmenü und von Hand im Spielmenü. Das Test-Spiel speichert nie (der echte Stand bleibt unberührt).
import { restore } from './house.js';

const KEY = 'fairy-house-save';
const VERSION = 1;
const AUTOSAVE_EVERY = 5 * 60 * 1000;

export const save = { testMode: false, lastSaved: null };

// Die Baum-Szene trägt hier ein, wie sie ihren Stand ablegt (null: gerade kein Spiel)
export const saveHandlers = { snapshot: null };

export function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s?.version === VERSION && s.game ? s : null;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  if (save.testMode) return false;
  try {
    const now = Date.now();
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, savedAt: now, game }));
    save.lastSaved = now;
    return true;
  } catch {
    return false;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  save.lastSaved = null;
}

// gespeicherten Stand ins Haus übernehmen; false, wenn es keinen gibt
export function loadSave() {
  const s = readSave();
  if (!s) return false;
  restore(s.game);
  save.lastSaved = s.savedAt;
  return true;
}

export function saveNow() {
  if (save.testMode || !saveHandlers.snapshot) return false;
  return writeSave(saveHandlers.snapshot());
}

let autosaveOn = false;
export function setupAutosave() {
  if (autosaveOn) return;
  autosaveOn = true;
  setInterval(saveNow, AUTOSAVE_EVERY);
  // Tablet: Browser wird weggewischt oder der Bildschirm geht aus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);
}
