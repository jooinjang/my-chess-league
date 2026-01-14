import { MoveAnnotation, MoveJudgement } from "../types/analysis";
import { Chess } from "chess.js";

// ============================================================================
// En-Croissant Style Analysis (https://github.com/franciscoBSalgueiro/en-croissant)
// ============================================================================

const CP_CEILING = 1000;

/**
 * Calculate win probability from centipawns
 * Formula from en-croissant: 50 + 50 * (2 / (1 + e^(-0.00368208 * cp)) - 1)
 */
export function getWinChance(centipawns: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Normalize score to centipawns from player's perspective
 * - Flip sign for black
 * - Cap mate scores at ±1000 centipawns
 */
export function normalizeScore(
  score: number,
  isWhite: boolean,
  isMate: boolean = false
): number {
  let cp = score;
  if (!isWhite) {
    cp *= -1;
  }
  if (isMate) {
    cp = CP_CEILING * Math.sign(cp);
  }
  return Math.max(-CP_CEILING, Math.min(CP_CEILING, cp));
}

/**
 * Calculate move accuracy using en-croissant formula
 * Formula: 103.1668 * exp(-0.04354 * winChanceLoss) - 3.1669 + 1
 * Clamped between 0-100
 */
export function calculateMoveAccuracy(
  evalBefore: number,
  evalAfter: number,
  _bestMoveEval: number
): number {
  const winChanceBefore = getWinChance(evalBefore);
  const winChanceAfter = getWinChance(evalAfter);
  const winChanceLoss = winChanceBefore - winChanceAfter;

  const accuracy = 103.1668 * Math.exp(-0.04354 * winChanceLoss) - 3.1669 + 1;

  return clamp(accuracy, 0, 100);
}

/**
 * Calculate centipawn loss
 */
export function getCPLoss(evalBefore: number, evalAfter: number): number {
  return Math.max(0, evalBefore - evalAfter);
}

export interface ClassifyMoveContext {
  evalBefore: number; // player's perspective (cp-equivalent)
  evalAfter: number; // player's perspective (cp-equivalent)
  bestMove: string;
  mateInfo?: { before?: number; after?: number; bestMove?: number };
  isBestMove?: boolean;
  isOnlyMove?: boolean;
  secondBestEvalBefore?: number; // player's perspective (cp-equivalent)
  materialDelta?: number; // player's material delta (after-before), in pawns
  isBook?: boolean;
}

function thresholdsFor(winChanceBefore: number): {
  inacc: number;
  mistake: number;
  blunder: number;
} {
  // Chess.com tends to be more forgiving in already-won/lost positions and stricter near equality.
  // These thresholds are in *win chance percentage points*.
  const wc = clamp(winChanceBefore, 0, 100);
  if (wc >= 80 || wc <= 20) return { inacc: 6, mistake: 12, blunder: 25 };
  if (wc >= 65 || wc <= 35) return { inacc: 5, mistake: 10, blunder: 20 };
  return { inacc: 4, mistake: 8, blunder: 15 };
}

export function classifyMove(ctx: ClassifyMoveContext): {
  annotation: MoveAnnotation;
  judgement: MoveJudgement;
  reason: string;
  winChanceBefore: number;
  winChanceAfter: number;
  winChanceLoss: number;
  cpl: number;
} {
  const {
    evalBefore,
    evalAfter,
    bestMove,
    mateInfo,
    isBestMove,
    isOnlyMove,
    secondBestEvalBefore,
    materialDelta = 0,
    isBook,
  } = ctx;

  // Mate-specific classification first (player perspective mateInfo is passed in by caller)
  if (
    mateInfo?.before &&
    mateInfo.before > 0 &&
    (!mateInfo.after || mateInfo.after <= 0)
  ) {
    return {
      annotation: "??",
      judgement: "miss",
      reason: "Missed forced checkmate",
      winChanceBefore: 100,
      winChanceAfter: 50,
      winChanceLoss: 50,
      cpl: getCPLoss(evalBefore, evalAfter),
    };
  }
  if (!mateInfo?.before && mateInfo?.after && mateInfo.after < 0) {
    return {
      annotation: "??",
      judgement: "blunder",
      reason: `Allows mate in ${Math.abs(mateInfo.after)}`,
      winChanceBefore: 50,
      winChanceAfter: 0,
      winChanceLoss: 50,
      cpl: getCPLoss(evalBefore, evalAfter),
    };
  }

  const winChanceBefore = getWinChance(evalBefore);
  const winChanceAfter = getWinChance(evalAfter);
  const winChanceLoss = winChanceBefore - winChanceAfter; // + = worse for mover
  const cpl = getCPLoss(evalBefore, evalAfter);
  const th = thresholdsFor(winChanceBefore);

  // Book overrides (only when the move isn't a clear mistake)
  if (isBook && winChanceLoss <= 1.0) {
    return {
      annotation: null,
      judgement: "book",
      reason: "",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }

  const isBest = isBestMove === true;
  const isOnly = isOnlyMove === true;
  const hasSecond = secondBestEvalBefore !== undefined;
  const gapToSecond = hasSecond
    ? Math.max(0, evalBefore - (secondBestEvalBefore as number))
    : 0;

  // Brilliant / Great heuristics:
  // - Sacrifice (material loss) while maintaining near-best outcome
  // - Only-move situations where the player finds the best defense/offense
  if (isBest && materialDelta <= -3 && winChanceLoss <= 1.5) {
    const why = isOnly
      ? "Brilliant sacrifice (only move)"
      : "Brilliant sacrifice";
    return {
      annotation: "!!",
      judgement: "brilliant",
      reason: why,
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  if (isBest && isOnly && winChanceLoss <= 0.8) {
    return {
      annotation: "!",
      judgement: "great",
      reason: "Great move (only move)",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  if (isBest && hasSecond && gapToSecond >= 180 && winChanceLoss <= 0.8) {
    return {
      annotation: "!",
      judgement: "great",
      reason: "Great move (big gap to alternatives)",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }

  // Negative winChanceLoss => improvement for mover
  if (winChanceLoss < -12) {
    return {
      annotation: "!!",
      judgement: "brilliant",
      reason: "Brilliant: big swing",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  if (winChanceLoss < -6) {
    return {
      annotation: "!",
      judgement: "great",
      reason: "Great: improves winning chances",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }

  // Errors (winChanceLoss is positive)
  if (winChanceLoss > th.blunder) {
    return {
      annotation: "??",
      judgement: "blunder",
      reason: `Blunder: better was ${bestMove}`,
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  if (winChanceLoss > th.mistake) {
    return {
      annotation: "?",
      judgement: "mistake",
      reason: `Mistake: better was ${bestMove}`,
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  if (winChanceLoss > th.inacc) {
    return {
      annotation: "?!",
      judgement: "inaccuracy",
      reason: `Inaccuracy: better was ${bestMove}`,
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }

  // Best/Excellent/Good/Normal (no symbol)
  if (isBest && winChanceLoss <= 1.0) {
    return {
      annotation: null,
      judgement: "best",
      reason: "Best move",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  if (winChanceLoss <= 1.0) {
    return {
      annotation: null,
      judgement: "excellent",
      reason: "",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  if (winChanceLoss <= 2.0) {
    return {
      annotation: null,
      judgement: "good",
      reason: "",
      winChanceBefore,
      winChanceAfter,
      winChanceLoss,
      cpl,
    };
  }
  return {
    annotation: null,
    judgement: "normal",
    reason: "",
    winChanceBefore,
    winChanceAfter,
    winChanceLoss,
    cpl,
  };
}

/**
 * Get move annotation based on win chance difference
 * Using en-croissant thresholds:
 * - winChanceDiff > 20 → ?? (Blunder)
 * - winChanceDiff > 10 → ? (Mistake)
 * - winChanceDiff > 5 → ?! (Inaccuracy)
 */
export function calculateAnnotation(
  evalBefore: number,
  evalAfter: number,
  _bestMoveEval: number,
  _isPlayerWhite: boolean,
  bestMove: string,
  mateInfo?: { before?: number; after?: number; bestMove?: number },
  context?: {
    secondBestEvalBefore?: number; // player's perspective, cp-equivalent (mate mapped)
    isBestMove?: boolean;
    isOnlyMove?: boolean; // "유일수/강제수" 힌트
    materialDelta?: number; // player's material change (after - before), pawns (e.g. -3 = sacrificed a piece)
  }
): { annotation: MoveAnnotation; judgement: MoveJudgement; reason: string } {
  const r = classifyMove({
    evalBefore,
    evalAfter,
    bestMove,
    mateInfo,
    isBestMove: context?.isBestMove,
    isOnlyMove: context?.isOnlyMove,
    secondBestEvalBefore: context?.secondBestEvalBefore,
    materialDelta: context?.materialDelta,
  });
  return { annotation: r.annotation, judgement: r.judgement, reason: r.reason };
}

export function getMaterialBalancePawns(fen: string): {
  white: number;
  black: number;
} {
  const game = new Chess(fen);
  const board = game.board();
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let white = 0;
  let black = 0;
  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      const v = values[piece.type] ?? 0;
      if (piece.color === "w") white += v;
      else black += v;
    }
  }
  return { white, black };
}

// Legacy exports for compatibility
export const winProbability = getWinChance;

export function formatEvaluation(score: number, mate?: number): string {
  if (mate !== undefined) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  const sign = score >= 0 ? "+" : "";
  return `${sign}${(score / 100).toFixed(2)}`;
}

export function getEvalBarPercentage(score: number, mate?: number): number {
  if (mate !== undefined) {
    return mate > 0 ? 100 : 0;
  }
  // Clamp between -1000 and 1000 centipawns for display
  const clampedScore = Math.max(-1000, Math.min(1000, score));
  // Convert to 0-100 scale (50 = equal)
  return 50 + clampedScore / 20;
}
