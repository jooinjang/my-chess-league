import { Chessboard } from 'react-chessboard';
import './ChessBoardPanel.css';

interface ChessBoardPanelProps {
  fen: string;
  boardWidth?: number;
  arrows?: Array<[string, string]>;
  highlightSquares?: string[];
  allowMoves?: boolean;
  onMove?: (from: string, to: string, promotion?: string) => boolean | Promise<boolean>;
}

export function ChessBoardPanel({
  fen,
  boardWidth = 500,
  arrows = [],
  highlightSquares = [],
  allowMoves = false,
  onMove,
}: ChessBoardPanelProps) {
  const squareStyles: Record<string, React.CSSProperties> = {};

  highlightSquares.forEach((square) => {
    squareStyles[square] = {
      backgroundColor: 'rgba(255, 255, 0, 0.4)',
    };
  });

  const arrowsFormatted = arrows.map(([from, to]) => ({
    startSquare: from,
    endSquare: to,
    color: 'rgba(74, 158, 255, 0.8)',
  }));

  const handlePieceDrop = ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }) => {
    if (!onMove || !targetSquare) return false;

    // Check if it's a pawn promotion
    const isPromotion =
      sourceSquare[1] === '7' && targetSquare[1] === '8' ||
      sourceSquare[1] === '2' && targetSquare[1] === '1';

    const result = onMove(sourceSquare, targetSquare, isPromotion ? 'q' : undefined);
    // If the result is a Promise, we need to return true immediately for drag to complete
    // The actual move validation happens async
    if (result instanceof Promise) {
      result.then(() => {}); // Handle the promise
      return true;
    }
    return result;
  };

  return (
    <div className="chess-board-panel" style={{ width: boardWidth, height: boardWidth }}>
      <Chessboard
        options={{
          id: 'analysis-board',
          position: fen,
          allowDragging: allowMoves,
          squareStyles,
          arrows: arrowsFormatted,
          boardStyle: {
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          },
          darkSquareStyle: { backgroundColor: '#779952' },
          lightSquareStyle: { backgroundColor: '#edeed1' },
          onPieceDrop: allowMoves ? handlePieceDrop : undefined,
        }}
      />
    </div>
  );
}
