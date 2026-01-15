import { MoveAnalysis } from '../../types/analysis';
import { calculateMoveAccuracy } from '../../utils/analysisUtils';
import './GameReport.css';

interface GameReportProps {
  analysis: MoveAnalysis[];
  whitePlayer: string;
  blackPlayer: string;
}

export function GameReport({ analysis, whitePlayer, blackPlayer }: GameReportProps) {
  if (analysis.length === 0) {
    return (
      <div className="game-report empty">
        <p>Run analysis to see the game report</p>
      </div>
    );
  }

  const whiteMoves = analysis.filter((m) => m.color === 'w');
  const blackMoves = analysis.filter((m) => m.color === 'b');

  const countAnnotations = (moves: MoveAnalysis[], annotation: string) =>
    moves.filter((m) => m.annotation === annotation).length;

  const calculateAccuracy = (moves: MoveAnalysis[]) => {
    if (moves.length === 0) return 0;
    const accuracies = moves.map((m) =>
      calculateMoveAccuracy(m.evalBefore, m.evalAfter, m.bestMoveEval)
    );
    return accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
  };

  const whiteStats = {
    accuracy: calculateAccuracy(whiteMoves),
    brilliant: countAnnotations(whiteMoves, '!!'),
    good: countAnnotations(whiteMoves, '!'),
    inaccuracy: countAnnotations(whiteMoves, '?!'),
    mistake: countAnnotations(whiteMoves, '?'),
    blunder: countAnnotations(whiteMoves, '??'),
  };

  const blackStats = {
    accuracy: calculateAccuracy(blackMoves),
    brilliant: countAnnotations(blackMoves, '!!'),
    good: countAnnotations(blackMoves, '!'),
    inaccuracy: countAnnotations(blackMoves, '?!'),
    mistake: countAnnotations(blackMoves, '?'),
    blunder: countAnnotations(blackMoves, '??'),
  };

  return (
    <div className="game-report">
      <h4>Game Report</h4>

      <div className="report-grid">
        <div className="player-column white">
          <div className="player-name">{whitePlayer}</div>
          <div className="accuracy">
            <span className="label">Accuracy</span>
            <span className="value">{whiteStats.accuracy.toFixed(1)}%</span>
          </div>
          <div className="stats">
            {whiteStats.brilliant > 0 && (
              <div className="stat brilliant">
                <span className="badge">!!</span>
                <span>{whiteStats.brilliant}</span>
              </div>
            )}
            {whiteStats.good > 0 && (
              <div className="stat good">
                <span className="badge">!</span>
                <span>{whiteStats.good}</span>
              </div>
            )}
            {whiteStats.inaccuracy > 0 && (
              <div className="stat inaccuracy">
                <span className="badge">?!</span>
                <span>{whiteStats.inaccuracy}</span>
              </div>
            )}
            {whiteStats.mistake > 0 && (
              <div className="stat mistake">
                <span className="badge">?</span>
                <span>{whiteStats.mistake}</span>
              </div>
            )}
            {whiteStats.blunder > 0 && (
              <div className="stat blunder">
                <span className="badge">??</span>
                <span>{whiteStats.blunder}</span>
              </div>
            )}
          </div>
        </div>

        <div className="player-column black">
          <div className="player-name">{blackPlayer}</div>
          <div className="accuracy">
            <span className="label">Accuracy</span>
            <span className="value">{blackStats.accuracy.toFixed(1)}%</span>
          </div>
          <div className="stats">
            {blackStats.brilliant > 0 && (
              <div className="stat brilliant">
                <span className="badge">!!</span>
                <span>{blackStats.brilliant}</span>
              </div>
            )}
            {blackStats.good > 0 && (
              <div className="stat good">
                <span className="badge">!</span>
                <span>{blackStats.good}</span>
              </div>
            )}
            {blackStats.inaccuracy > 0 && (
              <div className="stat inaccuracy">
                <span className="badge">?!</span>
                <span>{blackStats.inaccuracy}</span>
              </div>
            )}
            {blackStats.mistake > 0 && (
              <div className="stat mistake">
                <span className="badge">?</span>
                <span>{blackStats.mistake}</span>
              </div>
            )}
            {blackStats.blunder > 0 && (
              <div className="stat blunder">
                <span className="badge">??</span>
                <span>{blackStats.blunder}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
