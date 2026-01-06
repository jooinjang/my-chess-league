package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const (
	ChesscomBaseURL = "https://api.chess.com/pub"
)

type ChesscomService struct {
	httpClient *http.Client
}

func NewChesscomService() *ChesscomService {
	return &ChesscomService{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Chess.com API response types
type ChesscomPlayer struct {
	Username string `json:"username"`
	Rating   int    `json:"rating"`
	Result   string `json:"result"`
}

type ChesscomGameRaw struct {
	URL         string         `json:"url"`
	PGN         string         `json:"pgn"`
	TimeControl string         `json:"time_control"`
	EndTime     int64          `json:"end_time"`
	Rated       bool           `json:"rated"`
	TimeClass   string         `json:"time_class"`
	Rules       string         `json:"rules"`
	White       ChesscomPlayer `json:"white"`
	Black       ChesscomPlayer `json:"black"`
}

type ChesscomGamesResponse struct {
	Games []ChesscomGameRaw `json:"games"`
}

type ChesscomUserProfile struct {
	PlayerID   int    `json:"player_id"`
	Username   string `json:"username"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	Country    string `json:"country"`
	Joined     int64  `json:"joined"`
	LastOnline int64  `json:"last_online"`
}

// Our game structure for frontend
type ChesscomGame struct {
	URL       string `json:"url"`
	GameID    string `json:"game_id"`
	PGN       string `json:"pgn"`
	EndTime   int64  `json:"end_time"`
	TimeClass string `json:"time_class"`
	Rated     bool   `json:"rated"`
	White     struct {
		Username string `json:"username"`
		Rating   int    `json:"rating"`
		Result   string `json:"result"`
	} `json:"white"`
	Black struct {
		Username string `json:"username"`
		Rating   int    `json:"rating"`
		Result   string `json:"result"`
	} `json:"black"`
}

// ValidateUsername checks if a Chess.com username exists
func (s *ChesscomService) ValidateUsername(username string) (*ChesscomUserProfile, error) {
	url := fmt.Sprintf("%s/player/%s", ChesscomBaseURL, strings.ToLower(username))

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "MyChessLeague/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("user not found: %s", username)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("chess.com API error: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var profile ChesscomUserProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, err
	}

	return &profile, nil
}

// GetMonthlyGames fetches games for a user in a specific month
func (s *ChesscomService) GetMonthlyGames(username string, year, month int) ([]ChesscomGame, error) {
	url := fmt.Sprintf("%s/player/%s/games/%d/%02d", ChesscomBaseURL, strings.ToLower(username), year, month)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "MyChessLeague/1.0")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		// No games for this month
		return []ChesscomGame{}, nil
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("chess.com API error: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var gamesResp ChesscomGamesResponse
	if err := json.Unmarshal(body, &gamesResp); err != nil {
		return nil, err
	}

	// Convert to our game structure
	games := make([]ChesscomGame, 0, len(gamesResp.Games))
	for _, g := range gamesResp.Games {
		game := ChesscomGame{
			URL:       g.URL,
			GameID:    extractGameID(g.URL),
			PGN:       g.PGN,
			EndTime:   g.EndTime,
			TimeClass: g.TimeClass,
			Rated:     g.Rated,
		}
		game.White.Username = g.White.Username
		game.White.Rating = g.White.Rating
		game.White.Result = g.White.Result
		game.Black.Username = g.Black.Username
		game.Black.Rating = g.Black.Rating
		game.Black.Result = g.Black.Result
		games = append(games, game)
	}

	return games, nil
}

// GetGamesBetweenPlayers fetches games between two specific players in a month
func (s *ChesscomService) GetGamesBetweenPlayers(user1, user2 string, year, month int) ([]ChesscomGame, error) {
	// Fetch games from user1's perspective
	allGames, err := s.GetMonthlyGames(user1, year, month)
	if err != nil {
		return nil, err
	}

	// Filter games where user2 is the opponent
	user1Lower := strings.ToLower(user1)
	user2Lower := strings.ToLower(user2)

	var filteredGames []ChesscomGame
	for _, game := range allGames {
		whiteLower := strings.ToLower(game.White.Username)
		blackLower := strings.ToLower(game.Black.Username)

		// Check if both users are in this game
		if (whiteLower == user1Lower && blackLower == user2Lower) ||
			(whiteLower == user2Lower && blackLower == user1Lower) {
			filteredGames = append(filteredGames, game)
		}
	}

	return filteredGames, nil
}

// ConvertResultToMatchResult converts Chess.com result to our MatchResult
func ConvertResultToMatchResult(whiteResult, blackResult string) string {
	switch whiteResult {
	case "win":
		return "white_win"
	case "checkmated", "timeout", "resigned", "lose", "abandoned":
		return "black_win"
	default:
		// Draw cases: stalemate, insufficient, 50move, repetition, agreed, timevsinsufficient
		if blackResult == "win" {
			return "black_win"
		}
		return "draw"
	}
}

// extractGameID extracts the game ID from Chess.com game URL
// URL format: https://www.chess.com/game/live/129688175007
func extractGameID(url string) string {
	re := regexp.MustCompile(`/game/(?:live|daily)/(\d+)`)
	matches := re.FindStringSubmatch(url)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}
