export type MoveAnnotation = '!!' | '!' | '!?' | '?!' | '?' | '??' | null;

export type MoveJudgement =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'miss'
  | 'mistake'
  | 'blunder'
  | 'book'
  | 'normal';

export interface EngineEvaluation {
  depth: number;
  score: number;           // Centipawns (positive = white advantage)
  mate?: number;           // Mate in N moves (positive = white wins)
  pv: string[];            // Principal variation
  multiPv?: number;        // MultiPV line index (1 = best line)
  nodes?: number;
  time?: number;
  nps?: number;            // Nodes per second
}

export interface MoveAnalysis {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;              // Standard Algebraic Notation
  fen: string;              // Position after move
  evalBefore: number;       // From moving player's perspective
  evalAfter: number;        // From moving player's perspective (for accuracy)
  evalAfterWhite: number;   // From White's perspective (for graph)
  mateBeforeWhite?: number; // Mate distance from White's perspective (optional)
  mateAfterWhite?: number;  // Mate distance from White's perspective (optional)
  judgement: MoveJudgement;
  bestMove: string;
  bestMoveEval: number;
  evalLoss: number;
  annotation: MoveAnnotation;
  annotationReason: string;
  pv: string[];

  // ---- Review / Game Report fields (optional for backward compatibility) ----
  // Win chance is always from the moving player's perspective (0-100).
  winChanceBefore?: number;
  winChanceAfter?: number;
  winChanceLoss?: number; // positive = worse for the mover
  cpl?: number;           // centipawn loss (player perspective, cp)

  // Opening / book
  isBook?: boolean;
  openingName?: string;
  eco?: string;
  openingNameRoot?: string;
  ecoRoot?: string;
  variationName?: string;
  variationEco?: string;
  bookPlies?: number;
  openingContinuations?: string[];

  // Key moments / swings
  isKeyMoment?: boolean;
  swingCp?: number;        // player perspective: after - before (cp)
  swingWinChance?: number; // player perspective: after - before (percentage points)

  // Extra context from MultiPV
  secondBestMove?: string;
  secondBestEval?: number; // player perspective (cp-equivalent)
  onlyMove?: boolean;

  // Sacrifice context (player material delta in pawns, after - before)
  materialDelta?: number;
}

export interface GameAnalysis {
  matchId: number;
  moves: MoveAnalysis[];
  whitePlayer: string;
  blackPlayer: string;
  result: string;

  // Statistics
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteBlunders: number;
  whiteMistakes: number;
  whiteInaccuracies: number;
  blackBlunders: number;
  blackMistakes: number;
  blackInaccuracies: number;

  analysisDepth: number;
  analysisDate: string;
}

export interface AnalysisProgress {
  currentMove: number;
  totalMoves: number;
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  errorMessage?: string;
}

export interface ChessMove {
  san: string;
  from: string;
  to: string;
  color: 'w' | 'b';
  piece: string;
  flags: string;
  fen: string;
}

// Move tree node for variation support
export interface MoveNode {
  id: string;                  // Unique identifier
  move: ChessMove | null;      // null for root node
  fen: string;                 // Position after this move
  children: MoveNode[];        // First child is main line continuation
  parent: MoveNode | null;
  isMainLine: boolean;         // Whether this node is on the main line
  depth: number;               // Depth in tree (0 for root)
  moveIndex: number;           // Move number in the line (-1 for root)
}

// Path to a node in the tree
export type MovePath = number[];
