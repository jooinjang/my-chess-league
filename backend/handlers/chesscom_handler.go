package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"my-chess-league/backend/database"
	"my-chess-league/backend/models"
	"my-chess-league/backend/services"

	"github.com/gin-gonic/gin"
)

var chesscomService = services.NewChesscomService()

// ValidateChesscomUsername validates a Chess.com username
func ValidateChesscomUsername(c *gin.Context) {
	username := c.Param("username")
	if username == "" {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_USERNAME", Message: "Username is required"},
		})
		return
	}

	profile, err := chesscomService.ValidateUsername(username)
	if err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "USER_NOT_FOUND", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, Response{Success: true, Data: profile})
}

// GetChesscomGames fetches games between two users from Chess.com
func GetChesscomGames(c *gin.Context) {
	// Parse query parameters
	user1IDStr := c.Query("user1_id")
	user2IDStr := c.Query("user2_id")
	yearStr := c.Query("year")
	monthStr := c.Query("month")

	if user1IDStr == "" || user2IDStr == "" {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "MISSING_PARAMS", Message: "user1_id and user2_id are required"},
		})
		return
	}

	user1ID, err := strconv.ParseUint(user1IDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_USER1_ID", Message: "Invalid user1_id"},
		})
		return
	}

	user2ID, err := strconv.ParseUint(user2IDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_USER2_ID", Message: "Invalid user2_id"},
		})
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_YEAR", Message: "Invalid year"},
		})
		return
	}

	month, err := strconv.Atoi(monthStr)
	if err != nil || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_MONTH", Message: "Invalid month (1-12)"},
		})
		return
	}

	// Get users from database
	var user1, user2 models.User
	if err := database.DB.First(&user1, user1ID).Error; err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "USER1_NOT_FOUND", Message: "User 1 not found"},
		})
		return
	}

	if err := database.DB.First(&user2, user2ID).Error; err != nil {
		c.JSON(http.StatusNotFound, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "USER2_NOT_FOUND", Message: "User 2 not found"},
		})
		return
	}

	// Check if both users have Chess.com usernames
	if user1.ChesscomUsername == nil || *user1.ChesscomUsername == "" {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NO_CHESSCOM_USER1", Message: "User 1 does not have a Chess.com username"},
		})
		return
	}

	if user2.ChesscomUsername == nil || *user2.ChesscomUsername == "" {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NO_CHESSCOM_USER2", Message: "User 2 does not have a Chess.com username"},
		})
		return
	}

	// Fetch games from Chess.com
	games, err := chesscomService.GetGamesBetweenPlayers(*user1.ChesscomUsername, *user2.ChesscomUsername, year, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "CHESSCOM_API_ERROR", Message: err.Error()},
		})
		return
	}

	// Get already imported game IDs
	var existingMatches []models.Match
	var gameIDs []string
	for _, g := range games {
		if g.GameID != "" {
			gameIDs = append(gameIDs, g.GameID)
		}
	}

	alreadyImported := make([]string, 0)
	if len(gameIDs) > 0 {
		database.DB.Where("chesscom_game_id IN ?", gameIDs).Find(&existingMatches)
		for _, m := range existingMatches {
			if m.ChesscomGameID != nil {
				alreadyImported = append(alreadyImported, *m.ChesscomGameID)
			}
		}
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: gin.H{
			"games":            games,
			"already_imported": alreadyImported,
			"user1": gin.H{
				"id":                user1.ID,
				"name":              user1.Name,
				"chesscom_username": user1.ChesscomUsername,
			},
			"user2": gin.H{
				"id":                user2.ID,
				"name":              user2.Name,
				"chesscom_username": user2.ChesscomUsername,
			},
		},
	})
}

// SyncChesscomMonth fetches all games between currently registered players for a given year/month,
// creates missing matches, then recalculates ratings across all matches in chronological order.
func SyncChesscomMonth(c *gin.Context) {
	yearStr := c.Query("year")
	monthStr := c.Query("month")

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_YEAR", Message: "Invalid year"},
		})
		return
	}
	month, err := strconv.Atoi(monthStr)
	if err != nil || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "INVALID_MONTH", Message: "Invalid month (1-12)"},
		})
		return
	}

	// Optional flag
	recalculate := true
	if v := strings.TrimSpace(c.Query("recalculate")); v != "" {
		v = strings.ToLower(v)
		recalculate = !(v == "false" || v == "0" || v == "no")
	}

	// Load users with Chess.com usernames
	var users []models.User
	if err := database.DB.Where("chesscom_username IS NOT NULL AND chesscom_username != ''").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "DB_ERROR", Message: err.Error()},
		})
		return
	}
	if len(users) < 2 {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Error:   &ErrorInfo{Code: "NOT_ENOUGH_USERS", Message: "At least 2 users with Chess.com usernames are required"},
		})
		return
	}

	// Map chess.com username -> user
	userByChesscom := make(map[string]models.User, len(users))
	for _, u := range users {
		if u.ChesscomUsername == nil {
			continue
		}
		name := strings.ToLower(strings.TrimSpace(*u.ChesscomUsername))
		if name == "" {
			continue
		}
		userByChesscom[name] = u
	}

	// Fetch monthly games for each user and keep only games between registered users
	type gameWrap struct {
		Game services.ChesscomGame
	}
	gamesByID := make(map[string]services.ChesscomGame)
	totalFetched := 0

	for _, u := range users {
		if u.ChesscomUsername == nil || strings.TrimSpace(*u.ChesscomUsername) == "" {
			continue
		}
		username := strings.TrimSpace(*u.ChesscomUsername)
		userGames, err := chesscomService.GetMonthlyGames(username, year, month)
		if err != nil {
			c.JSON(http.StatusInternalServerError, Response{
				Success: false,
				Error:   &ErrorInfo{Code: "CHESSCOM_API_ERROR", Message: err.Error()},
			})
			return
		}
		totalFetched += len(userGames)

		for _, g := range userGames {
			if g.GameID == "" {
				continue
			}
			whiteLower := strings.ToLower(g.White.Username)
			blackLower := strings.ToLower(g.Black.Username)
			if _, ok := userByChesscom[whiteLower]; !ok {
				continue
			}
			if _, ok := userByChesscom[blackLower]; !ok {
				continue
			}
			// Deduplicate (same game appears in both players' archives)
			gamesByID[g.GameID] = g
		}
	}

	// Determine which games already exist in DB
	gameIDs := make([]string, 0, len(gamesByID))
	for id := range gamesByID {
		gameIDs = append(gameIDs, id)
	}

	alreadyImportedSet := make(map[string]struct{})
	if len(gameIDs) > 0 {
		var existingMatches []models.Match
		database.DB.Where("chesscom_game_id IN ?", gameIDs).Find(&existingMatches)
		for _, m := range existingMatches {
			if m.ChesscomGameID != nil {
				alreadyImportedSet[*m.ChesscomGameID] = struct{}{}
			}
		}
	}

	// Build bulk create requests for missing games
	matchesToCreate := make([]models.CreateMatchRequest, 0)
	for gameID, g := range gamesByID {
		if _, exists := alreadyImportedSet[gameID]; exists {
			continue
		}

		whiteUser := userByChesscom[strings.ToLower(g.White.Username)]
		blackUser := userByChesscom[strings.ToLower(g.Black.Username)]

		result := services.ConvertResultToMatchResult(g.White.Result, g.Black.Result)
		playedAt := time.Unix(g.EndTime, 0).UTC()
		gameIDCopy := gameID
		pgnCopy := g.PGN

		var pgnPtr *string
		if pgnCopy != "" {
			pgnPtr = &pgnCopy
		}

		matchesToCreate = append(matchesToCreate, models.CreateMatchRequest{
			WhitePlayerID:  whiteUser.ID,
			BlackPlayerID:  blackUser.ID,
			Result:         models.MatchResult(result),
			PlayedAt:       playedAt,
			ChesscomGameID: &gameIDCopy,
			PGN:            pgnPtr,
		})
	}

	createdCount := 0
	if len(matchesToCreate) > 0 {
		created, err := matchService.CreateMatchBulk(&models.BulkCreateMatchRequest{Matches: matchesToCreate})
		if err != nil {
			c.JSON(http.StatusBadRequest, Response{
				Success: false,
				Error:   &ErrorInfo{Code: "CREATE_ERROR", Message: err.Error()},
				Data: gin.H{
					"created_count": len(created),
				},
			})
			return
		}
		createdCount = len(created)
	}

	recalcDone := false
	if recalculate {
		if err := matchService.RecalculateAllRatings(); err != nil {
			c.JSON(http.StatusInternalServerError, Response{
				Success: false,
				Error:   &ErrorInfo{Code: "RECALCULATE_ERROR", Message: err.Error()},
			})
			return
		}
		recalcDone = true
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Data: gin.H{
			"year":                 year,
			"month":                month,
			"recalculate":           recalculate,
			"recalculate_done":      recalcDone,
			"users_considered":      len(userByChesscom),
			"total_fetched":         totalFetched,
			"total_between_players": len(gamesByID),
			"already_imported":      len(alreadyImportedSet),
			"created_count":         createdCount,
		},
	})
}
