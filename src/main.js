import Phaser from 'phaser';
import { GAME_W, GAME_H, fitWidth, setGameWidth } from './config/layout.js';
import BootScene from './scenes/BootScene.js';
import BackScene from './scenes/BackScene.js';
import TreeScene from './scenes/TreeScene.js';
import UIScene from './scenes/UIScene.js';
import RoomEditScene from './scenes/RoomEditScene.js';
import HudScene from './scenes/HudScene.js';
import MenuScene from './scenes/MenuScene.js';
import { setupFullscreen } from './ui/fullscreen.js';

setupFullscreen();
setGameWidth(fitWidth());

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2b2150',
  powerPreference: 'high-performance',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H,
  },
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, BackScene, TreeScene, UIScene, RoomEditScene, HudScene],
});

// Fenstergröße/Drehung geändert: Spielfläche an das neue Seitenverhältnis anpassen
// (die Szenen ordnen sich über das 'resize'-Ereignis der Scale-Verwaltung neu an)
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const w = fitWidth();
    if (w === GAME_W) return;
    setGameWidth(w);
    game.scale.setGameSize(w, GAME_H);
  }, 150);
});

if (import.meta.env.DEV) window.__game = game; // nur beim Entwickeln: für Tests im Browser

// ?fps → Bildrate unten links (zum Testen auf dem Tablet)
if (new URLSearchParams(location.search).has('fps')) {
  const box = Object.assign(document.createElement('div'), {
    style: 'position:fixed;left:4px;bottom:4px;z-index:99;font:bold 14px monospace;color:#fff;background:#000a;padding:2px 6px;pointer-events:none',
  });
  document.body.append(box);
  setInterval(() => (box.textContent = `${Math.round(game.loop.actualFps)} fps`), 500);
}
