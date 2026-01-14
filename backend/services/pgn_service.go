package services

import (
	"errors"
	"strings"

	"github.com/notnil/chess"
)

type ParsedPGN struct {
	// FENs includes the starting position at index 0.
	FENs []string
	// UCIMoves length == len(FENs)-1. Each is long algebraic UCI like "e2e4" or "a7a8q".
	UCIMoves []string
	// SANMoves length == len(UCIMoves). Optional, but useful for UI/debugging.
	SANMoves []string
}

type PGNService struct{}

func NewPGNService() *PGNService { return &PGNService{} }

// ParseMainline extracts the mainline move list and produces:
// - fens[0] = initial position
// - fens[i] = position after i plies
// - uciMoves[i-1] = ply i move in UCI
//
// This mirrors the reference project's evaluateGame inputs (fens + uciMoves).
func (s *PGNService) ParseMainline(pgn string) (*ParsedPGN, error) {
	if strings.TrimSpace(pgn) == "" {
		return nil, errors.New("pgn is required")
	}

	opt, err := chess.PGN(strings.NewReader(pgn))
	if err != nil {
		return nil, err
	}

	game := chess.NewGame(opt)
	moves := game.Moves()
	positions := game.Positions() // includes start; len = len(moves)+1
	if len(positions) != len(moves)+1 {
		// Shouldn't happen, but keep it safe.
		return nil, errors.New("unexpected positions length")
	}

	fens := make([]string, 0, len(positions))
	for _, pos := range positions {
		fens = append(fens, pos.XFENString())
	}

	uciMoves := make([]string, 0, len(moves))
	for _, mv := range moves {
		uciMoves = append(uciMoves, moveToUCI(mv))
	}

	// SAN: we prefer chess.AlgebraicNotation's string by replaying moves with that notation.
	sanMoves := make([]string, 0, len(moves))
	{
		replay := chess.NewGame(chess.UseNotation(chess.AlgebraicNotation{}))
		for _, mv := range moves {
			_ = replay.Move(mv) // validated already by PGN parse; ignore error for resilience
			sanMoves = append(sanMoves, mv.String())
		}
	}

	return &ParsedPGN{
		FENs:     fens,
		UCIMoves: uciMoves,
		SANMoves: sanMoves,
	}, nil
}

func moveToUCI(m *chess.Move) string {
	if m == nil {
		return ""
	}
	uci := strings.ToLower(m.S1().String() + m.S2().String())
	p := m.Promo()
	switch p {
	case chess.Queen:
		return uci + "q"
	case chess.Rook:
		return uci + "r"
	case chess.Bishop:
		return uci + "b"
	case chess.Knight:
		return uci + "n"
	default:
		return uci
	}
}


