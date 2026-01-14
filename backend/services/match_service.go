package services

import (
	"errors"
	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
	"sort"
)

type MatchService struct {
	glickoService *GlickoService
	userService   *UserService
}

func NewMatchService() *MatchService {
	return &MatchService{
		glickoService: NewGlickoService(),
		userService:   NewUserService(),
	}
}

func (s *MatchService) GetAllMatches() ([]models.Match, error) {
	var matches []models.Match
	result := database.DB.Preload("WhitePlayer").Preload("BlackPlayer").
		Order("played_at DESC").Find(&matches)
	return matches, result.Error
}

func (s *MatchService) GetMatchByID(id uint) (*models.Match, error) {
	var match models.Match
	result := database.DB.Preload("WhitePlayer").Preload("BlackPlayer").First(&match, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &match, nil
}

func (s *MatchService) GetMatchesByUserID(userID uint) ([]models.Match, error) {
	var matches []models.Match
	result := database.DB.Preload("WhitePlayer").Preload("BlackPlayer").
		Where("white_player_id = ? OR black_player_id = ?", userID, userID).
		Order("played_at DESC").Find(&matches)
	return matches, result.Error
}

func (s *MatchService) CreateMatch(req *models.CreateMatchRequest) (*models.Match, error) {
	// Validate players exist
	whitePlayer, err := s.userService.GetUserByID(req.WhitePlayerID)
	if err != nil {
		return nil, errors.New("white player not found")
	}

	blackPlayer, err := s.userService.GetUserByID(req.BlackPlayerID)
	if err != nil {
		return nil, errors.New("black player not found")
	}

	if req.WhitePlayerID == req.BlackPlayerID {
		return nil, errors.New("white and black player cannot be the same")
	}

	// Create match record
	match := models.Match{
		WhitePlayerID:     req.WhitePlayerID,
		BlackPlayerID:     req.BlackPlayerID,
		Result:            req.Result,
		PlayedAt:          req.PlayedAt,
		WhiteRatingBefore: whitePlayer.Rating,
		BlackRatingBefore: blackPlayer.Rating,
		ChesscomGameID:    req.ChesscomGameID,
		PGN:               req.PGN,
	}

	// Start transaction
	tx := database.DB.Begin()

	// 항상 레이팅에 반영
	newWhiteRating, newWhiteRD, newBlackRating, newBlackRD := s.glickoService.ProcessMatch(
		whitePlayer.Rating, whitePlayer.RatingDeviation,
		blackPlayer.Rating, blackPlayer.RatingDeviation,
		string(req.Result),
	)

	match.WhiteRatingAfter = newWhiteRating
	match.BlackRatingAfter = newBlackRating

	// Save match
	if err := tx.Create(&match).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update white player rating
	if err := tx.Model(&models.User{}).Where("id = ?", req.WhitePlayerID).
		Updates(map[string]interface{}{
			"rating":           newWhiteRating,
			"rating_deviation": newWhiteRD,
		}).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update black player rating
	if err := tx.Model(&models.User{}).Where("id = ?", req.BlackPlayerID).
		Updates(map[string]interface{}{
			"rating":           newBlackRating,
			"rating_deviation": newBlackRD,
		}).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	// Reload match with player info
	return s.GetMatchByID(match.ID)
}

func (s *MatchService) DeleteMatch(id uint) error {
	// Note: This does not rollback ratings. For a full implementation,
	// you would need to recalculate all subsequent match ratings.
	result := database.DB.Delete(&models.Match{}, id)
	return result.Error
}

func (s *MatchService) DeleteAllMatches() (int64, error) {
	// Delete all matches AND reset all users to their initial rating/RD
	tx := database.DB.Begin()

	result := tx.Unscoped().Where("1 = 1").Delete(&models.Match{})
	if result.Error != nil {
		tx.Rollback()
		return 0, result.Error
	}

	users, err := s.userService.GetAllUsers()
	if err != nil {
		tx.Rollback()
		return 0, err
	}

	for _, u := range users {
		initRating := u.InitialRating
		initRD := u.InitialRD
		if initRating == 0 {
			initRating = InitialRating
		}
		if initRD == 0 {
			initRD = InitialRD
		}
		if err := tx.Model(&models.User{}).Where("id = ?", u.ID).
			Updates(map[string]interface{}{
				"rating":           initRating,
				"rating_deviation": initRD,
			}).Error; err != nil {
			tx.Rollback()
			return 0, err
		}
	}

	tx.Commit()
	return result.RowsAffected, nil
}

// CreateMatchBulk creates multiple matches in order (sorted by PlayedAt)
func (s *MatchService) CreateMatchBulk(req *models.BulkCreateMatchRequest) ([]models.Match, error) {
	if len(req.Matches) == 0 {
		return nil, errors.New("no matches to create")
	}

	// Sort matches by PlayedAt (ascending) to calculate ratings correctly
	sortedMatches := make([]models.CreateMatchRequest, len(req.Matches))
	copy(sortedMatches, req.Matches)

	// Simple bubble sort for small arrays
	for i := 0; i < len(sortedMatches)-1; i++ {
		for j := 0; j < len(sortedMatches)-i-1; j++ {
			if sortedMatches[j].PlayedAt.After(sortedMatches[j+1].PlayedAt) {
				sortedMatches[j], sortedMatches[j+1] = sortedMatches[j+1], sortedMatches[j]
			}
		}
	}

	var createdMatches []models.Match

	// Create each match in order
	for _, matchReq := range sortedMatches {
		match, err := s.CreateMatch(&matchReq)
		if err != nil {
			// If any match fails, return what we have created so far with the error
			return createdMatches, err
		}
		createdMatches = append(createdMatches, *match)
	}

	return createdMatches, nil
}

// RecalculateAllRatings resets all users to initial rating/RD and replays all matches in chronological order.
// This guarantees rating consistency even if older matches are inserted later.
func (s *MatchService) RecalculateAllRatings() error {
	// Load all users (including those without any matches)
	users, err := s.userService.GetAllUsers()
	if err != nil {
		return err
	}

	// Load all matches (no need to preload relations for rating replay)
	var matches []models.Match
	if err := database.DB.Order("played_at ASC").Order("id ASC").Find(&matches).Error; err != nil {
		return err
	}

	type ratingState struct {
		Rating float64
		RD     float64
	}

	stateByUser := make(map[uint]ratingState, len(users))
	for _, u := range users {
		initRating := u.InitialRating
		initRD := u.InitialRD
		// Backward compatibility: if DB has 0 values (older rows), fallback to constants
		if initRating == 0 {
			initRating = InitialRating
		}
		if initRD == 0 {
			initRD = InitialRD
		}
		stateByUser[u.ID] = ratingState{Rating: initRating, RD: initRD}
	}

	// Deterministic ordering even when PlayedAt ties: sort by PlayedAt then ChesscomGameID then ID
	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].PlayedAt.Equal(matches[j].PlayedAt) {
			gi, gj := "", ""
			if matches[i].ChesscomGameID != nil {
				gi = *matches[i].ChesscomGameID
			}
			if matches[j].ChesscomGameID != nil {
				gj = *matches[j].ChesscomGameID
			}
			if gi != gj {
				return gi < gj
			}
			return matches[i].ID < matches[j].ID
		}
		return matches[i].PlayedAt.Before(matches[j].PlayedAt)
	})

	tx := database.DB.Begin()

	// Reset all users first
	for _, u := range users {
		initRating := u.InitialRating
		initRD := u.InitialRD
		if initRating == 0 {
			initRating = InitialRating
		}
		if initRD == 0 {
			initRD = InitialRD
		}
		if err := tx.Model(&models.User{}).Where("id = ?", u.ID).
			Updates(map[string]interface{}{
				"rating":           initRating,
				"rating_deviation": initRD,
			}).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	// Replay matches and update match rating fields
	for _, m := range matches {
		white := stateByUser[m.WhitePlayerID]
		black := stateByUser[m.BlackPlayerID]

		whiteBefore := white.Rating
		blackBefore := black.Rating
		newWhiteRating, newWhiteRD, newBlackRating, newBlackRD := s.glickoService.ProcessMatch(
			white.Rating, white.RD,
			black.Rating, black.RD,
			string(m.Result),
		)
		whiteAfter := newWhiteRating
		blackAfter := newBlackRating

		white.Rating, white.RD = newWhiteRating, newWhiteRD
		black.Rating, black.RD = newBlackRating, newBlackRD
		stateByUser[m.WhitePlayerID] = white
		stateByUser[m.BlackPlayerID] = black

		if err := tx.Model(&models.Match{}).Where("id = ?", m.ID).
			Updates(map[string]interface{}{
				"white_rating_before": whiteBefore,
				"black_rating_before": blackBefore,
				"white_rating_after":  whiteAfter,
				"black_rating_after":  blackAfter,
			}).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	// Persist final user states
	for userID, st := range stateByUser {
		if err := tx.Model(&models.User{}).Where("id = ?", userID).
			Updates(map[string]interface{}{
				"rating":           st.Rating,
				"rating_deviation": st.RD,
			}).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	tx.Commit()
	return nil
}
