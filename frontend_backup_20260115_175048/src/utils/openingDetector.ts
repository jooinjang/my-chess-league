// IMPORTANT: Deep import to avoid bundling Node-only Polyglot reader (fs).
import { ECO } from "chess-openings/dist/chess/openings/book/eco";
import { Chess } from "chess.js";

export interface OpeningMatch {
  eco: string;
  name: string;
  ply: number; // ply index in main line where this label applies (0 = start position)
}

export interface OpeningDetection {
  // A more general parent opening (if found).
  opening?: OpeningMatch;
  // The most specific line that matches (variation line).
  variation: OpeningMatch;
  // How many plies at start are considered book (number of moves in the game that match the book).
  bookPlies: number;
  // The ply where book ends (same as bookPlies), provided for clarity.
  bookEndPly: number;
  // Candidate continuations at the book end position (notation as provided by the ECO book).
  continuations: string[];
}

function normalizeSan(san: string): string {
  // Remove trailing check/mate and annotation symbols used in PGN/commentary.
  // Keep castles and promotions intact.
  return san
    .trim()
    .replace(/[+#]$/g, "")
    .replace(/(\!\?|\?\!|\!\!|\?\?|\!|\?)$/g, "")
    .replace(/\s+/g, " ");
}

const ecoBook = new ECO();

function fenToEpdKey(fen: string): string {
  // chess-openings ECO lookup uses EPD-style key (FEN first 4 fields).
  return fen.split(/\s+/).slice(0, 4).join(" ");
}

function normalizeBookMoveToken(token: string): string {
  // The ECO dataset continuation tokens can be in SAN-ish notation; normalize similarly.
  return normalizeSan(token);
}

function isUciToken(token: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token.trim());
}

function sanToUci(fen: string, sanToken: string): string | null {
  try {
    const game = new Chess(fen);
    // chess.js supports sloppy parsing as option; keep compatibility via any.
    const mv = (game as any).move(sanToken, { sloppy: true }) as any;
    if (!mv) return null;
    const from = String(mv.from);
    const to = String(mv.to);
    const promo = mv.promotion ? String(mv.promotion) : "";
    return (from + to + promo).toLowerCase();
  } catch {
    return null;
  }
}

export function getEcoContinuations(fen: string): string[] {
  const entry = ecoBook.lookupSync(fenToEpdKey(fen)) as any;
  if (!entry || typeof entry.continuations !== "function") return [];
  const cont = entry.continuations() as Array<{ move: string }>;
  return cont.map((c) => String(c.move));
}

/**
 * Detect opening + most specific variation using ECO by walking the game main line positions.
 *
 * @param positions - array of FENs: positions[0]=start, positions[i] = after i plies
 * @param mainLineSans - SAN moves: mainLineSans[i] = ply i+1 move SAN
 */
export function detectOpeningWithVariation(
  positions: string[],
  mainLineSans: string[]
): OpeningDetection | null {
  if (!positions || positions.length === 0) return null;
  const plies = Math.min(
    Math.max(0, positions.length - 1),
    mainLineSans?.length ?? 0
  );

  let openingTrail: OpeningMatch[] = [];
  let bookPlies = 0;
  let firstClassifiedPly: number | null = null;
  let lastContinuations: string[] = [];

  for (let ply = 0; ply <= plies; ply++) {
    const fen = positions[ply];
    if (!fen) break;

    const key = fenToEpdKey(fen);
    const entry = ecoBook.lookupSync(key) as any;
    if (!entry) {
      // Some ECO datasets don't classify the initial position (ply=0).
      // In that case, keep walking until we hit the first classified position.
      if (ply === 0) continue;
      // No longer in ECO classification at this position
      break;
    }

    if (firstClassifiedPly === null) firstClassifiedPly = ply;
    // If the game first becomes classifiable at ply>0 (e.g., after 1.d4),
    // mark the prior moves as "book" baseline even if continuation matching fails immediately.
    if (bookPlies === 0 && ply > 0) {
      bookPlies = ply;
    }

    // Record trail when it changes
    const eco = String(entry.code ?? "");
    const name = String(entry.name ?? "");
    const prev = openingTrail[openingTrail.length - 1];
    if (!prev || prev.eco !== eco || prev.name !== name) {
      openingTrail.push({ eco, name, ply });
    }

    // For book plies, check whether the next played move is within ECO continuations
    if (ply < plies) {
      const cont =
        typeof entry.continuations === "function"
          ? (entry.continuations() as Array<{ move: string }>)
          : [];
      const contTokens = cont.map((c) => String(c.move));
      const contMoves = contTokens.map((t) => normalizeBookMoveToken(t));
      lastContinuations = cont.map((c) => String(c.move));

      const played = normalizeSan(mainLineSans[ply]);
      const playedUci = sanToUci(fen, mainLineSans[ply]);
      const contUciTokens = contTokens
        .filter(isUciToken)
        .map((t) => t.toLowerCase());
      const nextFen = positions[ply + 1];
      const nextEntry = nextFen
        ? (ecoBook.lookupSync(fenToEpdKey(nextFen)) as any)
        : null;
      const matchBySan = contMoves.includes(played);
      const matchByUci = playedUci ? contUciTokens.includes(playedUci) : false;
      const matchByEcoPresence = Boolean(nextEntry);
      if (matchBySan || matchByUci || matchByEcoPresence) {
        bookPlies = ply + 1;
        continue;
      } else {
        // The game deviated from the book continuations here.
        break;
      }
    }
  }

  if (openingTrail.length === 0) return null;

  const variation = openingTrail[openingTrail.length - 1];
  const opening = openingTrail.length > 1 ? openingTrail[0] : undefined;

  // If the starting position isn't classified (common), we may still have a classified position
  // after the first few plies. In that case, treat the moves up to the first classified ply as "book"
  // so the UI doesn't show EXCELLENT for obvious opening moves like "d4".
  if (
    bookPlies === 0 &&
    firstClassifiedPly !== null &&
    firstClassifiedPly > 0
  ) {
    bookPlies = firstClassifiedPly;
  }

  return {
    opening,
    variation,
    bookPlies,
    bookEndPly: bookPlies,
    continuations: lastContinuations,
  };
}
