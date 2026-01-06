package handlers

import (
	"net/http"
	"strconv"

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
