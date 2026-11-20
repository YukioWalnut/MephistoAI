# Mephisto Chess ↔ Mephisto Chat live context bridge

This small bridge writes the current Chess match to the JSON file already read by Mephisto Chat:

`%APPDATA%\\Mephisto\\mephisto\\chess-live-context.json` on Windows.

The Chat application reads this file when it builds each LLM prompt. It uses the FEN, side to move, move list, actor attribution and PGN to answer questions about the current match.

## Important integration boundary

This repository contains the Chat-side reader, but the Chess application's move-handling source is not included here. Therefore this bridge does **not** automatically observe a separate Chess executable. The Chess app must call `writeChessLiveContext()` after every committed move (human or Mephisto), or invoke the CLI with a freshly generated JSON snapshot.

## Use from another Node.js application

Copy/import this module from the Chess app:

```js
const { writeChessLiveContext, clearChessLiveContext } =
  require('./integrations/chess-live-context/writer.cjs');

// Call after the board has accepted a move and its position/history are updated.
writeChessLiveContext({
  fen: game.fen(),
  playerColor: humanColor,       // exactly 'white' or 'black'
  sideToMove: game.turn() === 'w' ? 'white' : 'black',
  moveCount: game.history().length,
  moves: game.history({ verbose: true }).map((move, index) => ({
    ply: index + 1,
    color: move.color === 'w' ? 'white' : 'black',
    actor: move.color === mephistoColor ? 'Mephisto' : 'User',
    san: move.san,
    uci: move.from + move.to + (move.promotion || ''),
    from: move.from,
    to: move.to
  })),
  pgn: game.pgn(),
  status: game.isCheckmate() ? 'checkmate'
    : game.isDraw() ? 'draw'
    : game.isCheck() ? 'check' : 'in progress',
  isGameOver: game.isGameOver()
});

// When a new game starts, write its initial state too.
// When the game is closed or abandoned, clear the shared snapshot if appropriate:
// clearChessLiveContext();
```

Adapt the board-library calls to the Chess app's actual API. Do not label a move as Mephisto merely because it is the latest move: derive the actor from the color assigned to Mephisto. The move list should contain the full available game history in chronological order.

## Use the command-line writer

The Chess app can also export a JSON snapshot and call:

```powershell
node .\\integrations\\chess-live-context\\writer.cjs .\\current-game.json
```

The optional `--output <path>` argument overrides the default destination. To clear the snapshot:

```powershell
node .\\integrations\\chess-live-context\\writer.cjs --clear
```

## Data contract

Required fields: `fen`, `playerColor`, and `sideToMove`. Optional fields: `moveCount`, `moves`, `pgn`, `status`, `isGameOver`, and `lastMove`.

Each move may be a SAN string or an object with `ply`, `color`, `actor`, `san`, `uci`, `from`, and `to`. For reliable answers to “what move did you make?”, send object entries and set `actor` to `Mephisto` or `User`.

The writer validates required fields, limits payload sizes, writes to a temporary file and atomically renames it so Chat does not read a partially written JSON document. The Chat reader currently ignores snapshots older than 12 hours.

## Verification

1. Start a game and make one move for each side.
2. Confirm the JSON file timestamp and `moves` array update after each move.
3. Ask Mephisto Chat which move it made and whose turn it is.
4. Confirm its answer matches the `actor`, `san`, `fen` and `sideToMove` values in the snapshot.
