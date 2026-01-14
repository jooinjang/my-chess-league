package services

import (
	"math"
	"strings"

	"github.com/notnil/chess"
)

// This file ports move classification logic from the reference project:
// - src/lib/engine/helpers/moveClassification.ts
// - src/lib/engine/helpers/winPercentage.ts
// - src/lib/chess.ts (piece sacrifice + simple recapture helpers)

type MoveClassification string

const (
	Blunder    MoveClassification = "blunder"
	Mistake    MoveClassification = "mistake"
	Inaccuracy MoveClassification = "inaccuracy"
	Okay       MoveClassification = "okay"
	Excellent  MoveClassification = "excellent"
	Best       MoveClassification = "best"
	Forced     MoveClassification = "forced"
	Opening    MoveClassification = "opening"
	Perfect    MoveClassification = "perfect"
	Splendid   MoveClassification = "splendid"
)

// PositionLine models the minimal subset of eval line needed for classification.
// cp/mate are WHITE perspective.
type PositionLine struct {
	PV   []string
	CP   *int
	Mate *int
}

type PositionEval struct {
	BestMove string
	Lines    []PositionLine
	Opening  string
	// Computed classification for the move that led to this position
	MoveClassification MoveClassification
}

// OpeningBook provides opening name lookup by FEN piece-placement (first field only).
type OpeningBook interface {
	LookupByPiecePlacement(piecePlacement string) (name string, ok bool)
}

// ClassifyMoves classifies each position's preceding move using engine evaluations and opening book.
// Inputs:
// - rawPositions: length N positions (start + after each ply), each with multiPv lines and bestMove
// - uciMoves: length N-1 moves (ply order), in standard UCI (e1g1 for castling)
// - fens: length N (must align with rawPositions)
func ClassifyMoves(rawPositions []PositionEval, uciMoves []string, fens []string, openingBook OpeningBook) []PositionEval {
	if len(rawPositions) == 0 {
		return rawPositions
	}
	positionsWin := make([]float64, len(rawPositions))
	for i := range rawPositions {
		positionsWin[i] = getPositionWinPercentage(rawPositions[i])
	}
	var currentOpening string

	out := make([]PositionEval, len(rawPositions))
	for idx := range rawPositions {
		raw := rawPositions[idx]
		if idx == 0 {
			out[idx] = raw
			continue
		}

		// opening detection: match by piece placement (fen.split(" ")[0]) against openings dataset
		piecePlacement := strings.SplitN(fens[idx], " ", 2)[0]
		if openingBook != nil {
			if name, ok := openingBook.LookupByPiecePlacement(piecePlacement); ok {
				currentOpening = name
				raw.Opening = name
				raw.MoveClassification = Opening
				out[idx] = raw
				continue
			}
		}

		prev := rawPositions[idx-1]
		if len(prev.Lines) == 1 {
			raw.Opening = currentOpening
			raw.MoveClassification = Forced
			out[idx] = raw
			continue
		}

		playedMove := uciMoves[idx-1]
		var altLine *PositionLine
		for _, ln := range prev.Lines {
			if len(ln.PV) == 0 {
				continue
			}
			if ln.PV[0] != playedMove {
				copyLn := ln
				altLine = &copyLn
				break
			}
		}
		var altWin *float64
		if altLine != nil {
			v := getLineWinPercentage(*altLine)
			altWin = &v
		}

		bestLinePvToPlay := []string{}
		if len(raw.Lines) > 0 {
			bestLinePvToPlay = raw.Lines[0].PV
		}

		lastWin := positionsWin[idx-1]
		curWin := positionsWin[idx]
		isWhiteMove := idx%2 == 1

		if isSplendidMove(lastWin, curWin, isWhiteMove, playedMove, bestLinePvToPlay, fens[idx-1], altWin) {
			raw.Opening = currentOpening
			raw.MoveClassification = Splendid
			out[idx] = raw
			continue
		}

		var fenTwoMovesAgo *string
		var uciNextTwoMoves *[2]string
		if idx > 1 {
			f := fens[idx-2]
			fenTwoMovesAgo = &f
			m0 := uciMoves[idx-2]
			m1 := uciMoves[idx-1]
			tmp := [2]string{m0, m1}
			uciNextTwoMoves = &tmp
		}

		if isPerfectMove(lastWin, curWin, isWhiteMove, altWin, fenTwoMovesAgo, uciNextTwoMoves) {
			raw.Opening = currentOpening
			raw.MoveClassification = Perfect
			out[idx] = raw
			continue
		}

		if playedMove != "" && playedMove == prev.BestMove {
			raw.Opening = currentOpening
			raw.MoveClassification = Best
			out[idx] = raw
			continue
		}

		raw.Opening = currentOpening
		raw.MoveClassification = getMoveBasicClassification(lastWin, curWin, isWhiteMove)
		out[idx] = raw
	}
	return out
}

func getMoveBasicClassification(lastWin float64, curWin float64, isWhiteMove bool) MoveClassification {
	diff := (curWin - lastWin)
	if !isWhiteMove {
		diff = -diff
	}
	if diff < -20 {
		return Blunder
	}
	if diff < -10 {
		return Mistake
	}
	if diff < -5 {
		return Inaccuracy
	}
	if diff < -2 {
		return Okay
	}
	return Excellent
}

func isSplendidMove(lastWin, curWin float64, isWhiteMove bool, playedMove string, bestLinePvToPlay []string, fen string, altWin *float64) bool {
	if altWin == nil {
		return false
	}
	diff := (curWin - lastWin)
	if !isWhiteMove {
		diff = -diff
	}
	if diff < -2 {
		return false
	}
	if !getIsPieceSacrifice(fen, playedMove, bestLinePvToPlay) {
		return false
	}
	if isLosingOrAlternateCompletelyWinning(curWin, *altWin, isWhiteMove) {
		return false
	}
	return true
}

func isPerfectMove(lastWin, curWin float64, isWhiteMove bool, altWin *float64, fenTwoMovesAgo *string, uciMoves *[2]string) bool {
	if altWin == nil {
		return false
	}
	diff := (curWin - lastWin)
	if !isWhiteMove {
		diff = -diff
	}
	if diff < -2 {
		return false
	}
	if fenTwoMovesAgo != nil && uciMoves != nil && isSimplePieceRecapture(*fenTwoMovesAgo, *uciMoves) {
		return false
	}
	if isLosingOrAlternateCompletelyWinning(curWin, *altWin, isWhiteMove) {
		return false
	}
	return getHasChangedGameOutcome(lastWin, curWin, isWhiteMove) || getIsTheOnlyGoodMove(curWin, *altWin, isWhiteMove)
}

func isLosingOrAlternateCompletelyWinning(curWin float64, altWin float64, isWhiteMove bool) bool {
	isLosing := false
	if isWhiteMove {
		isLosing = curWin < 50
	} else {
		isLosing = curWin > 50
	}
	altIsCompletelyWinning := false
	if isWhiteMove {
		altIsCompletelyWinning = altWin > 97
	} else {
		altIsCompletelyWinning = altWin < 3
	}
	return isLosing || altIsCompletelyWinning
}

func getHasChangedGameOutcome(lastWin, curWin float64, isWhiteMove bool) bool {
	diff := (curWin - lastWin)
	if !isWhiteMove {
		diff = -diff
	}
	return diff > 10 && ((lastWin < 50 && curWin > 50) || (lastWin > 50 && curWin < 50))
}

func getIsTheOnlyGoodMove(curWin float64, altWin float64, isWhiteMove bool) bool {
	diff := (curWin - altWin)
	if !isWhiteMove {
		diff = -diff
	}
	return diff > 10
}

func getPositionWinPercentage(pos PositionEval) float64 {
	if len(pos.Lines) == 0 {
		return 50
	}
	return getLineWinPercentage(pos.Lines[0])
}

func getLineWinPercentage(line PositionLine) float64 {
	if line.CP != nil {
		return getWinPercentageFromCp(*line.CP)
	}
	if line.Mate != nil {
		if *line.Mate > 0 {
			return 100
		}
		return 0
	}
	return 50
}

func getWinPercentageFromCp(cp int) float64 {
	cpCeiled := ceilsNumber(float64(cp), -1000, 1000)
	const multiplier = -0.00368208
	winChances := 2/(1+math.Exp(multiplier*cpCeiled)) - 1
	return 50 + 50*winChances
}

func ceilsNumber(n float64, lo float64, hi float64) float64 {
	if n < lo {
		return lo
	}
	if n > hi {
		return hi
	}
	return n
}

// ---- sacrifice / recapture ports ----

func isSimplePieceRecapture(fen string, uciMoves [2]string) bool {
	game := chess.NewGame()
	_ = game.MoveStr("") // no-op
	opt, err := chess.FEN(fen)
	if err == nil {
		game = chess.NewGame(opt)
	}

	to0 := uciMoves[0][2:4]
	to1 := uciMoves[1][2:4]
	if to0 != to1 {
		return false
	}

	sq := squareFromString(to0)
	if sq == chess.NoSquare {
		return false
	}
	p := game.Position().Board().Piece(sq)
	return p != chess.NoPiece
}

func getIsPieceSacrifice(fen string, playedMove string, bestLinePvToPlay []string) bool {
	if len(bestLinePvToPlay) == 0 {
		return false
	}
	opt, err := chess.FEN(fen)
	if err != nil {
		return false
	}
	game := chess.NewGame(opt)
	whiteToPlay := game.Position().Turn() == chess.White
	startingMaterialDiff := getMaterialDifference(game.Position().Board())

	moves := append([]string{playedMove}, bestLinePvToPlay...)
	if len(moves)%2 == 1 {
		moves = moves[:len(moves)-1]
	}

	nonCapturingMovesTemp := 1
	capturedW := make([]chess.PieceType, 0)
	capturedB := make([]chess.PieceType, 0)

	uciNotation := chess.UCINotation{}
	for _, uci := range moves {
		mv, err := uciNotation.Decode(game.Position(), uci)
		if err != nil {
			return false
		}

		if mv.HasTag(chess.Capture) || mv.HasTag(chess.EnPassant) {
			captured := capturedPieceTypeBeforeMove(game.Position(), mv)
			if captured != chess.NoPieceType {
				if game.Position().Turn() == chess.White {
					capturedW = append(capturedW, captured)
				} else {
					capturedB = append(capturedB, captured)
				}
			}
			nonCapturingMovesTemp = 1
		} else {
			nonCapturingMovesTemp--
			if nonCapturingMovesTemp < 0 {
				break
			}
		}

		if err := game.Move(mv); err != nil {
			return false
		}
	}

	// cancel out trades of same piece types
	capturedW2 := append([]chess.PieceType{}, capturedW...)
	capturedB2 := append([]chess.PieceType{}, capturedB...)

	for i := 0; i < len(capturedW2); i++ {
		p := capturedW2[i]
		found := -1
		for j := 0; j < len(capturedB2); j++ {
			if capturedB2[j] == p {
				found = j
				break
			}
		}
		if found >= 0 {
			capturedB2 = append(capturedB2[:found], capturedB2[found+1:]...)
			capturedW2 = append(capturedW2[:i], capturedW2[i+1:]...)
			i--
		}
	}

	// if only pawns captured and counts close, ignore
	if math.Abs(float64(len(capturedW2)-len(capturedB2))) <= 1 {
		allPawns := true
		for _, p := range append(capturedW2, capturedB2...) {
			if p != chess.Pawn {
				allPawns = false
				break
			}
		}
		if allPawns {
			return false
		}
	}

	endingMaterialDiff := getMaterialDifference(game.Position().Board())
	materialDiff := endingMaterialDiff - startingMaterialDiff
	if !whiteToPlay {
		materialDiff = -materialDiff
	}
	return materialDiff < 0
}

func getMaterialDifference(b *chess.Board) int {
	if b == nil {
		return 0
	}
	sum := 0
	for _, p := range b.SquareMap() {
		if p == chess.NoPiece {
			continue
		}
		v := pieceValue(p.Type())
		if p.Color() == chess.White {
			sum += v
		} else {
			sum -= v
		}
	}
	return sum
}

func pieceValue(pt chess.PieceType) int {
	switch pt {
	case chess.Pawn:
		return 1
	case chess.Knight:
		return 3
	case chess.Bishop:
		return 3
	case chess.Rook:
		return 5
	case chess.Queen:
		return 9
	default:
		return 0
	}
}

func squareFromString(s string) chess.Square {
	if len(s) != 2 {
		return chess.NoSquare
	}
	file := s[0]
	rank := s[1]
	var f chess.File
	switch file {
	case 'a':
		f = chess.FileA
	case 'b':
		f = chess.FileB
	case 'c':
		f = chess.FileC
	case 'd':
		f = chess.FileD
	case 'e':
		f = chess.FileE
	case 'f':
		f = chess.FileF
	case 'g':
		f = chess.FileG
	case 'h':
		f = chess.FileH
	default:
		return chess.NoSquare
	}
	var r chess.Rank
	switch rank {
	case '1':
		r = chess.Rank1
	case '2':
		r = chess.Rank2
	case '3':
		r = chess.Rank3
	case '4':
		r = chess.Rank4
	case '5':
		r = chess.Rank5
	case '6':
		r = chess.Rank6
	case '7':
		r = chess.Rank7
	case '8':
		r = chess.Rank8
	default:
		return chess.NoSquare
	}
	return chess.NewSquare(f, r)
}

// Determine captured piece type from the pre-move position.
func capturedPieceTypeBeforeMove(pos *chess.Position, mv *chess.Move) chess.PieceType {
	if pos == nil || mv == nil {
		return chess.NoPieceType
	}

	board := pos.Board()
	to := mv.S2()
	if mv.HasTag(chess.EnPassant) {
		if pos.Turn() == chess.White {
			if to.Rank() > chess.Rank1 {
				sq := chess.NewSquare(to.File(), to.Rank()-1)
				p := board.Piece(sq)
				if p != chess.NoPiece {
					return p.Type()
				}
			}
		} else {
			if to.Rank() < chess.Rank8 {
				sq := chess.NewSquare(to.File(), to.Rank()+1)
				p := board.Piece(sq)
				if p != chess.NoPiece {
					return p.Type()
				}
			}
		}
		return chess.Pawn
	}
	p := board.Piece(to)
	if p == chess.NoPiece {
		return chess.NoPieceType
	}
	return p.Type()
}


