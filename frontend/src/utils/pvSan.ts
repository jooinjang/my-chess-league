import { Chess } from 'chess.js';

function parseUciMove(uci: string): { from: string; to: string; promotion?: string } | null {
  // Stockfish sometimes outputs a null-move token in PV (e.g. "0000"). Ignore it.
  if (uci.trim() === '0000') return null;
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci.trim());
  if (!m) return null;
  return { from: m[1], to: m[2], promotion: m[3] };
}

export function pvUciToSanLine(fen: string, pv: string[], maxPlies: number = 12): string {
  try {
    const game = new Chess(fen);
    const san: string[] = [];
    for (let i = 0; i < pv.length && i < maxPlies; i++) {
      const parsed = parseUciMove(pv[i]);
      // If parsing fails, still show raw PV token so the UI never becomes "blank".
      if (!parsed) {
        san.push(pv[i].trim());
        break;
      }
      const mv = game.move(parsed);
      // If chess.js rejects the move (can happen if the PV doesn't match the exact FEN,
      // or on certain engine edge-cases like '0000'), fall back to raw UCI for that token.
      if (!mv) {
        san.push(pv[i].trim());
        break;
      }
      san.push(mv.san);
    }
    return san.join(' ');
  } catch (e) {
    return pv.slice(0, maxPlies).join(' ');
  }
}
