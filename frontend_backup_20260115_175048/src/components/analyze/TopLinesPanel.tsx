import { useMemo } from 'react';
import type { EngineEvaluation } from '../../types/analysis';
import { formatEvaluation } from '../../utils/analysisUtils';
import { pvUciToSanLine } from '../../utils/pvSan';
import './TopLinesPanel.css';

interface TopLinesPanelProps {
  fen: string;
  lines: EngineEvaluation[];
  engineName?: string;
  depth?: number;
  selectedMultiPv?: number | null;
  onSelectLine?: (line: EngineEvaluation | null) => void;
}

function toWhitePerspective(fen: string, line: EngineEvaluation): EngineEvaluation {
  const turn = (fen.split(' ')[1] || 'w') as 'w' | 'b';
  if (turn === 'w') return line;
  return {
    ...line,
    score: -line.score,
    mate: line.mate !== undefined ? -line.mate : undefined,
  };
}

export function TopLinesPanel({
  fen,
  lines,
  engineName = 'Stockfish 17.1',
  depth,
  selectedMultiPv,
  onSelectLine,
}: TopLinesPanelProps) {
  const displayLines = useMemo(() => {
    const normalized = lines
      .filter((l) => l.pv && l.pv.length > 0)
      .map((l) => toWhitePerspective(fen, l));
    return normalized.slice(0, 5);
  }, [fen, lines]);

  const computedDepth = useMemo(() => {
    if (depth) return depth;
    const d = displayLines.reduce((max, l) => Math.max(max, l.depth), 0);
    return d || undefined;
  }, [depth, displayLines]);

  if (displayLines.length === 0) return null;

  return (
    <div className="top-lines-panel" aria-label="Engine top lines">
      <div className="top-lines-header">
        <div className="top-lines-title">Analysis</div>
        <div className="top-lines-meta">
          {computedDepth !== undefined && <span className="top-lines-depth">depth-{computedDepth}</span>}
          <span className="top-lines-engine">{engineName}</span>
        </div>
      </div>

      <div className="top-lines-list">
        {displayLines.map((line, idx) => {
          const scoreText = formatEvaluation(line.score, line.mate);
          const sanLine = pvUciToSanLine(fen, line.pv, 14);
          const tokens = sanLine.split(' ').filter(Boolean);
          const firstMove = tokens[0] || '';
          const restMoves = tokens.length > 1 ? tokens.slice(1).join(' ') : '';
          const isSelected =
            selectedMultiPv !== undefined &&
            selectedMultiPv !== null &&
            (line.multiPv ?? idx + 1) === selectedMultiPv;
          return (
            <button
              key={line.multiPv ?? idx}
              type="button"
              className={`top-line-row ${idx === 0 ? 'best' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                if (!onSelectLine) return;
                const mpv = line.multiPv ?? idx + 1;
                if (selectedMultiPv === mpv) {
                  onSelectLine(null);
                } else {
                  onSelectLine(line);
                }
              }}
              title="클릭하면 보드에 라인 프리뷰를 표시합니다"
            >
              <div className="top-line-score">{scoreText}</div>
              <div className="top-line-pv" title={sanLine}>
                {firstMove ? <span className="top-line-first-move">{firstMove}</span> : null}
                {restMoves ? <span className="top-line-rest-moves"> {restMoves}</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


