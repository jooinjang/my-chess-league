import { useMemo } from 'react';
import type { MoveAnalysis } from '../../types/analysis';
import './GameReviewPanel.css';

export interface UserMoveFeedback {
  san: string;
  annotation: string | null;
  reason: string;
  evalBefore: number;
  evalAfter: number;
  bestMove: string;
  bestMoveEval: number;
}

interface GameReviewPanelProps {
  analysis: MoveAnalysis[];
  currentMoveIndex: number;
  onJumpToMove: (index: number) => void;
  onPreviewOpeningLine?: (firstMoveToken: string | null) => void;
  selectedOpeningLine?: string | null;
  previewSanLine?: string | null;
  userMoveFeedback?: UserMoveFeedback | null;
  isAnalyzingUserMove?: boolean;
}

function pct(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '-';
  return `${n.toFixed(1)}%`;
}

function formatOpening(a: MoveAnalysis | undefined): { title: string; subtitle?: string; book?: string } | null {
  if (!a?.variationName && !a?.openingNameRoot) return null;
  const root = a.openingNameRoot && a.ecoRoot ? `${a.ecoRoot} ${a.openingNameRoot}` : a.openingNameRoot;
  const variation = a.variationName && a.variationEco ? `${a.variationEco} ${a.variationName}` : a.variationName;
  const title = variation || root || '';
  const subtitle = variation && root && variation !== root ? root : undefined;
  const book = a.bookPlies !== undefined && a.bookPlies > 0 ? `Book: ${a.bookPlies} ply` : undefined;
  return { title, subtitle, book };
}

function formatEval(cp: number): string {
  if (cp >= 10000) return `+M${Math.ceil((10000 - cp) / 10)}`;
  if (cp <= -10000) return `-M${Math.ceil((-10000 - cp) / -10)}`;
  const sign = cp >= 0 ? '+' : '';
  return `${sign}${(cp / 100).toFixed(2)}`;
}

function getJudgementClass(annotation: string | null): string {
  if (!annotation) return 'normal';
  if (annotation === '!!' || annotation === '!') return 'best';
  if (annotation === '?!') return 'inaccuracy';
  if (annotation === '?') return 'mistake';
  if (annotation === '??') return 'blunder';
  return 'normal';
}

export function GameReviewPanel({
  analysis,
  currentMoveIndex,
  onJumpToMove,
  onPreviewOpeningLine,
  selectedOpeningLine,
  previewSanLine,
  userMoveFeedback,
  isAnalyzingUserMove,
}: GameReviewPanelProps) {
  const openingInfo = useMemo(() => formatOpening(analysis[0]), [analysis]);
  const openingMore = useMemo(() => {
    const a = analysis[0];
    if (!a?.bookPlies || a.bookPlies <= 0) return null;
    const next = analysis[a.bookPlies]?.san;
    const cont = (a.openingContinuations || []).slice(0, 6);
    return { next, cont };
  }, [analysis]);

  const keyMoments = useMemo(() => {
    return analysis
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => m.isKeyMoment)
      .slice(0, 12);
  }, [analysis]);

  const current = currentMoveIndex >= 0 ? analysis[currentMoveIndex] : null;

  const currentSummary = useMemo(() => {
    if (!current) return null;
    const wcLoss = current.winChanceLoss;
    const cpl = current.cpl;
    const swing = current.swingWinChance;
    const parts: string[] = [];
    if (wcLoss !== undefined) parts.push(`ΔWin% ${wcLoss >= 0 ? '-' : '+'}${Math.abs(wcLoss).toFixed(1)}`);
    if (cpl !== undefined) parts.push(`CPL ${Math.round(cpl)}`);
    if (swing !== undefined) parts.push(`Swing ${swing >= 0 ? '+' : ''}${swing.toFixed(1)}%`);
    return parts.join(' · ');
  }, [current]);

  return (
    <div className="game-review-panel" aria-label="Game review panel">
      <div className="review-header">
        <div className="review-title">Review</div>
        {openingInfo && (
          <div className="opening-chip" title={openingInfo.subtitle ? `${openingInfo.subtitle}` : openingInfo.title}>
            <div className="opening-title">{openingInfo.title}</div>
            {openingInfo.subtitle && <div className="opening-subtitle">{openingInfo.subtitle}</div>}
            {openingInfo.book && <div className="opening-book">{openingInfo.book}</div>}
            {openingMore?.next && <div className="opening-book">After book: {openingMore.next}</div>}
            {openingMore?.cont && openingMore.cont.length > 0 && (
              <div className="opening-lines">
                <div className="opening-lines-title">Lines</div>
                <div className="opening-lines-list">
                  {openingMore.cont.map((c) => {
                    const isSel = selectedOpeningLine === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`opening-line-btn ${isSel ? 'selected' : ''}`}
                        onClick={() => {
                          if (!onPreviewOpeningLine) return;
                          onPreviewOpeningLine(isSel ? null : c);
                        }}
                        title="클릭하면 보드에 라인 프리뷰를 표시합니다"
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                {previewSanLine && <div className="opening-preview-line">Preview: {previewSanLine}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User's custom move feedback - shown when user plays a move */}
      {(userMoveFeedback || isAnalyzingUserMove) && (
        <div className="review-current user-move">
          <div className="review-current-top">
            <div className="current-move">
              Your move: {isAnalyzingUserMove ? (
                <span className="analyzing-indicator">Analyzing...</span>
              ) : (
                <span className="current-san">{userMoveFeedback?.san}</span>
              )}
            </div>
            {userMoveFeedback && (
              <div className={`current-judgement ${getJudgementClass(userMoveFeedback.annotation)}`}>
                {userMoveFeedback.annotation || 'OK'}
              </div>
            )}
          </div>
          {userMoveFeedback && (
            <div className="review-current-meta">
              <div className="meta-row">
                <span className="meta-label">Evaluation</span>
                <span className={`meta-value ${userMoveFeedback.evalAfter >= 0 ? 'positive' : 'negative'}`}>
                  {formatEval(userMoveFeedback.evalAfter)}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Eval change</span>
                <span className={`meta-value ${userMoveFeedback.evalAfter - userMoveFeedback.evalBefore >= 0 ? 'positive' : 'negative'}`}>
                  {userMoveFeedback.evalAfter - userMoveFeedback.evalBefore >= 0 ? '+' : ''}
                  {((userMoveFeedback.evalAfter - userMoveFeedback.evalBefore) / 100).toFixed(2)}
                </span>
              </div>
              {userMoveFeedback.reason && <div className="meta-reason">{userMoveFeedback.reason}</div>}
              {userMoveFeedback.bestMove && (
                <div className="meta-best">
                  Best: <span className="mono">{userMoveFeedback.bestMove}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current analyzed move details */}
      {current && !userMoveFeedback && !isAnalyzingUserMove && (
        <div className="review-current">
          <div className="review-current-top">
            <div className="current-move">
              Move {currentMoveIndex + 1}: <span className="current-san">{current.san}</span>
            </div>
            <div className={`current-judgement ${current.judgement}`}>{current.judgement.toUpperCase()}</div>
          </div>
          <div className="review-current-meta">
            <div className="meta-row">
              <span className="meta-label">Accuracy</span>
              <span className="meta-value">{pct(current.winChanceAfter)}</span>
            </div>
            {currentSummary && <div className="meta-summary">{currentSummary}</div>}
            {current.annotationReason && <div className="meta-reason">{current.annotationReason}</div>}
            {current.bestMove && (
              <div className="meta-best">
                Best: <span className="mono">{current.bestMove}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="review-section">
        <div className="section-title">Key moments</div>
        {keyMoments.length === 0 ? (
          <div className="empty">Run Analyze All to compute key moments</div>
        ) : (
          <div className="keymoments">
            {keyMoments.map(({ m, idx }) => (
              <button
                key={`${idx}-${m.san}`}
                type="button"
                className={`keymoment ${idx === currentMoveIndex ? 'active' : ''}`}
                onClick={() => onJumpToMove(idx)}
                title={m.annotationReason || m.judgement}
              >
                <div className="km-left">
                  <span className="km-index">{idx + 1}</span>
                  <span className="km-san">{m.san}</span>
                </div>
                <div className={`km-tag ${m.judgement}`}>{m.judgement.toUpperCase()}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
