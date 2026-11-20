'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_FILE = path.join(
  process.env.APPDATA || path.join(process.env.HOME || process.cwd(), '.config'),
  'Mephisto', 'mephisto', 'chess-live-context.json'
);

function normalizeContext(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Chess context must be a JSON object.');
  if (typeof input.fen !== 'string' || !input.fen.trim()) throw new TypeError('Chess context requires a non-empty FEN string.');
  if (!['white', 'black'].includes(input.playerColor)) throw new TypeError("playerColor must be 'white' or 'black'.");
  if (!['white', 'black'].includes(input.sideToMove)) throw new TypeError("sideToMove must be 'white' or 'black'.");
  const moves = Array.isArray(input.moves) ? input.moves.slice(-500) : [];
  const cleanMoves = moves.map((move, index) => {
    if (typeof move === 'string') return move.slice(0, 40);
    if (!move || typeof move !== 'object') throw new TypeError('Each move must be a SAN string or a move object.');
    const color = ['white', 'black'].includes(move.color) ? move.color : undefined;
    const actor = ['Mephisto', 'User'].includes(move.actor) ? move.actor : undefined;
    return {
      ply: Number.isInteger(move.ply) && move.ply > 0 ? move.ply : index + 1,
      ...(color ? { color } : {}), ...(actor ? { actor } : {}),
      san: String(move.san || '').slice(0, 40), uci: String(move.uci || '').slice(0, 20),
      from: String(move.from || '').slice(0, 8), to: String(move.to || '').slice(0, 8)
    };
  });
  return {
    schemaVersion: 1, updatedAt: new Date().toISOString(), fen: input.fen.trim().slice(0, 200),
    playerColor: input.playerColor, sideToMove: input.sideToMove,
    moveCount: Number.isInteger(input.moveCount) && input.moveCount >= 0 ? input.moveCount : cleanMoves.length,
    moves: cleanMoves, pgn: String(input.pgn || '').slice(0, 12000),
    status: String(input.status || 'in progress').slice(0, 80), isGameOver: Boolean(input.isGameOver),
    ...(input.lastMove && typeof input.lastMove === 'object' ? { lastMove: {
      ply: Number(input.lastMove.ply) || cleanMoves.length,
      color: String(input.lastMove.color || '').slice(0, 8),
      actor: ['Mephisto', 'User'].includes(input.lastMove.actor) ? input.lastMove.actor : undefined,
      san: String(input.lastMove.san || '').slice(0, 40), uci: String(input.lastMove.uci || '').slice(0, 20),
      from: String(input.lastMove.from || '').slice(0, 8), to: String(input.lastMove.to || '').slice(0, 8)
    } } : {})
  };
}

function writeChessLiveContext(input, filePath = DEFAULT_FILE) {
  const context = normalizeContext(input);
  const target = path.resolve(filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = \`\${target}.\${process.pid}.\${Date.now()}.tmp\`;
  try {
    fs.writeFileSync(temp, JSON.stringify(context, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, target);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
  return target;
}

function clearChessLiveContext(filePath = DEFAULT_FILE) {
  try { fs.unlinkSync(path.resolve(filePath)); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

module.exports = { DEFAULT_FILE, normalizeContext, writeChessLiveContext, clearChessLiveContext };

if (require.main === module) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : DEFAULT_FILE;
  if (args.includes('--clear')) {
    clearChessLiveContext(output);
    process.stdout.write('Cleared chess context: ' + output + '\n');
  } else {
    const inputFile = args.find((arg, index) => arg !== '--output' && index !== outputIndex + 1);
    if (!inputFile) {
      process.stderr.write('Usage: node writer.cjs <context.json> [--output <path>] | --clear [--output <path>]\n');
      process.exitCode = 2;
    } else {
      const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      process.stdout.write('Wrote chess context: ' + writeChessLiveContext(input, output) + '\n');
    }
  }
}
