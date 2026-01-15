import { useState, useEffect, useMemo, useCallback } from 'react';
import { Match } from '../types';
import type { MoveAnalysis, GameAnalysis } from '../types/analysis';
import { matchApi } from '../api';
import { useChessGame } from '../hooks/useChessGame';
import { parsePgnTimeData, PgnTimeData } from '../utils/pgnTime';
import { Chess } from 'chess.js';
import {
  GameSelector,
  ChessBoardPanel,
  MoveList,
  TopLinesPanel,
  EvaluationBar,
  EvaluationGraph,
  EnginePanel,
  GameReviewPanel,
} from '../components/analyze';
import './AnalyzePage.css';

interface MoveFeedback {
  san: string;
  annotation: string | null;
  reason: string;
  evalBefore: number;
  evalAfter: number;
  bestMove: string;
  bestMoveEval: number;
  evalAfterWhite?: number;
  mateAfterWhite?: number;
}

const BOARD_SIZE = 480;

export function AnalyzePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<MoveAnalysis[]>([]);
  const [analysisSummary, setAnalysisSummary] = useState<Pick<GameAnalysis, 'whiteAccuracy' | 'blackAccuracy'> | null>(null);
  const [pgnTime, setPgnTime] = useState<PgnTimeData | null>(null);
  const [depth, setDepth] = useState(18);
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null);
  const [isAnalyzingMove, setIsAnalyzingMove] = useState(false);
  const [analyzedPositions, setAnalyzedPositions] = useState<string[] | null>(null);
  const [openingPreviewMove, setOpeningPreviewMove] = useState<string | null>(null);
  const [openingPreviewArrows, setOpeningPreviewArrows] = useState<Array<[string, string]>>([]);
  const [openingPreviewSanLine, setOpeningPreviewSanLine] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgressPct, setAnalysisProgressPct] = useState<number | null>(null);
  const [analysisProgressEtaMs, setAnalysisProgressEtaMs] = useState<number | null>(null);

  const {
    fen,
    moves,
    currentMoveIndex,
    loadPgn,
    goToMove,
    goToStart,
    goToEnd,
    goForward,
    goBack,
    makeMove,
    getPositions,
    commentsByPly,
    moveTree,
    currentNode,
    goToNode,
    goToMainLine,
    isInVariation,
  } = useChessGame();

  const progress = useMemo(() => {
    const pct = analysisProgressPct ?? null;
    const etaMs = analysisProgressEtaMs ?? null;
    const currentMoveFromPct =
      pct === null || moves.length === 0 ? 0 : Math.round((pct / 100) * moves.length);
    return {
      // EnginePanel expects "currentMove / totalMoves" to draw progress bar.
      // We approximate currentMove from percent while running.
      currentMove: isAnalyzing ? currentMoveFromPct : (analysis.length || 0),
      totalMoves: moves.length,
      status: isAnalyzing ? 'analyzing' : analysis.length > 0 ? 'complete' : 'idle',
      percent: pct,
      etaMs,
    } as const;
  }, [isAnalyzing, analysis.length, moves.length, analysisProgressPct, analysisProgressEtaMs]);

  useEffect(() => {
    loadMatches();
  }, []);

  // Clear move feedback when navigating to different positions
  useEffect(() => {
    setMoveFeedback(null);
  }, [currentMoveIndex, currentNode]);

  const loadMatches = async () => {
    try {
      const data = await matchApi.getAll();
      setMatches(data);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMatch = (matchId: number) => {
    const match = matches.find((m) => m.id === matchId);
    if (match && match.pgn) {
      setSelectedMatch(match);
      setAnalysis([]);
      setAnalysisSummary(null);
      setMoveFeedback(null);
      setPgnTime(parsePgnTimeData(match.pgn));
      setAnalyzedPositions(null);
      setOpeningPreviewMove(null);
      setOpeningPreviewArrows([]);
      setOpeningPreviewSanLine(null);
      const success = loadPgn(match.pgn);
      if (!success) {
        console.error('Failed to load PGN');
      }
    }
  };

  const handleAnalyze = async () => {
    const matchId = selectedMatch?.id ?? null;
    const willReturn =
      moves.length === 0 ? 'no_moves' : !matchId ? 'no_selected_match' : null;
    if (willReturn) return;
    // From here on, matchId is guaranteed to be a number.
    const mid = matchId as number;
    setIsAnalyzing(true);
    setAnalysisProgressPct(0);
    setAnalysisProgressEtaMs(null);
    try {
      // Start server-side analysis (async). This should return quickly (202).
      await matchApi.analyze(mid, { depth });

      // Subscribe to backend progress stream (SSE) and load analysis when complete.
      const streamUrl = `/api/v1/matches/${mid}/analysis/stream`;
      const es = new EventSource(streamUrl);
      const done = await new Promise<'complete' | 'error'>((resolve) => {
        es.onmessage = async (evt) => {
          try {
            const data = JSON.parse(evt.data || '{}');
            if (typeof data.percent === 'number') setAnalysisProgressPct(data.percent);
            if (typeof data.etaMs === 'number') setAnalysisProgressEtaMs(data.etaMs);
            if (data.status === 'complete') {
              resolve('complete');
            }
            if (data.status === 'error') {
              resolve('error');
            }
          } catch {
            // ignore
          }
        };
        es.onerror = () => {
          // If SSE fails, fall back to marking error; user can retry.
          resolve('error');
        };
      });
      es.close();

      if (done === 'complete') {
        const gameAnalysis = await matchApi.getAnalysis(mid);
        setAnalysis(gameAnalysis.moves || []);
        setAnalysisSummary({ whiteAccuracy: gameAnalysis.whiteAccuracy, blackAccuracy: gameAnalysis.blackAccuracy });
        setAnalyzedPositions(getPositions());
        setAnalysisProgressPct(100);
        setAnalysisProgressEtaMs(0);
      } else {
        throw new Error('analysis_error');
      }
    } catch (e) {
      console.error('Failed to analyze match:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePreviewOpeningLine = useCallback((firstMoveToken: string | null) => {
    setOpeningPreviewMove(firstMoveToken);
    if (!firstMoveToken) {
      setOpeningPreviewArrows([]);
      setOpeningPreviewSanLine(null);
      return;
    }
    const positions = analyzedPositions ?? getPositions();
    const baseFen = positions[0];
    if (!baseFen) {
      setOpeningPreviewArrows([]);
      setOpeningPreviewSanLine(null);
      return;
    }

    try {
      const game = new Chess(baseFen);
      const arrows: Array<[string, string]> = [];
      const sans: string[] = [];

      // Build a short virtual line: clicked UCI PV first move + follow PV if available (best-effort).
      let token: string | undefined = firstMoveToken;
      const maxPlies = 8;
      for (let i = 0; i < maxPlies && token; i++) {
        // chess.js supports sloppy parsing as option; keep compatibility via any.
        const mv = (game as any).move(token, { sloppy: true }) as any;
        if (!mv) break;
        const from = String(mv.from);
        const to = String(mv.to);
        arrows.push([from, to]);
        sans.push(String(mv.san));
        // Try to follow analysis PV if we have it; otherwise stop.
        const idxInAnalysis = 0;
        const pv = analysis[idxInAnalysis]?.pv ?? [];
        token = pv.length > i+1 ? pv[i+1] : undefined;
      }

      setOpeningPreviewArrows(arrows);
      setOpeningPreviewSanLine(sans.join(' '));
    } catch {
      setOpeningPreviewArrows([]);
      setOpeningPreviewSanLine(null);
    }
  }, [analysis, analyzedPositions, getPositions]);

  const handleMove = useCallback(async (from: string, to: string, promotion?: string): Promise<boolean> => {
    // Get FEN before the move for comparison
    const fenBefore = fen;
    const isWhiteToMove = fenBefore.includes(' w ');

    // Make the move on the board
    const played = makeMove(from, to, promotion);
    if (!played) return false;

    // Get the UCI notation of the played move
    const playedMoveUci = `${from}${to}${promotion || ''}`;

    // Start analyzing
    setIsAnalyzingMove(true);
    setMoveFeedback(null);

    try {
      // Get the FEN after the move by making the move on a temporary chess instance
      const tempGame = new Chess(fenBefore);
      const moveResult = tempGame.move({ from, to, promotion });
      if (!moveResult) {
        setIsAnalyzingMove(false);
        return true;
      }
      const fenAfter = tempGame.fen();
      const sanPlayed = moveResult.san;

      // Analyze both positions in parallel
      const [evalBeforeResult, evalAfterResult] = await Promise.all([
        matchApi.analyzePosition(fenBefore, depth),
        matchApi.analyzePosition(fenAfter, depth),
      ]);

      const bestMoveFromBefore = evalBeforeResult.bestMove;
      const bestLineBefore = evalBeforeResult.lines[0];
      const bestLineAfter = evalAfterResult.lines[0];

      // Get evaluation from White's perspective
      const evalCpBefore = bestLineBefore?.cp ?? 0;
      const mateBefore = bestLineBefore?.mate;
      const evalCpAfter = bestLineAfter?.cp ?? 0;
      const mateAfter = bestLineAfter?.mate;

      // Convert mate to centipawn equivalent for comparison
      const mateToCP = (mate: number | undefined): number => {
        if (mate === undefined) return 0;
        // Positive mate = White wins, Negative mate = Black wins
        const sign = mate > 0 ? 1 : -1;
        const cpValue = 10000 - Math.abs(mate) * 10; // closer mate = higher value
        return sign * cpValue;
      };

      // Calculate evaluation from the MOVING PLAYER's perspective
      // Before: from the player about to move's perspective
      let evalBeforePlayer: number;
      if (mateBefore !== undefined) {
        const mateCP = mateToCP(mateBefore);
        evalBeforePlayer = isWhiteToMove ? mateCP : -mateCP;
      } else {
        evalBeforePlayer = isWhiteToMove ? evalCpBefore : -evalCpBefore;
      }

      // After: now it's the opponent's turn, so negate again
      // The evalAfter is from the opponent's best response perspective
      // A good move for us = bad position for opponent = negative eval for opponent
      let evalAfterPlayer: number;
      if (mateAfter !== undefined) {
        const mateCP = mateToCP(mateAfter);
        // After move, it's opponent's turn. If eval is good for white and we're white, that's good.
        evalAfterPlayer = isWhiteToMove ? mateCP : -mateCP;
      } else {
        evalAfterPlayer = isWhiteToMove ? evalCpAfter : -evalCpAfter;
      }

      // Determine if the played move matches the best move
      const isCorrect = bestMoveFromBefore === playedMoveUci;

      // Calculate evaluation loss (from the player's perspective)
      // Loss = eval before (best) - eval after (actual result)
      const evalLoss = evalBeforePlayer - evalAfterPlayer;

      let annotation: string | null = null;
      let reason = '';

      // Check for mate blunders
      if (mateBefore !== undefined && mateAfter === undefined) {
        // Had a winning mate, now it's gone
        const wasWinningMate = (isWhiteToMove && mateBefore > 0) || (!isWhiteToMove && mateBefore < 0);
        if (wasWinningMate) {
          annotation = '??';
          reason = 'Missed forced mate';
        }
      } else if (mateAfter !== undefined && mateBefore === undefined) {
        // Allowed opponent to have mate
        const opponentHasMate = (isWhiteToMove && mateAfter < 0) || (!isWhiteToMove && mateAfter > 0);
        if (opponentHasMate) {
          annotation = '??';
          reason = 'Allowed mate';
        }
      }

      // If no mate-related annotation, use eval loss
      if (!annotation) {
        if (isCorrect) {
          annotation = '!';
          reason = 'Best move';
        } else if (evalLoss > 300) {
          annotation = '??';
          reason = 'Blunder';
        } else if (evalLoss > 100) {
          annotation = '?';
          reason = 'Mistake';
        } else if (evalLoss > 50) {
          annotation = '?!';
          reason = 'Inaccuracy';
        } else if (evalLoss < -100) {
          // Player improved the position significantly (opponent blundered before?)
          annotation = '!';
          reason = 'Great move';
        } else {
          reason = 'Good alternative';
        }
      }

      // Store eval from White's perspective for the evaluation bar
      const evalAfterWhite = mateAfter !== undefined ? mateToCP(mateAfter) : evalCpAfter;

      setMoveFeedback({
        san: sanPlayed,
        annotation,
        reason,
        evalBefore: evalBeforePlayer,
        evalAfter: evalAfterPlayer,
        bestMove: bestMoveFromBefore,
        bestMoveEval: evalBeforePlayer,
        evalAfterWhite,
        mateAfterWhite: mateAfter,
      });
    } catch (e) {
      console.error('Failed to analyze move:', e);
      setMoveFeedback(null);
    } finally {
      setIsAnalyzingMove(false);
    }

    return true;
  }, [makeMove, fen, depth]);

  const currentAnalysis = useMemo(() => {
    if (currentMoveIndex < 0 || analysis.length === 0) return null;
    return analysis[currentMoveIndex] || null;
  }, [currentMoveIndex, analysis]);

  const currentEvalForDisplay = useMemo(() => {
    // If we have move feedback from user's move, use that for the eval bar
    if (moveFeedback && moveFeedback.evalAfterWhite !== undefined) {
      return { score: moveFeedback.evalAfterWhite, mate: moveFeedback.mateAfterWhite };
    }
    if (currentAnalysis) {
      // Always use White's perspective for UI elements (bar/graph/top-lines)
      return { score: currentAnalysis.evalAfterWhite, mate: currentAnalysis.mateAfterWhite };
    }
    return { score: 0, mate: undefined as number | undefined };
  }, [currentAnalysis, moveFeedback]);

  const bestMoveArrow = useMemo((): Array<[string, string]> => {
    if (currentAnalysis && currentAnalysis.pv.length > 0) {
      const bestMove = currentAnalysis.pv[0];
      if (bestMove.length >= 4) {
        const from = bestMove.slice(0, 2);
        const to = bestMove.slice(2, 4);
        return [[from, to]];
      }
    }
    return [];
  }, [currentAnalysis]);

  const previewArrows = useMemo((): Array<[string, string]> => {
    return [];
  }, []);

  const boardArrows = useMemo((): Array<[string, string]> => {
    if (openingPreviewArrows.length > 0) return openingPreviewArrows;
    return previewArrows.length > 0 ? previewArrows : bestMoveArrow;
  }, [openingPreviewArrows, previewArrows, bestMoveArrow]);

  // Calculate player stats
  const playerStats = useMemo(() => {
    if (!analysisSummary) return null;
    return {
      white: {
        name: selectedMatch?.white_player?.name || 'White',
        accuracy: analysisSummary.whiteAccuracy,
      },
      black: {
        name: selectedMatch?.black_player?.name || 'Black',
        accuracy: analysisSummary.blackAccuracy,
      },
    };
  }, [analysisSummary, selectedMatch]);

  if (loading) {
    return (
      <div className="analyze-page">
        <h1>Analyze</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="analyze-page">
      <h1>Analyze</h1>

      <GameSelector
        matches={matches}
        selectedMatchId={selectedMatch?.id || null}
        onSelect={handleSelectMatch}
        loading={loading}
      />

      {selectedMatch && (
        <div className="analyze-content">
          {/* Left: Board with eval bar */}
          <div className="board-section">
            <EvaluationBar score={currentEvalForDisplay.score} mate={currentEvalForDisplay.mate} height={BOARD_SIZE} />
            <ChessBoardPanel
              fen={fen}
              boardWidth={BOARD_SIZE}
              arrows={boardArrows}
              allowMoves={true}
              onMove={handleMove}
            />
          </div>

          {/* Right: Player stats + PGN + Engine */}
          <div className="side-panel">
            {/* Player Stats - Top */}
            <div className="player-stats">
              <div className="player-stat white">
                <div className="player-name">
                  <span className="color-indicator white"></span>
                  {selectedMatch.white_player?.name || 'White'}
                </div>
                {playerStats ? (
                  <>
                    <div className="player-accuracy white">{playerStats.white.accuracy.toFixed(1)}</div>
                    <div className="player-accuracy-label">Accuracy</div>
                  </>
                ) : (
                  <div className="player-accuracy-label">-</div>
                )}
              </div>
              <div className="player-stat black">
                <div className="player-name">
                  {selectedMatch.black_player?.name || 'Black'}
                  <span className="color-indicator black"></span>
                </div>
                {playerStats ? (
                  <>
                    <div className="player-accuracy black">{playerStats.black.accuracy.toFixed(1)}</div>
                    <div className="player-accuracy-label">Accuracy</div>
                  </>
                ) : (
                  <div className="player-accuracy-label">-</div>
                )}
              </div>
            </div>

            {/* PGN Table - Middle */}
            <div className="move-list-wrapper">
              <div className="top-lines-wrapper">
                <GameReviewPanel
                  analysis={analysis}
                  currentMoveIndex={currentMoveIndex}
                  onJumpToMove={goToMove}
                  onPreviewOpeningLine={handlePreviewOpeningLine}
                  selectedOpeningLine={openingPreviewMove}
                  previewSanLine={openingPreviewSanLine}
                  userMoveFeedback={moveFeedback}
                  isAnalyzingUserMove={isAnalyzingMove}
                />
              <TopLinesPanel fen={fen} lines={[]} depth={depth} />
              </div>
              <div className="moves-wrapper">
              <MoveList
                moves={moves}
                analysis={analysis}
                pgnTime={pgnTime || undefined}
                commentsByPly={commentsByPly}
                currentMoveIndex={currentMoveIndex}
                onMoveClick={goToMove}
                onGoToStart={goToStart}
                onGoBack={goBack}
                onGoForward={goForward}
                onGoToEnd={goToEnd}
                moveTree={moveTree}
                currentNode={currentNode}
                onNodeClick={goToNode}
                onGoToMainLine={goToMainLine}
                isInVariation={isInVariation}
              />
              </div>
            </div>

            {/* Engine Panel - Bottom */}
            <div className="engine-panel-wrapper">
              <EnginePanel
                isReady={true}
                isAnalyzing={isAnalyzing}
                currentEval={null}
                fen={fen}
                progress={progress}
                depth={depth}
                onDepthChange={setDepth}
                onAnalyze={handleAnalyze}
                onStop={() => setIsAnalyzing(false)}
              />
            </div>

          </div>
        </div>
      )}

      {/* Evaluation Graph - Below */}
      {selectedMatch && (
        <div className="graph-section">
          <EvaluationGraph
            analysis={analysis}
            currentMoveIndex={currentMoveIndex}
            onMoveClick={goToMove}
          />
        </div>
      )}

      {!selectedMatch && (
        <div className="no-game-selected">
          <p>Select a game from the dropdown above to start analyzing.</p>
        </div>
      )}
    </div>
  );
}
