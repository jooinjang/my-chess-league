package services

import "context"

// PositionEvaluator abstracts how we evaluate a single position (FEN) to obtain best move + PV lines.
// Implementations:
// - local Stockfish process (EngineService)
// - remote Chess-API (ChessAPIEngineService)
type PositionEvaluator interface {
	EvaluatePosition(ctx context.Context, fen string, depth int, multiPv int) (*EnginePositionEval, error)
}


