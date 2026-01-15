package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"my-chess-league/backend/config"
	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
)

type AnalysisService struct {
	engine      PositionEvaluator
	engineName  string
	pgn         *PGNService
	openingBook OpeningBook
	cfg         *config.Config
}

func NewAnalysisService(cfg *config.Config) *AnalysisService {
	var evaluator PositionEvaluator
	var engineName string
	
	// Default: use external chess-api.com (remote Stockfish 17).
	// Set ANALYSIS_ENGINE=local to use local Stockfish binary instead.
	if cfg.AnalysisEngine == "local" {
		evaluator = NewEngineService(cfg.StockfishPath)
		engineName = "stockfish"
	} else {
		// Default: chess_api (external API)
		evaluator = NewChessAPIEngineService(cfg.ChessAPIWS, cfg.ChessAPIURL, cfg.ChessAPIMaxThinkingMs)
		engineName = "chess-api"
	}
	return &AnalysisService{
		engine:      evaluator,
		engineName:  engineName,
		pgn:         NewPGNService(),
		openingBook: NewOpeningBook(),
		cfg:         cfg,
	}
}

// StartAnalyzeMatch creates a MatchAnalysis row and runs analysis asynchronously.
// It returns quickly so reverse-proxies (nginx) won't time out, and clients can track progress via SSE.
func (s *AnalysisService) StartAnalyzeMatch(matchID uint, depthOverride *int, multiPvOverride *int) (*models.MatchAnalysis, error) {
	start := time.Now()
	var match models.Match
	if err := database.DB.First(&match, matchID).Error; err != nil {
		return nil, err
	}
	if match.PGN == nil || *match.PGN == "" {
		return nil, errors.New("match has no pgn")
	}

	parsed, err := s.pgn.ParseMainline(*match.PGN)
	if err != nil {
		return nil, err
	}

	depth := s.cfg.AnalysisDepth
	multiPv := s.cfg.AnalysisMultiPV
	if depthOverride != nil && *depthOverride > 0 {
		depth = *depthOverride
	}
	if multiPvOverride != nil && *multiPvOverride >= 2 && *multiPvOverride <= 6 {
		multiPv = *multiPvOverride
	}

	analysis := &models.MatchAnalysis{
		MatchID: matchID,
		Status:  models.MatchAnalysisRunning,
		Engine:  s.engineName,
		Depth:   depth,
		MultiPV: multiPv,
	}
	if err := database.DB.Create(analysis).Error; err != nil {
		return nil, err
	}
	
	// Log which engine is being used for debugging
	fmt.Printf("[Analysis] Starting analysis for match %d using engine: %s (depth=%d, multiPv=%d, positions=%d)\n",
		matchID, s.engineName, depth, multiPv, len(parsed.FENs))

	SetAnalysisProgress(matchID, analysis.ID, 0, len(parsed.FENs), "running", start, 0)

	// Run analysis in background so request cancellation/timeout doesn't abort analysis.
	go func(analysisID uint, mID uint, parsed ParsedPGN, depth int, multiPv int, started time.Time) {
		_ = s.runAnalysis(context.Background(), analysisID, mID, &parsed, depth, multiPv, started)
	}(analysis.ID, matchID, *parsed, depth, multiPv, start)

	return analysis, nil
}

// EvaluatePosition evaluates a single position and returns the engine evaluation.
func (s *AnalysisService) EvaluatePosition(fen string, depth int) (*EnginePositionEval, error) {
	timeout := time.Duration(s.cfg.AnalysisTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = DefaultEngineTimeout(depth)
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	multiPv := s.cfg.AnalysisMultiPV
	if multiPv < 2 {
		multiPv = 3
	}

	return s.engine.EvaluatePosition(ctx, fen, depth, multiPv)
}

func (s *AnalysisService) GetLatestAnalysis(matchID uint) (*models.MatchAnalysis, error) {
	var a models.MatchAnalysis
	if err := database.DB.Where("match_id = ?", matchID).
		Order("created_at DESC").First(&a).Error; err != nil {
		return nil, err
	}
	var positions []models.MatchAnalysisPosition
	if err := database.DB.Where("match_analysis_id = ?", a.ID).
		Order("ply ASC").Find(&positions).Error; err != nil {
		return nil, err
	}
	a.Positions = positions
	return &a, nil
}

func (s *AnalysisService) runAnalysis(ctx context.Context, analysisID uint, matchID uint, parsed *ParsedPGN, depth int, multiPv int, started time.Time) error {
	start := started
	// Evaluate all positions (including start), similar to the reference project's evaluateGame flow.
	rawEngine := make([]*EnginePositionEval, len(parsed.FENs))
	rawEval := make([]PositionEval, len(parsed.FENs))

	timeout := time.Duration(s.cfg.AnalysisTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = DefaultEngineTimeout(depth)
	}

	for i, fen := range parsed.FENs {
		iterStart := time.Now()
		posCtx, cancel := context.WithTimeout(ctx, timeout)
		eval, eErr := s.engine.EvaluatePosition(posCtx, fen, depth, multiPv)
		cancel()
		if eErr != nil {
			msg := fmt.Sprintf("engine error at ply=%d: %v", i, eErr)
			// update analysis row
			_ = database.DB.Model(&models.MatchAnalysis{}).
				Where("id = ?", analysisID).
				Updates(map[string]any{
					"status":        models.MatchAnalysisError,
					"error_message": &msg,
				}).Error

			SetAnalysisProgress(matchID, analysisID, i, len(parsed.FENs), "error", start, time.Since(iterStart).Milliseconds())
			return eErr
		}
		rawEngine[i] = eval
		rawEval[i] = PositionEval{
			BestMove: eval.BestMove,
			Lines:    toPositionLines(eval.Lines),
		}

		lastMs := time.Since(iterStart).Milliseconds()
		SetAnalysisProgress(matchID, analysisID, i+1, len(parsed.FENs), "running", start, lastMs)
	}

	// Classify moves (opening/forced/splendid/perfect/best/..)
	classified := ClassifyMoves(rawEval, parsed.UCIMoves, parsed.FENs, s.openingBook)
	acc := ComputeAccuracy(classified)

	// update analysis summary
	_ = database.DB.Model(&models.MatchAnalysis{}).
		Where("id = ?", analysisID).
		Updates(map[string]any{
			"status":         models.MatchAnalysisComplete,
			"white_accuracy": acc.White,
			"black_accuracy": acc.Black,
		}).Error

	// Persist per-position rows.
	positions := make([]models.MatchAnalysisPosition, 0, len(parsed.FENs))
	for i := range parsed.FENs {
		linesJSONBytes, _ := json.Marshal(rawEngine[i].Lines)
		linesJSON := string(linesJSONBytes)

		var uciMove *string
		var sanMove *string
		var moveClass *string
		var opening *string
		if i > 0 {
			u := parsed.UCIMoves[i-1]
			san := parsed.SANMoves[i-1]
			uciMove = &u
			sanMove = &san
			mc := string(classified[i].MoveClassification)
			moveClass = &mc
		}
		if classified[i].Opening != "" {
			o := classified[i].Opening
			opening = &o
		}

		positions = append(positions, models.MatchAnalysisPosition{
			MatchAnalysisID:   analysisID,
			Ply:               i,
			FEN:               parsed.FENs[i],
			UciMove:           uciMove,
			SanMove:           sanMove,
			BestMove:          rawEngine[i].BestMove,
			LinesJSON:         linesJSON,
			Opening:           opening,
			MoveClassification: moveClass,
		})
	}
	if err := database.DB.Create(&positions).Error; err != nil {
		msg := fmt.Sprintf("db error saving positions: %v", err)
		_ = database.DB.Model(&models.MatchAnalysis{}).
			Where("id = ?", analysisID).
			Updates(map[string]any{
				"status":        models.MatchAnalysisError,
				"error_message": &msg,
			}).Error
		SetAnalysisProgress(matchID, analysisID, len(parsed.FENs), len(parsed.FENs), "error", start, 0)
		return err
	}

	SetAnalysisProgress(matchID, analysisID, len(parsed.FENs), len(parsed.FENs), "complete", start, 0)

	return nil
}

func toPositionLines(lines []EngineLine) []PositionLine {
	out := make([]PositionLine, 0, len(lines))
	for _, l := range lines {
		// copy pv slice
		pv := make([]string, 0, len(l.PV))
		pv = append(pv, l.PV...)
		out = append(out, PositionLine{
			PV:   pv,
			CP:   l.CP,
			Mate: l.Mate,
		})
	}
	return out
}


