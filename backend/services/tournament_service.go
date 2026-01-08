package services

import (
	"errors"
	"fmt"
	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

type TournamentService struct {
	userService     *UserService
	matchService    *MatchService
	chesscomService *ChesscomService
}

func NewTournamentService() *TournamentService {
	return &TournamentService{
		userService:     NewUserService(),
		matchService:    NewMatchService(),
		chesscomService: NewChesscomService(),
	}
}

func (s *TournamentService) CreateTournament(req *models.CreateTournamentRequest) (*models.Tournament, error) {
	if len(req.ParticipantUserIDs) < 2 {
		return nil, errors.New("at least 2 participants are required")
	}
	seen := make(map[uint]struct{}, len(req.ParticipantUserIDs))
	for _, id := range req.ParticipantUserIDs {
		if _, ok := seen[id]; ok {
			return nil, errors.New("duplicate participant_user_ids")
		}
		seen[id] = struct{}{}
		if _, err := s.userService.GetUserByID(id); err != nil {
			return nil, fmt.Errorf("user not found: %d", id)
		}
	}

	t := models.Tournament{
		Name:   req.Name,
		Status: models.TournamentStatusDraft,
	}

	tx := database.DB.Begin()
	if err := tx.Create(&t).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	for i, uid := range req.ParticipantUserIDs {
		p := models.TournamentParticipant{
			TournamentID: t.ID,
			UserID:       uid,
			Seed:         i + 1,
		}
		if err := tx.Create(&p).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}
	tx.Commit()

	return s.GetTournamentByID(t.ID)
}

func (s *TournamentService) GetTournaments() ([]models.Tournament, error) {
	var ts []models.Tournament
	err := database.DB.Order("id DESC").Find(&ts).Error
	return ts, err
}

func (s *TournamentService) GetTournamentByID(id uint) (*models.Tournament, error) {
	var t models.Tournament
	err := database.DB.Preload("Participants").Preload("Participants.User").First(&t, id).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *TournamentService) DeleteTournament(id uint) error {
	tx := database.DB.Begin()
	if err := tx.Where("tournament_id = ?", id).Delete(&models.TournamentMatch{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Where("tournament_id = ?", id).Delete(&models.TournamentParticipant{}).Error; err != nil {
		tx.Rollback()
		return err
	}
	if err := tx.Delete(&models.Tournament{}, id).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Commit()
	return nil
}

func (s *TournamentService) GetBracket(tournamentID uint) ([]models.TournamentMatch, error) {
	var matches []models.TournamentMatch
	err := database.DB.
		Preload("Player1").Preload("Player2").
		Preload("InitialMatch").Preload("InitialMatch.WhitePlayer").Preload("InitialMatch.BlackPlayer").
		Preload("TiebreakMatch").Preload("TiebreakMatch.WhitePlayer").Preload("TiebreakMatch.BlackPlayer").
		Preload("LinkedMatch").Preload("LinkedMatch.WhitePlayer").Preload("LinkedMatch.BlackPlayer").
		Where("tournament_id = ?", tournamentID).
		Order("round_no ASC").Order("match_no ASC").Order("id ASC").
		Find(&matches).Error
	return matches, err
}

func (s *TournamentService) GenerateNextRound(tournamentID uint) ([]models.TournamentMatch, error) {
	t, err := s.GetTournamentByID(tournamentID)
	if err != nil {
		return nil, err
	}
	if t.Status == models.TournamentStatusCompleted {
		return nil, errors.New("tournament is completed")
	}

	// Determine next round number
	var maxRound int
	database.DB.Model(&models.TournamentMatch{}).
		Where("tournament_id = ?", tournamentID).
		Select("COALESCE(MAX(round_no), 0)").Scan(&maxRound)
	nextRound := maxRound + 1

	// If draft -> running once we generate anything
	if t.Status == models.TournamentStatusDraft {
		if err := database.DB.Model(&models.Tournament{}).Where("id = ?", tournamentID).
			Update("status", models.TournamentStatusRunning).Error; err != nil {
			return nil, err
		}
	}

	// Load participants fresh
	var participants []models.TournamentParticipant
	if err := database.DB.Preload("User").
		Where("tournament_id = ?", tournamentID).
		Find(&participants).Error; err != nil {
		return nil, err
	}

	active := make([]models.TournamentParticipant, 0, len(participants))
	for _, p := range participants {
		if !p.Eliminated && p.Losses < 2 {
			active = append(active, p)
		}
	}
	if len(active) < 2 {
		return nil, errors.New("not enough active participants")
	}

	// Special case: Grand Final (0-loss vs 1-loss) when only 2 remain
	if len(active) == 2 {
		a, b := active[0], active[1]
		// Ensure deterministic
		if a.Seed > b.Seed {
			a, b = b, a
		}
		if (a.Losses == 0 && b.Losses == 1) || (a.Losses == 1 && b.Losses == 0) {
			// Check if GF already exists and unresolved
			var existing []models.TournamentMatch
			_ = database.DB.Where("tournament_id = ? AND (bracket = ? OR bracket = ?) AND status != ?",
				tournamentID, models.TournamentBracketGF, models.TournamentBracketGFReset, models.PairingStatusDone).
				Find(&existing).Error
			if len(existing) > 0 {
				return s.GetBracket(tournamentID)
			}

			// If GF already done and reset needed, it will be handled by result reporting.
			br := models.TournamentBracketGF
			p1 := a.UserID
			p2 := b.UserID
			m := models.TournamentMatch{
				TournamentID:  tournamentID,
				Bracket:       br,
				RoundNo:       nextRound,
				MatchNo:       1,
				Player1UserID: &p1,
				Player2UserID: &p2,
				Status:        models.PairingStatusPending,
			}
			if err := database.DB.Create(&m).Error; err != nil {
				return nil, err
			}
			return s.GetBracket(tournamentID)
		}
	}

	// Normal next round: group by losses and pair within group
	sort.SliceStable(active, func(i, j int) bool {
		if active[i].Losses != active[j].Losses {
			return active[i].Losses < active[j].Losses
		}
		return active[i].Seed < active[j].Seed
	})

	groupByLoss := map[int][]models.TournamentParticipant{}
	for _, p := range active {
		groupByLoss[p.Losses] = append(groupByLoss[p.Losses], p)
	}

	tx := database.DB.Begin()
	matchNo := 1
	for _, losses := range []int{0, 1} {
		group := groupByLoss[losses]
		if len(group) == 0 {
			continue
		}
		// bye if odd -> auto win
		if len(group)%2 == 1 {
			bye := group[len(group)-1]
			byeID := bye.UserID
			br := models.TournamentBracketLosers
			if losses == 0 {
				br = models.TournamentBracketWinners
			}
			m := models.TournamentMatch{
				TournamentID:  tournamentID,
				Bracket:       br,
				RoundNo:       nextRound,
				MatchNo:       matchNo,
				Player1UserID: &byeID,
				Player2UserID: nil,
				WinnerUserID:  &byeID,
				LoserUserID:   nil,
				Status:        models.PairingStatusDone,
			}
			if err := tx.Create(&m).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
			// Update stats: bye counts as win, no loss for anyone
			if err := tx.Model(&models.TournamentParticipant{}).
				Where("tournament_id = ? AND user_id = ?", tournamentID, bye.UserID).
				Updates(map[string]interface{}{"wins": bye.Wins + 1}).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
			group = group[:len(group)-1]
			matchNo++
		}

		// pair sequentially
		for i := 0; i < len(group); i += 2 {
			a := group[i].UserID
			b := group[i+1].UserID
			br := models.TournamentBracketLosers
			if losses == 0 {
				br = models.TournamentBracketWinners
			}
			m := models.TournamentMatch{
				TournamentID:  tournamentID,
				Bracket:       br,
				RoundNo:       nextRound,
				MatchNo:       matchNo,
				Player1UserID: &a,
				Player2UserID: &b,
				Status:        models.PairingStatusPending,
			}
			if err := tx.Create(&m).Error; err != nil {
				tx.Rollback()
				return nil, err
			}
			matchNo++
		}
	}

	tx.Commit()
	return s.GetBracket(tournamentID)
}

func (s *TournamentService) ReportMatchResultFromChesscom(tournamentID uint, matchID uint, req *models.TournamentReportChesscomResultRequest) (*models.TournamentMatch, error) {
	var tm models.TournamentMatch
	if err := database.DB.First(&tm, matchID).Error; err != nil {
		return nil, err
	}
	if tm.TournamentID != tournamentID {
		return nil, errors.New("match does not belong to tournament")
	}
	if tm.Status == models.PairingStatusDone {
		return nil, errors.New("match already completed")
	}
	if tm.Player1UserID == nil || tm.Player2UserID == nil {
		return nil, errors.New("match is missing player(s)")
	}

	u1, err := s.userService.GetUserByID(*tm.Player1UserID)
	if err != nil {
		return nil, errors.New("player1 not found")
	}
	u2, err := s.userService.GetUserByID(*tm.Player2UserID)
	if err != nil {
		return nil, errors.New("player2 not found")
	}
	if u1.ChesscomUsername == nil || strings.TrimSpace(*u1.ChesscomUsername) == "" {
		return nil, errors.New("player1 has no chess.com username")
	}
	if u2.ChesscomUsername == nil || strings.TrimSpace(*u2.ChesscomUsername) == "" {
		return nil, errors.New("player2 has no chess.com username")
	}

	// Prevent duplicates
	var existing models.Match
	if err := database.DB.Where("chesscom_game_id = ?", req.GameID).First(&existing).Error; err == nil {
		return nil, errors.New("this chess.com game is already imported")
	}

	games, err := s.chesscomService.GetGamesBetweenPlayers(*u1.ChesscomUsername, *u2.ChesscomUsername, req.Year, req.Month)
	if err != nil {
		return nil, err
	}
	var chosen *ChesscomGame
	for i := range games {
		if games[i].GameID == req.GameID {
			chosen = &games[i]
			break
		}
	}
	if chosen == nil {
		return nil, errors.New("game_id not found for these players in the selected month")
	}

	createMatchReq := func(game ChesscomGame, gameID string) models.CreateMatchRequest {
		whiteUsername := strings.ToLower(game.White.Username)
		u1c := strings.ToLower(strings.TrimSpace(*u1.ChesscomUsername))
		var wID, bID uint
		if whiteUsername == u1c {
			wID = u1.ID
			bID = u2.ID
		} else {
			wID = u2.ID
			bID = u1.ID
		}
		r := ConvertResultToMatchResult(game.White.Result, game.Black.Result)
		playedAt := time.Unix(game.EndTime, 0).UTC()
		gameIDCopy := gameID
		return models.CreateMatchRequest{
			WhitePlayerID:  wID,
			BlackPlayerID:  bID,
			Result:         models.MatchResult(r),
			PlayedAt:       playedAt,
			ChesscomGameID: &gameIDCopy,
		}
	}

	stage := "initial"
	if tm.ArmageddonRequired {
		stage = "armageddon"
	}

	cReq := createMatchReq(*chosen, req.GameID)
	created, err := s.matchService.CreateMatch(&cReq)
	if err != nil {
		return nil, err
	}

	if stage == "initial" {
		if tm.InitialMatchID != nil {
			return nil, errors.New("initial game already recorded for this match")
		}
		if created.Result == models.Draw {
			// Mark armageddon required, keep the tournament match pending
			if err := database.DB.Model(&models.TournamentMatch{}).Where("id = ?", tm.ID).
				Updates(map[string]interface{}{
					"initial_match_id":    created.ID,
					"armageddon_required": true,
					"status":              models.PairingStatusPending,
				}).Error; err != nil {
				return nil, err
			}
			return s.reloadTournamentMatch(tm.ID)
		}

		winnerID, loserID, err := winnerLoserFromMatch(created)
		if err != nil {
			return nil, err
		}
		initialID := created.ID
		return s.completeTournamentMatch(tournamentID, tm, created.ID, &initialID, nil, winnerID, loserID)
	}

	// Armageddon stage (must be decisive)
	if tm.InitialMatchID == nil {
		return nil, errors.New("armageddon requires an initial draw game recorded first")
	}
	if tm.TiebreakMatchID != nil {
		return nil, errors.New("armageddon game already recorded for this match")
	}
	if created.Result == models.Draw {
		return nil, errors.New("armageddon game must be decisive (not a draw)")
	}
	winnerID, loserID, err := winnerLoserFromMatch(created)
	if err != nil {
		return nil, err
	}
	tbID := created.ID
	return s.completeTournamentMatch(tournamentID, tm, created.ID, tm.InitialMatchID, &tbID, winnerID, loserID)
}

func (s *TournamentService) reloadTournamentMatch(matchID uint) (*models.TournamentMatch, error) {
	var out models.TournamentMatch
	if err := database.DB.
		Preload("Player1").Preload("Player2").
		Preload("InitialMatch").Preload("InitialMatch.WhitePlayer").Preload("InitialMatch.BlackPlayer").
		Preload("TiebreakMatch").Preload("TiebreakMatch.WhitePlayer").Preload("TiebreakMatch.BlackPlayer").
		Preload("LinkedMatch").Preload("LinkedMatch.WhitePlayer").Preload("LinkedMatch.BlackPlayer").
		First(&out, matchID).Error; err != nil {
		return nil, err
	}
	return &out, nil
}

func winnerLoserFromMatch(m *models.Match) (winnerID uint, loserID uint, err error) {
	switch m.Result {
	case models.WhiteWin:
		return m.WhitePlayerID, m.BlackPlayerID, nil
	case models.BlackWin:
		return m.BlackPlayerID, m.WhitePlayerID, nil
	default:
		return 0, 0, errors.New("match is not decisive")
	}
}

func (s *TournamentService) completeTournamentMatch(
	tournamentID uint,
	tm models.TournamentMatch,
	decisiveMatchID uint,
	initialMatchID *uint,
	tiebreakMatchID *uint,
	winnerID uint,
	loserID uint,
) (*models.TournamentMatch, error) {
	tx := database.DB.Begin()
	if err := tx.Model(&models.TournamentMatch{}).Where("id = ?", tm.ID).
		Updates(map[string]interface{}{
			"status":              models.PairingStatusDone,
			"armageddon_required": false,
			"initial_match_id":    initialMatchID,
			"tiebreak_match_id":   tiebreakMatchID,
			"linked_match_id":     decisiveMatchID,
			"winner_user_id":      winnerID,
			"loser_user_id":       loserID,
		}).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update participants stats
	if err := tx.Model(&models.TournamentParticipant{}).
		Where("tournament_id = ? AND user_id = ?", tournamentID, winnerID).
		Update("wins", gorm.Expr("wins + ?", 1)).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Model(&models.TournamentParticipant{}).
		Where("tournament_id = ? AND user_id = ?", tournamentID, loserID).
		Update("losses", gorm.Expr("losses + ?", 1)).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	// Mark eliminated if losses >= 2 (reload after commit for correct value)
	var loserP models.TournamentParticipant
	if err := database.DB.Where("tournament_id = ? AND user_id = ?", tournamentID, loserID).First(&loserP).Error; err == nil {
		if loserP.Losses >= 2 && !loserP.Eliminated {
			_ = database.DB.Model(&models.TournamentParticipant{}).
				Where("id = ?", loserP.ID).
				Update("eliminated", true).Error
		}
	}

	// Handle GF reset and completion:
	// - If this was GF and the 1-loss player won, create GF_RESET.
	// - If this was GF and the 0-loss player won, tournament completes.
	// - If this was GF_RESET, tournament completes.
	if tm.Bracket == models.TournamentBracketGF {
		// Reload participants to see current losses
		var pWin, pLose models.TournamentParticipant
		_ = database.DB.Where("tournament_id = ? AND user_id = ?", tournamentID, winnerID).First(&pWin).Error
		_ = database.DB.Where("tournament_id = ? AND user_id = ?", tournamentID, loserID).First(&pLose).Error

		// If winner had 1 loss entering GF, now both should have 1 loss -> reset
		if pWin.Losses == 1 && pLose.Losses == 1 {
			// Create reset match if not existing
			var existing int64
			_ = database.DB.Model(&models.TournamentMatch{}).
				Where("tournament_id = ? AND bracket = ? AND status != ?", tournamentID, models.TournamentBracketGFReset, models.PairingStatusDone).
				Count(&existing).Error
			if existing == 0 {
				p1 := winnerID
				p2 := loserID
				_ = database.DB.Create(&models.TournamentMatch{
					TournamentID:  tournamentID,
					Bracket:       models.TournamentBracketGFReset,
					RoundNo:       tm.RoundNo + 1,
					MatchNo:       tm.MatchNo + 1,
					Player1UserID: &p1,
					Player2UserID: &p2,
					Status:        models.PairingStatusPending,
				}).Error
			}
		} else {
			// Champion decided
			_ = database.DB.Model(&models.Tournament{}).Where("id = ?", tournamentID).
				Update("status", models.TournamentStatusCompleted).Error
		}
	}
	if tm.Bracket == models.TournamentBracketGFReset {
		_ = database.DB.Model(&models.Tournament{}).Where("id = ?", tournamentID).
			Update("status", models.TournamentStatusCompleted).Error
	}

	return s.reloadTournamentMatch(tm.ID)
}
