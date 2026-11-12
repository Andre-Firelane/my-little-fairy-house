import { textureKey, furnitureById } from '../config/furniture.js';
import { glyphBox, BOARD_ROWS } from '../systems/chalk.js';
import { pick, rand } from '../systems/motion.js';

const isBoard = (def) => def.id === 'tafel';
const lines = (s) => s.item.notes?.length ?? 0;

// Rezept als Bildzeichen: Zutat (+ Zutat) → Trankflasche in der Farbe des Tranks
function recipeGlyphs(recipe) {
  const ing = recipe.ings.map((id) => {
    const d = furnitureById(id);
    return { t: d.glyph, c: d.ingredient };
  });
  const out = [ing[0]];
  if (ing[1]) out.push({ t: 'plus' }, ing[1]);
  out.push({ t: 'arrow' }, { t: 'flask', c: recipe.color });
  return out;
}

// ohne neues Rezept malen die Feen einfach etwas Schönes
function doodleGlyphs() {
  const shapes = ['star', 'heart', 'flower', 'squiggle'];
  const colors = [undefined, 0xffc8f0, 0xfff3a8, 0xb9f2ff];
  const n = 3 + Math.floor(Math.random() * 3);
  return Array.from({ length: n }, () => ({ t: pick(shapes), c: pick(colors) }));
}

// Mitte eines Zeichens in Szenen-Koordinaten
function glyphScene(c, board, row, col) {
  const b = glyphBox(board.def.board, row, col);
  const l = board.artToLocal(b.x + b.size / 2, b.y + b.size / 2);
  return c.at(l.x, l.y);
}

// Rezept (oder Bild) an die Tafel schreiben – Zeichen für Zeichen mit Kreidestaub
export const write = {
  id: 'write',
  icon: textureKey('tafel'),
  uses: isBoard,
  available: (s) => lines(s) < BOARD_ROWS,

  async run(c, board) {
    const { f, scene } = c;
    c.think(this.icon, 1.4);
    await c.wait(0.9);

    const row = lines(board);
    c.ensure(row < BOARD_ROWS);
    const recipe = c.life.state.lastRecipe;
    const fresh = recipe && board.item.written !== recipe.key;
    const glyphs = fresh ? recipeGlyphs(recipe) : doodleGlyphs();
    c.onAbort(() => board.item && board.setLook(board.item)); // halbe Zeile verschwindet

    f.pose.face = 1;
    f.pose.tilt = 0.12;
    f.pose.bob = 0.3;
    for (let col = 0; col < glyphs.length; col++) {
      const at = glyphScene(c, board, row, col);
      await c.fly(at.x + 26, at.y + 26, 150);
      c.ensure(c.alive(board));
      for (let k = 1; k <= 10; k++) {
        board.renderBoard(board.item.notes, { row, glyphs, progress: (col + k / 10) / glyphs.length });
        if (k % 3 === 0) c.sparkles.twinkle(at.x + rand(-10, 10), at.y + rand(-10, 10), 1);
        await c.wait(0.06);
      }
    }
    board.item.notes = [...(board.item.notes || []), { glyphs }];
    if (fresh) board.item.written = recipe.key;
    board.setLook(board.item);
    f.resetPose();
    await c.wait(0.5);
  },
};

// volle Tafel wegwischen: Fee wischt in großen Kreisen, die Kreide verblasst
export const wipe = {
  id: 'wipe',
  icon: textureKey('tafel'),
  uses: isBoard,
  available: (s) => lines(s) >= BOARD_ROWS,

  async run(c, board) {
    const { f, scene } = c;
    c.think(this.icon, 1.4);
    await c.wait(0.9);
    const mid = c.at(board.x, board.y - board.H * 0.55);
    await c.fly(mid.x, mid.y + 20);
    c.ensure(c.alive(board));

    f.pose.orbit = 70;
    f.pose.orbitSpeed = 6;
    f.pose.bob = 0.2;
    c.onAbort(() => board.boardLayer?.setAlpha(1));
    for (let i = 1; i <= 12; i++) {
      board.boardLayer.setAlpha(1 - i / 12);
      c.sparkles.twinkle(f.x, f.y + 10, 2);
      await c.wait(0.18);
      c.ensure(c.alive(board));
    }
    board.item.notes = [];
    board.setLook(board.item);
    board.boardLayer.setAlpha(1);
    f.resetPose();
    await c.wait(0.4);
  },
};
