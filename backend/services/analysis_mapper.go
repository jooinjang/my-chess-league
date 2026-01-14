package services

import (
	"encoding/json"
	"math"
	"time"

	"my-chess-league/backend/models"
)

// Map stored MatchAnalysis (+ positions) to the frontend's MoveAnalysis-like DTO.
func BuildGameAnalysisDTO(a *models.MatchAnalysis) (*models.GameAnalysisDTO, error) {
	if a == nil {
		return nil, nil
	}
	pos := a.Positions
	if len(pos) < 2 {
		return &models.GameAnalysisDTO{
			MatchID:       a.MatchID,
			Moves:         []models.MoveAnalysisDTO{},
			WhiteAccuracy: a.WhiteAccuracy,
			BlackAccuracy: a.BlackAccuracy,
			AnalysisDepth: a.Depth,
			AnalysisDate:  a.CreatedAt.Format(time.RFC3339),
		}, nil
	}

	// Decode lines per position
	type line struct {
		PV      []string `json:"pv"`
		Depth   int      `json:"depth"`
		MultiPV int      `json:"multiPv"`
		CP      *int     `json:"cp,omitempty"`
		Mate    *int     `json:"mate,omitempty"`
	}
	linesByPly := make([][]line, len(pos))
	for i := range pos {
		var lines []line
		if err := json.Unmarshal([]byte(pos[i].LinesJSON), &lines); err != nil {
			lines = []line{}
		}
		linesByPly[i] = lines
	}

	getBest := func(ply int) (cp int, mate *int, pv []string, bestMove string) {
		lines := linesByPly[ply]
		if len(lines) == 0 {
			return 0, nil, nil, ""
		}
		l0 := lines[0]
		if l0.CP != nil {
			cp = *l0.CP
		}
		if l0.Mate != nil {
			m := *l0.Mate
			mate = &m
		}
		pv = l0.PV
		bestMove = pos[ply].BestMove
		if bestMove == "" && len(pv) > 0 {
			bestMove = pv[0]
		}
		return
	}

	moves := make([]models.MoveAnalysisDTO, 0, len(pos)-1)
	for ply := 1; ply < len(pos); ply++ {
		isWhiteMove := ply%2 == 1

		beforeCPWhite, beforeMateWhite, beforePV, bestMove := getBest(ply - 1)
		afterCPWhite, afterMateWhite, _, _ := getBest(ply)

		playerBefore := beforeCPWhite
		playerAfter := afterCPWhite
		if !isWhiteMove {
			playerBefore = -beforeCPWhite
			playerAfter = -afterCPWhite
		}

		evalLoss := int(math.Max(0, float64(playerBefore-playerAfter)))

		// Win%: mate => 100/0, cp => lichess formula
		whiteWinBefore := getWinPercentageFromCp(beforeCPWhite)
		whiteWinAfter := getWinPercentageFromCp(afterCPWhite)
		if beforeMateWhite != nil {
			if *beforeMateWhite > 0 {
				whiteWinBefore = 100
			} else {
				whiteWinBefore = 0
			}
		}
		if afterMateWhite != nil {
			if *afterMateWhite > 0 {
				whiteWinAfter = 100
			} else {
				whiteWinAfter = 0
			}
		}
		playerWinBefore := whiteWinBefore
		playerWinAfter := whiteWinAfter
		if !isWhiteMove {
			playerWinBefore = 100 - whiteWinBefore
			playerWinAfter = 100 - whiteWinAfter
		}
		winLoss := playerWinBefore - playerWinAfter

		// second best from prev position (MultiPV=2)
		var secondMove *string
		var secondEval *int
		if len(linesByPly[ply-1]) >= 2 {
			l2 := linesByPly[ply-1][1]
			if len(l2.PV) > 0 {
				m := l2.PV[0]
				secondMove = &m
			}
			// convert to player perspective for compatibility
			if l2.CP != nil {
				v := *l2.CP
				if !isWhiteMove {
					v = -v
				}
				secondEval = &v
			}
		}

		onlyMove := false
		if len(linesByPly[ply-1]) == 1 {
			onlyMove = true
		}

		// classification mapping (engine grading -> UI judgement)
		var judgement models.MoveJudgement
		var annotation *string
		reason := ""

		mc := ""
		if pos[ply].MoveClassification != nil {
			mc = *pos[ply].MoveClassification
		}
		switch mc {
		case string(Opening):
			judgement = models.JBook
		case string(Forced):
			judgement = models.JBest
			reason = "FORCED"
		case string(Splendid):
			judgement = models.JBrilliant
			s := "!!"
			annotation = &s
		case string(Perfect):
			judgement = models.JGreat
			s := "!"
			annotation = &s
		case string(Best):
			judgement = models.JBest
		case string(Excellent):
			judgement = models.JExcellent
		case string(Okay):
			judgement = models.JGood
		case string(Inaccuracy):
			judgement = models.JInaccuracy
			s := "?!"
			annotation = &s
		case string(Mistake):
			judgement = models.JMistake
			s := "?"
			annotation = &s
		case string(Blunder):
			judgement = models.JBlunder
			s := "??"
			annotation = &s
		default:
			judgement = models.JGood
		}

		// opening name (current position keeps current opening)
		var openingName *string
		if pos[ply].Opening != nil {
			openingName = pos[ply].Opening
		}

		plyIdx := ply
		color := "b"
		if isWhiteMove {
			color = "w"
		}

		// Move number is 1-based fullmove number
		moveNumber := (plyIdx + 1) / 2
		if plyIdx%2 == 1 {
			moveNumber = (plyIdx + 1) / 2
		}

		san := ""
		if pos[ply].SanMove != nil {
			san = *pos[ply].SanMove
		}

		cpl := evalLoss
		winB := playerWinBefore
		winA := playerWinAfter
		winL := winLoss
		cplPtr := &cpl
		winBPtr := &winB
		winAPtr := &winA
		winLPtr := &winL
		onlyMovePtr := &onlyMove

		moves = append(moves, models.MoveAnalysisDTO{
			MoveNumber:       moveNumber,
			Color:            color,
			San:              san,
			Fen:              pos[ply].FEN,
			EvalBefore:       playerBefore,
			EvalAfter:        playerAfter,
			EvalAfterWhite:   afterCPWhite,
			MateBeforeWhite:  beforeMateWhite,
			MateAfterWhite:   afterMateWhite,
			Judgement:        judgement,
			BestMove:         bestMove,
			BestMoveEval:     playerBefore,
			EvalLoss:         evalLoss,
			Annotation:       annotation,
			AnnotationReason: reason,
			PV:               beforePV,
			WinChanceBefore:  winBPtr,
			WinChanceAfter:   winAPtr,
			WinChanceLoss:    winLPtr,
			CPL:              cplPtr,
			OpeningName:      openingName,
			OnlyMove:         onlyMovePtr,
			SecondBestMove:   secondMove,
			SecondBestEval:   secondEval,
		})
	}

	return &models.GameAnalysisDTO{
		MatchID:       a.MatchID,
		Moves:         moves,
		WhiteAccuracy: a.WhiteAccuracy,
		BlackAccuracy: a.BlackAccuracy,
		AnalysisDepth: a.Depth,
		AnalysisDate:  a.CreatedAt.Format(time.RFC3339),
	}, nil
}


