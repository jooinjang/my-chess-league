import { useState, useEffect, useCallback, useRef } from 'react';
import { EngineEvaluation, MoveAnalysis, AnalysisProgress, ChessMove } from '../types/analysis';
import { calculateAnnotation, getMaterialBalancePawns, getWinChance, classifyMove } from '../utils/analysisUtils';

// Stockfish 17.1 ES6 module interface (lila-stockfish-web)
interface StockfishModule {
  uci(command: string): void;
  listen(callback: (msg: string) => void): void;
  onError(callback: (msg: string) => void): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StockfishFactory = (options?: {
  locateFile?: (file: string) => string;
  listen?: (msg: string) => void;
  onError?: (msg: string) => void;
}) => Promise<any>;

// Load Stockfish module at runtime using dynamic import
async function loadStockfishModule(): Promise<StockfishFactory | null> {
  try {
    // Use Function constructor to avoid Vite's static analysis
    const dynamicImport = new Function('url', 'return import(url)');
    const module = await dynamicImport('/stockfish/sf17_1-7.js');
    return module.default || module;
  } catch (error) {
    console.error('Failed to load Stockfish module:', error);
    return null;
  }
}

interface UseStockfishReturn {
  isReady: boolean;
  isAnalyzing: boolean;
  currentEval: EngineEvaluation | null;
  topLines: EngineEvaluation[];
  progress: AnalysisProgress;
  analyzePosition: (fen: string, depth?: number, multiPv?: number) => Promise<EngineEvaluation[]>;
  analyzeTopLines: (fen: string, depth?: number, multiPv?: number) => Promise<EngineEvaluation[]>;
  analyzeGame: (moves: ChessMove[], positions: string[], depth?: number) => Promise<MoveAnalysis[]>;
  stopAnalysis: () => void;
}

function parseInfoLine(line: string): EngineEvaluation | null {
  if (!line.startsWith('info') || !line.includes('score')) return null;

  const depthMatch = line.match(/depth (\d+)/);
  const multiPvMatch = line.match(/multipv (\d+)/);
  const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
  // IMPORTANT: avoid matching the "pv" substring inside "multipv"
  const pvMatch = line.match(/(?:^|\s)pv\s(.+)/);
  const nodesMatch = line.match(/nodes (\d+)/);
  const timeMatch = line.match(/time (\d+)/);
  const npsMatch = line.match(/nps (\d+)/);

  if (!depthMatch || !scoreMatch) return null;

  const isMate = scoreMatch[1] === 'mate';
  const scoreValue = parseInt(scoreMatch[2], 10);

  return {
    depth: parseInt(depthMatch[1], 10),
    // For mate scores, score is not meaningful as centipawns.
    // Keep mate in `mate` and let callers map to a cp-equivalent when needed.
    score: isMate ? 0 : scoreValue,
    mate: isMate ? scoreValue : undefined,
    pv: pvMatch ? pvMatch[1].trim().split(/\s+/).filter(Boolean) : [],
    multiPv: multiPvMatch ? parseInt(multiPvMatch[1], 10) : undefined,
    nodes: nodesMatch ? parseInt(nodesMatch[1], 10) : undefined,
    time: timeMatch ? parseInt(timeMatch[1], 10) : undefined,
    nps: npsMatch ? parseInt(npsMatch[1], 10) : undefined,
  };
}

const CP_CEILING = 1000;
function toWhitePerspectiveScore(fen: string, evaln: EngineEvaluation): { cpWhite: number; mateWhite?: number } {
  const isWhiteToMove = (fen.split(' ')[1] || 'w') === 'w';
  const mateWhite =
    evaln.mate !== undefined ? (isWhiteToMove ? evaln.mate : -evaln.mate) : undefined;
  if (mateWhite !== undefined) {
    return { cpWhite: CP_CEILING * Math.sign(mateWhite), mateWhite };
  }
  const cpWhite = isWhiteToMove ? evaln.score : -evaln.score;
  return { cpWhite, mateWhite: undefined };
}

export function useStockfish(): UseStockfishReturn {
  const [isReady, setIsReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentEval, setCurrentEval] = useState<EngineEvaluation | null>(null);
  const [topLines, setTopLines] = useState<EngineEvaluation[]>([]);
  const [progress, setProgress] = useState<AnalysisProgress>({
    currentMove: 0,
    totalMoves: 0,
    status: 'idle',
  });

  const engineRef = useRef<StockfishModule | null>(null);
  const resolveRef = useRef<((value: EngineEvaluation[]) => void) | null>(null);
  const evaluationsRef = useRef<EngineEvaluation[]>([]);
  const topLinesRef = useRef<Map<number, EngineEvaluation>>(new Map());
  const currentMultiPvRef = useRef<number>(5);
  const requestModeRef = useRef<'primary' | 'toplines'>('primary');
  const stopRef = useRef(false);
  const readyWaitersRef = useRef<Array<() => void>>([]);
  const analysisQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestQuickReqSeqRef = useRef(0);

  const waitReady = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await new Promise<void>((resolve) => {
      readyWaitersRef.current.push(resolve);
      engine.uci('isready');
    });
  }, []);

  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = analysisQueueRef.current.then(fn, fn);
    analysisQueueRef.current = next.then(() => undefined, () => undefined);
    return next;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initEngine() {
      try {
        // Load Stockfish ES6 module via dynamic import at runtime
        const Stockfish = await loadStockfishModule();
        if (!Stockfish) {
          console.error('Failed to load Stockfish module');
          return;
        }

        // lila-stockfish-web: listen and onError are properties passed as options
        const engine = await Stockfish({
          locateFile: (file: string) => `/stockfish/${file}`,
          listen: (msg: string) => {
            if (msg === 'uciok') {
              engine.uci('isready');
            } else if (msg === 'readyok') {
              if (mounted) setIsReady(true);
              const waiter = readyWaitersRef.current.shift();
              if (waiter) waiter();
            } else if (msg.startsWith('info')) {
              const evaluation = parseInfoLine(msg);
              if (evaluation && evaluation.depth > 0) {
                // Track MultiPV lines for the current position
                const mpv = evaluation.multiPv;
                if (mpv && mpv >= 1) {
                  const prev = topLinesRef.current.get(mpv);
                  if (!prev || evaluation.depth >= prev.depth) {
                    topLinesRef.current.set(mpv, evaluation);
                    const sorted = Array.from(topLinesRef.current.entries())
                      .sort(([a], [b]) => a - b)
                      .map(([, v]) => v);
                    if (mounted) setTopLines(sorted);
                  }
                }

                // currentEval / analyzePosition 결과는 항상 "best line"로 고정 (multipv=1)
                if (!mpv || mpv === 1) {
                  if (requestModeRef.current === 'primary') {
                    if (mounted) setCurrentEval(evaluation);
                    evaluationsRef.current.push(evaluation);
                  }
                }
              }
            } else if (msg.startsWith('bestmove')) {
              if (resolveRef.current) {
                if (requestModeRef.current === 'toplines') {
                  const sorted = Array.from(topLinesRef.current.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([, v]) => v);
                  resolveRef.current(sorted);
                } else {
                  resolveRef.current(evaluationsRef.current);
                }
                resolveRef.current = null;
                evaluationsRef.current = [];
                topLinesRef.current = new Map();
              }
            }
          },
          onError: (msg: string) => {
            console.error('Stockfish error:', msg);
          },
        });

        if (!mounted) return;

        engineRef.current = engine;

        // Initialize UCI
        engine.uci('uci');
      } catch (error) {
        console.error('Failed to initialize Stockfish:', error);
      }
    }

    initEngine();

    return () => {
      mounted = false;
    };
  }, []);

  const analyzePosition = useCallback(
    (fen: string, depth: number = 20, multiPv: number = currentMultiPvRef.current): Promise<EngineEvaluation[]> => {
      const seq = ++latestQuickReqSeqRef.current;
      return enqueue(async () => {
        // Drop stale queued requests (only keep the latest quick-eval request)
        if (seq !== latestQuickReqSeqRef.current) return [];
        const engine = engineRef.current;
        if (!engine || !isReady) return [];

        // Ensure previous search is fully stopped before starting a new one.
        engine.uci('stop');
        await waitReady();

        // Drop again in case a newer request came in while waiting.
        if (seq !== latestQuickReqSeqRef.current) return [];

        return await new Promise<EngineEvaluation[]>((resolve) => {
        evaluationsRef.current = [];
        topLinesRef.current = new Map();
        setTopLines([]);
        resolveRef.current = resolve;

        requestModeRef.current = 'primary';
        const mpv = Math.max(1, Math.min(10, Math.floor(multiPv)));
        currentMultiPvRef.current = mpv;
          engine.uci('ucinewgame');
          engine.uci('setoption name UCI_AnalyseMode value true');
          engine.uci('setoption name Threads value 1');
          engine.uci('setoption name Hash value 128');
          engine.uci(`setoption name MultiPV value ${mpv}`);
          engine.uci(`position fen ${fen}`);
          engine.uci(`go depth ${depth}`);
        });
      });
    },
    [enqueue, isReady, waitReady]
  );

  const analyzeTopLines = useCallback(
    (fen: string, depth: number = 20, multiPv: number = 5): Promise<EngineEvaluation[]> => {
      const seq = ++latestQuickReqSeqRef.current;
      return enqueue(async () => {
        if (seq !== latestQuickReqSeqRef.current) return [];
        const engine = engineRef.current;
        if (!engine || !isReady) return [];

        engine.uci('stop');
        await waitReady();
        if (seq !== latestQuickReqSeqRef.current) return [];

        return await new Promise<EngineEvaluation[]>((resolve) => {
          engine.uci('stop');

        // For toplines requests, we only care about multipv lines; don't overwrite currentEval.
        evaluationsRef.current = [];
        topLinesRef.current = new Map();
        setTopLines([]);
        resolveRef.current = resolve;
        requestModeRef.current = 'toplines';

        const mpv = Math.max(2, Math.min(10, Math.floor(multiPv)));
        currentMultiPvRef.current = mpv;
          engine.uci('ucinewgame');
          engine.uci('setoption name UCI_AnalyseMode value true');
          engine.uci('setoption name Threads value 1');
          engine.uci('setoption name Hash value 128');
          engine.uci(`setoption name MultiPV value ${mpv}`);
          engine.uci(`position fen ${fen}`);
          engine.uci(`go depth ${depth}`);
        });
      });
    },
    [enqueue, isReady, waitReady]
  );

  const analyzeGame = useCallback(
    async (moves: ChessMove[], positions: string[], depth: number = 18): Promise<MoveAnalysis[]> => {
      if (!engineRef.current || !isReady || moves.length === 0) {
        return [];
      }

      setIsAnalyzing(true);
      stopRef.current = false;
      setProgress({ currentMove: 0, totalMoves: moves.length, status: 'analyzing' });

      const results: MoveAnalysis[] = [];

      // Lichess-style analysis: analyze each position once
      // Store all evaluations from WHITE's perspective for consistency.
      // Also store 2nd-best eval to approximate "only move / forced" situations.
      const positionEvals: Array<{
        cpWhite: number;
        mateWhite?: number;
        pv: string[];
        rawFen: string;
        cpWhite2?: number;
        mateWhite2?: number;
      }> = [];

      // Analyze all positions (including starting position)
      for (let i = 0; i <= moves.length; i++) {
        if (stopRef.current) {
          setProgress((prev) => ({ ...prev, status: 'idle' }));
          break;
        }

        setProgress({ currentMove: i, totalMoves: moves.length, status: 'analyzing' });

        const fen = positions[i];
        // For judgement we want at least 2 lines (MultiPV) to estimate "only move / forced" gaps.
        const lines = await analyzeTopLines(fen, depth, 3);

        if (lines.length === 0) {
          positionEvals.push({ cpWhite: 0, pv: [], rawFen: fen });
          continue;
        }

        const byMpv = [...lines].sort((a, b) => (a.multiPv ?? 99) - (b.multiPv ?? 99));
        const bestEval = byMpv[0];
        const secondEval = byMpv.length > 1 ? byMpv[1] : undefined;

        const best = toWhitePerspectiveScore(fen, bestEval);
        const second = secondEval ? toWhitePerspectiveScore(fen, secondEval) : undefined;

        positionEvals.push({
          cpWhite: best.cpWhite,
          mateWhite: best.mateWhite,
          pv: bestEval.pv,
          rawFen: fen,
          cpWhite2: second?.cpWhite,
          mateWhite2: second?.mateWhite,
        });
      }

      // Now calculate move quality by comparing consecutive positions
      for (let i = 0; i < moves.length; i++) {
        if (stopRef.current) break;

        const move = moves[i];
        const evalBefore = positionEvals[i];     // Position before move (from White's perspective)
        const evalAfter = positionEvals[i + 1];  // Position after move (from White's perspective)

        if (!evalBefore || !evalAfter) continue;

        // For eval loss calculation, convert to moving player's perspective
        const isWhiteMove = move.color === 'w';
        const playerEvalBefore = isWhiteMove ? evalBefore.cpWhite : -evalBefore.cpWhite;
        const playerEvalAfter = isWhiteMove ? evalAfter.cpWhite : -evalAfter.cpWhite;
        const playerSecondBestBefore = evalBefore.cpWhite2 !== undefined
          ? (isWhiteMove ? evalBefore.cpWhite2 : -evalBefore.cpWhite2)
          : undefined;

        // Eval loss: how much the position worsened from the player's perspective
        // A good move maintains or improves the eval, a bad move makes it worse
        const evalLoss = Math.max(0, playerEvalBefore - playerEvalAfter);
        const cpl = evalLoss;
        const winChanceBefore = getWinChance(playerEvalBefore);
        const winChanceAfter = getWinChance(playerEvalAfter);
        const swingCp = playerEvalAfter - playerEvalBefore;
        const swingWinChance = winChanceAfter - winChanceBefore;

        // Best move is the PV from the position before the move
        const bestMove = evalBefore.pv[0] || '';
        const secondBestMove = evalBefore.pv.length > 0 ? (evalBefore.pv[0] || '') : '';
        // 2nd-best PV is not stored directly; use the 2nd-best eval only (move can be inferred from byMpv earlier per position).

        // Check if played move matches engine's best move
        const playedMoveUCI = move.from + move.to + (move.flags.includes('p') ? 'q' : '');
        const isBestMove = bestMove === playedMoveUCI || bestMove.startsWith(move.from + move.to);

        // "Only move" heuristic: best vs 2nd-best gap is large (or mate vs non-mate).
        const onlyMoveGapCp = 180; // heuristic threshold
        const isOnlyMove =
          (evalBefore.mateWhite !== undefined && evalBefore.mateWhite > 0 && evalBefore.mateWhite2 === undefined) ||
          (playerSecondBestBefore !== undefined && (playerEvalBefore - playerSecondBestBefore) >= onlyMoveGapCp);

        // Sacrifice heuristic: player materially loses (after - before < 0) while still near best.
        const mbBefore = getMaterialBalancePawns(evalBefore.rawFen);
        const mbAfter = getMaterialBalancePawns(evalAfter.rawFen);
        const playerMatBefore = isWhiteMove ? mbBefore.white - mbBefore.black : mbBefore.black - mbBefore.white;
        const playerMatAfter = isWhiteMove ? mbAfter.white - mbAfter.black : mbAfter.black - mbAfter.white;
        const materialDelta = playerMatAfter - playerMatBefore;

        const { annotation, judgement, reason } = calculateAnnotation(
          playerEvalBefore,
          playerEvalAfter,
          playerEvalBefore, // bestMoveEval = evalBefore (assuming best play maintains eval)
          isWhiteMove,
          bestMove,
          {
            before: evalBefore.mateWhite !== undefined ? (isWhiteMove ? evalBefore.mateWhite : -evalBefore.mateWhite) : undefined,
            after: evalAfter.mateWhite !== undefined ? (isWhiteMove ? evalAfter.mateWhite : -evalAfter.mateWhite) : undefined,
          }
          ,
          {
            secondBestEvalBefore: playerSecondBestBefore,
            isBestMove,
            isOnlyMove,
            materialDelta,
          }
        );

        const review = classifyMove({
          evalBefore: playerEvalBefore,
          evalAfter: playerEvalAfter,
          bestMove,
          mateInfo: {
            before:
              evalBefore.mateWhite !== undefined ? (isWhiteMove ? evalBefore.mateWhite : -evalBefore.mateWhite) : undefined,
            after:
              evalAfter.mateWhite !== undefined ? (isWhiteMove ? evalAfter.mateWhite : -evalAfter.mateWhite) : undefined,
          },
          isBestMove,
          isOnlyMove,
          secondBestEvalBefore: playerSecondBestBefore,
          materialDelta,
        }); // keep calculateAnnotation for backwards compatibility fields

        // Key moment heuristic: big swing or a bad mistake.
        const isKeyMoment =
          Math.abs(swingWinChance) >= 10 ||
          cpl >= 250 ||
          judgement === 'blunder' ||
          judgement === 'miss' ||
          judgement === 'mistake';

        // More conservative annotation: only mark as best (!) if truly matches best and no eval loss
        // Chess.com style: most moves have no annotation
        let finalAnnotation = annotation;
        let finalReason = reason ? `${judgement.toUpperCase()}: ${reason}` : judgement.toUpperCase();

        if (isBestMove && evalLoss <= 0) {
          // Only mark as best if there's no loss at all
          finalAnnotation = null; // Don't show ! for normal best moves
          finalReason = judgement === 'best' ? 'BEST: Best move' : '';
        }

        results.push({
          moveNumber: Math.ceil((i + 1) / 2),
          color: move.color,
          san: move.san,
          fen: move.fen,
          evalBefore: playerEvalBefore,
          evalAfter: playerEvalAfter,        // Player's perspective (for accuracy)
          evalAfterWhite: evalAfter.cpWhite, // White's perspective (for graph)
          mateBeforeWhite: evalBefore.mateWhite,
          mateAfterWhite: evalAfter.mateWhite,
          judgement,
          bestMove,
          bestMoveEval: playerEvalBefore,
          evalLoss,
          annotation: finalAnnotation,
          annotationReason: finalReason,
          pv: evalBefore.pv,

          winChanceBefore: review.winChanceBefore,
          winChanceAfter: review.winChanceAfter,
          winChanceLoss: review.winChanceLoss,
          cpl: review.cpl,
          isKeyMoment,
          swingCp,
          swingWinChance,
          secondBestMove: secondBestMove || undefined,
          secondBestEval: playerSecondBestBefore,
          onlyMove: isOnlyMove,
          materialDelta,
        });
      }

      setIsAnalyzing(false);
      setProgress({ currentMove: moves.length, totalMoves: moves.length, status: 'complete' });

      return results;
    },
    [isReady, analyzePosition]
  );

  const stopAnalysis = useCallback(() => {
    stopRef.current = true;
    if (engineRef.current) {
      engineRef.current.uci('stop');
    }
    setIsAnalyzing(false);
    setProgress((prev) => ({ ...prev, status: 'idle' }));
  }, []);

  return {
    isReady,
    isAnalyzing,
    currentEval,
    topLines,
    progress,
    analyzePosition,
    analyzeTopLines,
    analyzeGame,
    stopAnalysis,
  };
}
