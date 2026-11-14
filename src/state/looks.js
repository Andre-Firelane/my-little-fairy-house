// Im Spiel gewähltes Aussehen der Feen (Fee antippen → ui/fairyLookMenu.js), je Fee (Name der Palette).
// Nur die Abweichungen von der Palette stehen hier; wird mit dem Haus gespeichert (state/house.js).
export const looks = {};

export const savedLook = (name) => looks[name];

export function setSavedLook(name, changes) {
  looks[name] = { ...looks[name], ...changes };
}

export function resetLooks(data = {}) {
  for (const k of Object.keys(looks)) delete looks[k];
  for (const [name, look] of Object.entries(data || {})) if (look && typeof look === 'object') looks[name] = { ...look };
}
