package services

import (
	"errors"
	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
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

	// Calculate new ratings
	newWhiteRating, newWhiteRD, newBlackRating, newBlackRD := s.glickoService.ProcessMatch(
		whitePlayer.Rating, whitePlayer.RatingDeviation,
		blackPlayer.Rating, blackPlayer.RatingDeviation,
		string(req.Result),
	)

	// Create match record
	match := models.Match{
		WhitePlayerID:     req.WhitePlayerID,
		BlackPlayerID:     req.BlackPlayerID,
		Result:            req.Result,
		PlayedAt:          req.PlayedAt,
		WhiteRatingBefore: whitePlayer.Rating,
		BlackRatingBefore: blackPlayer.Rating,
		WhiteRatingAfter:  newWhiteRating,
		BlackRatingAfter:  newBlackRating,
		ChesscomGameID:    req.ChesscomGameID,
	}

	// Start transaction
	tx := database.DB.Begin()

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
	tx := database.DB.Begin()

	// Delete all matches
	result := tx.Unscoped().Where("1 = 1").Delete(&models.Match{})
	if result.Error != nil {
		tx.Rollback()
		return 0, result.Error
	}

	// Reset all user ratings to initial values
	if err := tx.Model(&models.User{}).Where("1 = 1").Updates(map[string]interface{}{
		"rating":           InitialRating,
		"rating_deviation": InitialRD,
	}).Error; err != nil {
		tx.Rollback()
		return 0, err
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
