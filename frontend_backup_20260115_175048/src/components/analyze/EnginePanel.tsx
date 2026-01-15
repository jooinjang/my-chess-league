import { EngineEvaluation, AnalysisProgress } from '../../types/analysis';
import { formatEvaluation } from '../../utils/analysisUtils';
import './EnginePanel.css';

interface EnginePanelProps {
  isReady: boolean;
  isAnalyzing: boolean;
  currentEval: EngineEvaluation | null;
  fen?: string;
  progress: AnalysisProgress;
  depth: number;
  onDepthChange: (depth: number) => void;
  onAnalyze: () => void;
  onStop: () => void;
}

const DEPTH_OPTIONS = [10, 12, 14, 16, 18, 20, 22, 24];

export function EnginePanel({
  isReady,
  isAnalyzing,
  currentEval,
  fen,
  progress,
  depth,
  onDepthChange,
  onAnalyze,
  onStop,
}: EnginePanelProps) {
  const displayEval = (() => {
    if (!currentEval) return null;
    if (!fen) return currentEval;
    const isWhiteToMove = (fen.split(' ')[1] || 'w') === 'w';
    return {
      ...currentEval,
      score: isWhiteToMove ? currentEval.score : -currentEval.score,
      mate:
        currentEval.mate !== undefined ? (isWhiteToMove ? currentEval.mate : -currentEval.mate) : undefined,
    };
  })();

  return (
    <div className="engine-panel">
      <div className="engine-header">
        <span className="engine-name">
          Stockfish
          <span className={`status-dot ${isReady ? 'ready' : 'loading'}`} />
        </span>
        <div className="engine-controls">
          <div className="depth-selector">
            <label htmlFor="depth-select">Depth</label>
            <select
              id="depth-select"
              value={depth}
              onChange={(e) => onDepthChange(Number(e.target.value))}
              disabled={isAnalyzing}
            >
              {DEPTH_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          {isAnalyzing ? (
            <button className="btn-stop" onClick={onStop}>
              Stop
            </button>
          ) : (
            <button className="btn-analyze" onClick={onAnalyze} disabled={!isReady}>
              Analyze All
            </button>
          )}
        </div>
      </div>

      {progress.status === 'analyzing' && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(progress.currentMove / progress.totalMoves) * 100}%` }}
          />
          <span className="progress-text">
            Analyzing move {progress.currentMove} / {progress.totalMoves}
          </span>
        </div>
      )}

      {displayEval && (
        <div className="engine-output">
          <div className="eval-main">
            <span className="eval-score">{formatEvaluation(displayEval.score, displayEval.mate)}</span>
            <span className="eval-depth">depth {displayEval.depth}</span>
          </div>
          {displayEval.pv.length > 0 && (
            <div className="pv-line">{displayEval.pv.slice(0, 8).join(' ')}</div>
          )}
        </div>
      )}

      {!isReady && (
        <div className="engine-loading">
          Loading engine...
        </div>
      )}
    </div>
  );
}
