import React, { useEffect, useRef, useMemo } from 'react';
import { ChessMove, MoveAnalysis, MoveJudgement, MoveNode } from '../../types/analysis';
import { MoveAnnotation } from './MoveAnnotation';
import './MoveList.css';
import type { PgnTimeData } from '../../utils/pgnTime';
import { formatClock, formatElapsed } from '../../utils/pgnTime';

interface MoveListProps {
  moves: ChessMove[];
  analysis?: MoveAnalysis[];
  pgnTime?: PgnTimeData;
  commentsByPly?: Array<string | null>;
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  onGoToStart: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoToEnd: () => void;

  // Variation support
  moveTree?: MoveNode | null;
  currentNode?: MoveNode | null;
  onNodeClick?: (node: MoveNode) => void;
  onGoToMainLine?: () => void;
  isInVariation?: boolean;
}

function getTimeLabelForPly(pgnTime: PgnTimeData | undefined, plyIndex: number): string | null {
  if (!pgnTime || plyIndex < 0) return null;

  if (pgnTime.displayMode === 'clock') {
    const v = pgnTime.clockAfterSeconds?.[plyIndex];
    if (v === undefined || v === null) return null;
    return formatClock(v);
  }

  if (pgnTime.displayMode === 'elapsed') {
    const v = pgnTime.elapsedSeconds?.[plyIndex];
    if (v === undefined || v === null) return null;
    return formatElapsed(v);
  }

  return null;
}

function stripBracketTags(comment: string): { cleaned: string; hadTags: boolean } {
  const tagRe = /\[%[a-zA-Z0-9_]+\s+[^\]]*?\]/g;
  const hadTags = tagRe.test(comment);
  const cleaned = comment
    .replace(tagRe, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { cleaned, hadTags };
}

function getCommentForPly(commentsByPly: Array<string | null> | undefined, plyIndex: number): string | null {
  if (!commentsByPly || plyIndex < 0) return null;
  const raw = commentsByPly[plyIndex];
  if (!raw) return null;
  const { cleaned } = stripBracketTags(raw);
  return cleaned || raw;
}

function getJudgementLabel(j: MoveJudgement): string {
  switch (j) {
    case 'brilliant':
      return 'BRILLIANT';
    case 'great':
      return 'GREAT';
    case 'best':
      return 'BEST';
    case 'excellent':
      return 'EXCELLENT';
    case 'good':
      return 'GOOD';
    case 'book':
      return 'BOOK';
    case 'inaccuracy':
      return 'INACC';
    case 'miss':
      return 'MISS';
    case 'mistake':
      return 'MISTAKE';
    case 'blunder':
      return 'BLUNDER';
    case 'normal':
    default:
      return 'OK';
  }
}

function JudgementBadge({ judgement, reason }: { judgement: MoveJudgement; reason?: string }) {
  return (
    <span
      className={`judgement-badge ${judgement}`}
      title={reason || judgement}
      aria-label={`Judgement: ${judgement}`}
    >
      {getJudgementLabel(judgement)}
    </span>
  );
}

// Render a single move with annotation
function MoveSpan({
  node,
  isActive,
  analysis,
  onClick,
  activeMoveRef,
  timeLabel,
  comment,
}: {
  node: MoveNode;
  isActive: boolean;
  analysis?: MoveAnalysis;
  onClick: () => void;
  activeMoveRef?: React.RefObject<HTMLSpanElement | null>;
  timeLabel?: string | null;
  comment?: string | null;
}) {
  if (!node.move) return null;

  return (
    <span
      ref={isActive ? activeMoveRef : null}
      className={`move ${node.move.color} ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <span className="move-san">{node.move.san}</span>
      {timeLabel && <span className="move-time">{timeLabel}</span>}
      {comment && (
        <span className="move-comment-indicator" title={comment} aria-label="Comment">
          C
        </span>
      )}
      {analysis?.judgement && (
        <JudgementBadge judgement={analysis.judgement} reason={analysis.annotationReason} />
      )}
      {analysis?.annotation && (
        <MoveAnnotation
          annotation={analysis.annotation}
          showTooltip
          reason={analysis.annotationReason}
        />
      )}
    </span>
  );
}

// Recursive component to render variations
function VariationLine({
  nodes,
  startMoveNumber,
  startColor: _startColor,
  currentNode,
  analysis,
  onNodeClick,
  activeMoveRef,
  depth,
  pgnTime,
  commentsByPly,
}: {
  nodes: MoveNode[];
  startMoveNumber: number;
  startColor: 'w' | 'b';
  currentNode: MoveNode | null;
  analysis?: MoveAnalysis[];
  onNodeClick: (node: MoveNode) => void;
  activeMoveRef: React.RefObject<HTMLSpanElement | null>;
  depth: number;
  pgnTime?: PgnTimeData;
  commentsByPly?: Array<string | null>;
}) {
  const elements: React.ReactElement[] = [];
  let moveNumber = startMoveNumber;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node.move) continue;

    const isActive = currentNode?.id === node.id;
    const moveAnalysis = analysis?.find(
      (a) => a.moveNumber === moveNumber && a.color === node.move!.color
    );

    // Show move number for white moves or first move in variation
    const showMoveNumber = node.move.color === 'w' || i === 0;
    const moveNumberStr = node.move.color === 'w'
      ? `${moveNumber}.`
      : `${moveNumber}...`;

    elements.push(
      <span key={node.id} className="variation-move">
        {showMoveNumber && <span className="move-number">{moveNumberStr}</span>}
        <MoveSpan
          node={node}
          isActive={isActive}
          analysis={moveAnalysis}
          onClick={() => onNodeClick(node)}
          activeMoveRef={isActive ? activeMoveRef : undefined}
          timeLabel={getTimeLabelForPly(pgnTime, node.moveIndex)}
          comment={getCommentForPly(commentsByPly, node.moveIndex)}
        />
      </span>
    );

    // Render inline variations (side lines) after this move
    if (node.children.length > 1) {
      for (let j = 1; j < node.children.length; j++) {
        const variationStart = node.children[j];
        const variationNodes = collectVariationLine(variationStart);
        const nextMoveNumber = node.move.color === 'w' ? moveNumber : moveNumber + 1;
        const nextColor = node.move.color === 'w' ? 'b' : 'w';

        elements.push(
          <span key={`var-${node.id}-${j}`} className={`variation depth-${Math.min(depth + 1, 3)}`}>
            <span className="variation-bracket">(</span>
            <VariationLine
              nodes={variationNodes}
              startMoveNumber={nextMoveNumber}
              startColor={nextColor}
              currentNode={currentNode}
              analysis={analysis}
              onNodeClick={onNodeClick}
              activeMoveRef={activeMoveRef}
              depth={depth + 1}
              pgnTime={pgnTime}
              commentsByPly={commentsByPly}
            />
            <span className="variation-bracket">)</span>
          </span>
        );
      }
    }

    // Update move number for next iteration
    if (node.move.color === 'b') {
      moveNumber++;
    }

    // Continue with main line (first child)
    if (node.children.length > 0) {
      const continuation = collectVariationLine(node.children[0]);
      if (continuation.length > 0) {
        const continuationElements = (
          <VariationLine
            key={`cont-${node.id}`}
            nodes={continuation}
            startMoveNumber={node.move.color === 'w' ? moveNumber : moveNumber + 1}
            startColor={node.move.color === 'w' ? 'b' : 'w'}
            currentNode={currentNode}
            analysis={analysis}
            onNodeClick={onNodeClick}
            activeMoveRef={activeMoveRef}
            depth={depth}
            pgnTime={pgnTime}
            commentsByPly={commentsByPly}
          />
        );
        elements.push(continuationElements);
      }
    }

    break; // Only process first node, recursion handles the rest
  }

  return <>{elements}</>;
}

// Collect a line of moves following the first child at each step
function collectVariationLine(startNode: MoveNode): MoveNode[] {
  const line: MoveNode[] = [];
  let current: MoveNode | null = startNode;

  while (current) {
    line.push(current);
    if (current.children.length === 0) break;
    // Only collect until we hit a branch point (for variations, we handle recursively)
    if (current.children.length > 1) {
      break;
    }
    current = current.children[0];
  }

  return line;
}

export function MoveList({
  moves,
  analysis,
  pgnTime,
  commentsByPly,
  currentMoveIndex,
  onMoveClick,
  onGoToStart,
  onGoBack,
  onGoForward,
  onGoToEnd,
  moveTree,
  currentNode,
  onNodeClick,
  onGoToMainLine,
  isInVariation,
}: MoveListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeMoveRef = useRef<HTMLSpanElement | null>(null);

  // Scroll active move into view
  useEffect(() => {
    if (activeMoveRef.current && listRef.current) {
      activeMoveRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentMoveIndex, currentNode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onGoBack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onGoForward();
      } else if (e.key === 'Home') {
        e.preventDefault();
        onGoToStart();
      } else if (e.key === 'End') {
        e.preventDefault();
        onGoToEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onGoBack, onGoForward, onGoToStart, onGoToEnd]);

  const getAnalysisForMove = (index: number): MoveAnalysis | undefined => {
    if (!analysis) return undefined;
    return analysis.find(
      (a) => a.moveNumber === Math.ceil((index + 1) / 2) && a.color === moves[index].color
    );
  };

  // Check if there are any actual variations in the tree
  const hasVariations = useMemo(() => {
    if (!moveTree) return false;
    const checkForVariations = (node: MoveNode): boolean => {
      if (node.children.length > 1) return true;
      return node.children.some(checkForVariations);
    };
    return checkForVariations(moveTree);
  }, [moveTree]);

  // Use tree-based rendering only when there are actual variations
  // Otherwise use Chess.com style table format
  const useTreeRendering = moveTree && onNodeClick && hasVariations;

  const currentComment = useMemo(() => {
    return getCommentForPly(commentsByPly, currentMoveIndex);
  }, [commentsByPly, currentMoveIndex]);

  // Memoize the tree-based move list rendering
  const treeContent = useMemo(() => {
    if (!moveTree || !onNodeClick) return null;

    // Start from root's first child (first move)
    if (moveTree.children.length === 0) {
      return <div className="no-moves">No moves</div>;
    }

    return (
      <VariationLine
        nodes={[moveTree.children[0]]}
        startMoveNumber={1}
        startColor="w"
        currentNode={currentNode || null}
        analysis={analysis}
        onNodeClick={onNodeClick}
        activeMoveRef={activeMoveRef}
        depth={0}
        pgnTime={pgnTime}
        commentsByPly={commentsByPly}
      />
    );
  }, [moveTree, currentNode, analysis, onNodeClick, pgnTime, commentsByPly]);

  // Table-based pair rendering (Chess.com style)
  const movePairs = useMemo(() => {
    const pairs: Array<{
      number: number;
      white?: ChessMove;
      black?: ChessMove;
      whiteIdx?: number;
      blackIdx?: number;
    }> = [];

    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1],
        whiteIdx: i,
        blackIdx: i + 1 < moves.length ? i + 1 : undefined,
      });
    }

    return pairs;
  }, [moves]);

  const timeHeader = useMemo(() => {
    if (!pgnTime || pgnTime.displayMode === 'none') return null;
    const modeLabel = pgnTime.displayMode === 'clock' ? '남은시간' : '소요시간';
    const tc = pgnTime.timeControlLabel || pgnTime.timeControlRaw;
    return (
      <div className="move-list-header">
        <h3>Moves</h3>
        <div className="time-meta">
          {tc && <span className="time-control">TC: {tc}</span>}
          <span className="time-mode">{modeLabel}</span>
        </div>
      </div>
    );
  }, [pgnTime]);

  return (
    <div className="move-list-container">
      {timeHeader}
      {isInVariation && onGoToMainLine && (
        <div className="variation-indicator">
          <span className="variation-badge">Variation</span>
          <button className="return-main-line" onClick={onGoToMainLine}>
            ← Main line
          </button>
        </div>
      )}

      <div className="move-list" ref={listRef}>
        {useTreeRendering ? (
          <div className="move-tree-content">{treeContent}</div>
        ) : (
          // Chess.com style table rendering
          <table className="move-table">
            <tbody>
              {movePairs.map((pair) => {
                const whiteAnalysis =
                  pair.whiteIdx !== undefined ? getAnalysisForMove(pair.whiteIdx) : undefined;
                const blackAnalysis =
                  pair.blackIdx !== undefined ? getAnalysisForMove(pair.blackIdx) : undefined;

                const whiteTime =
                  pair.whiteIdx !== undefined ? getTimeLabelForPly(pgnTime, pair.whiteIdx) : null;
                const blackTime =
                  pair.blackIdx !== undefined ? getTimeLabelForPly(pgnTime, pair.blackIdx) : null;
                const whiteComment =
                  pair.whiteIdx !== undefined ? getCommentForPly(commentsByPly, pair.whiteIdx) : null;
                const blackComment =
                  pair.blackIdx !== undefined ? getCommentForPly(commentsByPly, pair.blackIdx) : null;

                return (
                  <tr key={pair.number} className="move-row">
                    <td className="move-number">{pair.number}</td>
                    <td className="move-cell white">
                      {pair.white && (
                        <span
                          ref={currentMoveIndex === pair.whiteIdx ? activeMoveRef : null}
                          className={`move move-with-time ${currentMoveIndex === pair.whiteIdx ? 'active' : ''}`}
                          onClick={() => pair.whiteIdx !== undefined && onMoveClick(pair.whiteIdx)}
                        >
                          <span className="move-san">{pair.white.san}</span>
                          {whiteTime && <span className="move-time">{whiteTime}</span>}
                          {whiteComment && (
                            <span className="move-comment-indicator" title={whiteComment} aria-label="Comment">
                              C
                            </span>
                          )}
                          {whiteAnalysis?.judgement && (
                            <JudgementBadge
                              judgement={whiteAnalysis.judgement}
                              reason={whiteAnalysis.annotationReason}
                            />
                          )}
                          {whiteAnalysis?.annotation && (
                            <MoveAnnotation
                              annotation={whiteAnalysis.annotation}
                              showTooltip
                              reason={whiteAnalysis.annotationReason}
                            />
                          )}
                        </span>
                      )}
                    </td>
                    <td className="move-cell black">
                      {pair.black && (
                        <span
                          ref={currentMoveIndex === pair.blackIdx ? activeMoveRef : null}
                          className={`move move-with-time ${currentMoveIndex === pair.blackIdx ? 'active' : ''}`}
                          onClick={() => pair.blackIdx !== undefined && onMoveClick(pair.blackIdx)}
                        >
                          <span className="move-san">{pair.black.san}</span>
                          {blackTime && <span className="move-time">{blackTime}</span>}
                          {blackComment && (
                            <span className="move-comment-indicator" title={blackComment} aria-label="Comment">
                              C
                            </span>
                          )}
                          {blackAnalysis?.judgement && (
                            <JudgementBadge
                              judgement={blackAnalysis.judgement}
                              reason={blackAnalysis.annotationReason}
                            />
                          )}
                          {blackAnalysis?.annotation && (
                            <MoveAnnotation
                              annotation={blackAnalysis.annotation}
                              showTooltip
                              reason={blackAnalysis.annotationReason}
                            />
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {currentComment && (
        <div className="move-comment-panel" role="note" aria-label="Move comment">
          <div className="move-comment-title">Comment</div>
          <div className="move-comment-body">{currentComment}</div>
        </div>
      )}

      <div className="navigation-buttons">
        <button onClick={onGoToStart} title="Go to start (Home)" aria-label="Go to start">
          ⏮
        </button>
        <button onClick={onGoBack} title="Previous move (←)" aria-label="Previous move">
          ◀
        </button>
        <button onClick={onGoForward} title="Next move (→)" aria-label="Next move">
          ▶
        </button>
        <button onClick={onGoToEnd} title="Go to end (End)" aria-label="Go to end">
          ⏭
        </button>
      </div>
    </div>
  );
}
